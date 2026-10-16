// Aviso por e-mail quando chega lead novo.
//
// Como funciona (sem custo):
//   1. Um "despertador" gratuito (cron-job.org) chama /api/notify a cada 5 min.
//   2. Aqui lemos as duas planilhas (mesmos leads do painel, via lib/leads.js).
//   3. Cada CONTATO que ainda não foi avisado vira um e-mail — mesmo que seja
//      a mesma pessoa de novo (no painel ela continua sendo um card só).
//   4. Anotamos no Upstash Redis o que já foi avisado, pra nunca repetir.
//
// O e-mail sai pelo Gmail (senha de app), sem serviço pago.
//
// Variáveis de ambiente:
//   GMAIL_USER          e-mail que envia (ex: sua conta Gmail)
//   GMAIL_APP_PASSWORD  "senha de app" de 16 letras gerada no Google
//   ALERT_EMAIL_TO      quem recebe o aviso (pode ter vários, separados por vírgula)
//   NOTIFY_SECRET       código secreto que o cron-job.org manda no link

import nodemailer from "nodemailer";
import { Redis } from "@upstash/redis";

const NOTIFIED_SET = "notify:sent"; // contatos já avisados
const SEEDED_KEY = (origin) => `notify:seeded:${origin}`; // 1ª execução por planilha

let redis = null;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return redis;
}

/**
 * Transforma os leads do painel em "eventos de contato": um por linha nova da
 * planilha. Meta: cada linha tem ID próprio. Google: cada contato do histórico
 * da pessoa (lib/leads.js -> contactHistory).
 */
export function leadsToContactEvents(leads) {
  const events = [];
  for (const l of leads) {
    if (l.origin === "meta") {
      events.push({
        key: `m:${l.id}`,
        origin: "meta",
        name: l.name,
        phone: l.phone,
        property: l.property,
        detail: l.source,
        extra: [l.formAnswers?.porOnde, l.formAnswers?.prazo].filter(Boolean).join(" · "),
        at: l.createdAt,
        repeat: false,
      });
    } else if (l.origin === "google") {
      const history = l.contactHistory || [];
      history.forEach((c, idx) => {
        events.push({
          key: c.key,
          origin: "google",
          name: l.name,
          phone: l.phone,
          property: c.property,
          detail: c.origem ? `Site · ${c.origem}` : "Site",
          extra: c.mensagem,
          at: c.at,
          // histórico vem do mais recente pro mais antigo: se há contatos
          // depois deste (idx < length-1 = existe um mais antigo), é repetição
          repeat: idx < history.length - 1,
        });
      });
    }
  }
  return events;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildEmail(ev, panelUrl) {
  const plataforma = ev.origin === "google" ? "Google Ads" : "Meta Ads";
  const tagColor = ev.origin === "google" ? "#1a5fd1" : "#6b3fc4";
  const tagBg = ev.origin === "google" ? "#e8f0fe" : "#f1ebfd";
  const whatsLink = ev.phone?.valid ? `https://wa.me/${ev.phone.e164}` : null;
  const phoneTxt = ev.phone?.display || "número não informado";
  const repeatTxt = ev.repeat ? " (entrou em contato de novo)" : "";

  const subject = `Novo lead ${plataforma}: ${ev.name || "Sem nome"}${ev.repeat ? " (de novo)" : ""}`;

  const text = [
    `Novo lead (${plataforma})${repeatTxt}`,
    ``,
    `Nome: ${ev.name || "Sem nome"}`,
    `WhatsApp: ${phoneTxt}${whatsLink ? ` — ${whatsLink}` : ""}`,
    `Imóvel: ${ev.property || "—"}`,
    `Origem: ${ev.detail || "—"}`,
    ev.extra ? `Detalhes: ${ev.extra}` : null,
    `Quando: ${formatWhen(ev.at)}`,
    ``,
    panelUrl ? `Abrir o painel: ${panelUrl}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const row = (k, v) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#5b6472;font-size:13px;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0;font-size:14px;color:#1a1d23">${v}</td></tr>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <div style="background:#fff;border:1px solid #e2e5ea;border-radius:12px;padding:20px">
    <span style="display:inline-block;font-size:12px;font-weight:bold;color:${tagColor};background:${tagBg};border-radius:999px;padding:4px 10px">${plataforma}</span>
    <h2 style="margin:12px 0 4px;font-size:20px;color:#1a1d23">${escapeHtml(ev.name || "Sem nome")}</h2>
    <p style="margin:0 0 14px;color:#5b6472;font-size:13px">Novo lead${escapeHtml(repeatTxt)}</p>
    <table style="border-collapse:collapse;width:100%">
      ${row("WhatsApp", whatsLink ? `<a href="${whatsLink}" style="color:#2b6e62;font-weight:bold">${escapeHtml(phoneTxt)}</a>` : escapeHtml(phoneTxt))}
      ${row("Imóvel", escapeHtml(ev.property || "—"))}
      ${row("Origem", escapeHtml(ev.detail || "—"))}
      ${ev.extra ? row("Detalhes", escapeHtml(ev.extra)) : ""}
      ${row("Quando", escapeHtml(formatWhen(ev.at)))}
    </table>
    ${
      whatsLink
        ? `<a href="${whatsLink}" style="display:inline-block;margin-top:16px;background:#25d366;color:#fff;text-decoration:none;font-weight:bold;padding:10px 16px;border-radius:8px">Chamar no WhatsApp</a>`
        : ""
    }
    ${
      panelUrl
        ? `<a href="${escapeHtml(panelUrl)}" style="display:inline-block;margin:16px 0 0 8px;color:#2b6e62;font-weight:bold;padding:10px 4px;text-decoration:none">Abrir o painel &rarr;</a>`
        : ""
    }
  </div>
</div></body></html>`;

  return { subject, text, html };
}

function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !pass) {
    throw new Error("Faltam GMAIL_USER e/ou GMAIL_APP_PASSWORD nas variáveis de ambiente.");
  }
  return {
    user,
    transport: nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    }),
  };
}

/**
 * Verifica as duas planilhas e manda um e-mail por contato novo.
 * Na PRIMEIRA vez que cada planilha é lida com sucesso, só marca tudo o que
 * já existe como "avisado" (sem mandar e-mail) — pra não disparar centenas
 * de e-mails de leads antigos.
 */
export async function notifyNewLeads({ leads, loaded, panelUrl, maxEmails = 20 }) {
  const to = process.env.ALERT_EMAIL_TO;
  if (!to) throw new Error("Falta ALERT_EMAIL_TO nas variáveis de ambiente.");

  const db = getRedis();
  const events = leadsToContactEvents(leads);
  const result = { checked: events.length, seeded: 0, sent: 0, failed: 0, pending: 0, errors: [] };

  // 1ª execução de cada planilha: só registra o que já existe
  for (const origin of ["meta", "google"]) {
    if (!loaded[origin]) continue;
    const seeded = await db.get(SEEDED_KEY(origin));
    if (seeded) continue;
    const keys = events.filter((e) => e.origin === origin).map((e) => e.key);
    for (let i = 0; i < keys.length; i += 500) {
      const chunk = keys.slice(i, i + 500);
      if (chunk.length) await db.sadd(NOTIFIED_SET, ...chunk);
    }
    await db.set(SEEDED_KEY(origin), new Date().toISOString());
    result.seeded += keys.length;
  }

  // contatos ainda não avisados
  const sent = new Set(await db.smembers(NOTIFIED_SET));
  const fresh = events
    .filter((e) => loaded[e.origin] && !sent.has(e.key))
    .sort((a, b) => Date.parse(a.at || 0) - Date.parse(b.at || 0)); // mais antigo primeiro

  if (fresh.length === 0) return result;

  const { user, transport } = getTransport();
  const batch = fresh.slice(0, maxEmails);
  result.pending = fresh.length - batch.length; // ficam pra próxima rodada

  for (const ev of batch) {
    // "reserva" o contato antes de enviar: se duas rodadas se sobrepõem,
    // só uma consegue (sadd devolve 0 pra quem chegou depois)
    const claimed = await db.sadd(NOTIFIED_SET, ev.key);
    if (!claimed) continue;
    try {
      const { subject, text, html } = buildEmail(ev, panelUrl);
      await transport.sendMail({
        from: `"Painel de Leads" <${user}>`,
        to,
        subject,
        text,
        html,
      });
      result.sent += 1;
    } catch (err) {
      // devolve pra fila: tenta de novo na próxima rodada
      await db.srem(NOTIFIED_SET, ev.key);
      result.failed += 1;
      result.errors.push(err.message);
    }
  }

  return result;
}
