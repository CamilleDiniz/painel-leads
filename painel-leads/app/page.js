"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

const COLUMNS = [
  { key: "novo", title: "Novos leads" },
  { key: "visita", title: "Visita agendada" },
  { key: "followup", title: "Follow-up" },
  { key: "acompanhamento", title: "Acompanhamento" },
];

const REFRESH_MS = 45000; // reforço de atualização enquanto a página está aberta

function WhatsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M17.5 14.4c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.6.1-.2.3-.7 1-.9 1.2-.1.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.5-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.5.1-.2 0-.4 0-.5C10.2 9 9.7 7.8 9.5 7.3c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3 4.8 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.6-.4Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.5 2 2 6.4 2 11.9c0 1.9.5 3.6 1.5 5.2L2 22l5.1-1.3c1.5.8 3.2 1.3 4.9 1.3 5.5 0 10-4.4 10-9.9C22 6.4 17.5 2 12 2Zm0 18.1c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3c-.9-1.4-1.4-3-1.4-4.6 0-4.6 3.8-8.4 8.5-8.4 4.7 0 8.5 3.7 8.5 8.4 0 4.6-3.8 8.4-8.5 8.4Z" fill="currentColor" />
    </svg>
  );
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function PainelPage() {
  const [tab, setTab] = useState("kanban");
  const [leads, setLeads] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar leads.");
      setLeads(data.leads);
      setFetchedAt(data.fetchedAt);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  async function patchCard(id, patch) {
    setSavingId(id);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    try {
      await fetch("/api/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id, ...patch }),
      });
    } finally {
      setSavingId(null);
    }
  }

  function toggleFup(lead, n) {
    const next = lead.fup === n ? n - 1 : n;
    patchCard(lead.id, { fup: next });
  }

  function markLost(lead) {
    const reason = window.prompt(
      `Motivo de "${lead.name}" ter sido perdido (aparece na aba Perdidos):`,
      lead.lostReason || ""
    );
    if (reason === null) return;
    patchCard(lead.id, { status: "perdido", lostReason: reason });
  }

  const activeLeads = useMemo(
    () => (leads || []).filter((l) => l.status !== "perdido"),
    [leads]
  );
  const lostLeads = useMemo(
    () => (leads || []).filter((l) => l.status === "perdido"),
    [leads]
  );

  const counts = useMemo(() => {
    const c = { novo: 0, visita: 0, followup: 0, acompanhamento: 0 };
    activeLeads.forEach((l) => {
      if (c[l.status] !== undefined) c[l.status] += 1;
    });
    return c;
  }, [activeLeads]);

  const funnel = useMemo(() => {
    const total = leads ? leads.length : 0;
    const iniciadas = activeLeads.length + lostLeads.length; // toda planilha = conversa iniciada
    return {
      total,
      iniciadas,
      followup: counts.followup,
      acompanhamento: counts.acompanhamento,
      perdidos: lostLeads.length,
    };
  }, [leads, activeLeads, lostLeads, counts]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">D</div>
          <div>
            <h1>Painel de Leads</h1>
            <div className="tagline">alimentado pela planilha de Ads &middot; leitura automática</div>
          </div>
        </div>
        <div className="topbar-right">
          <button className="refresh-btn" onClick={load}>Atualizar agora</button>
          <div className="sync-pill">
            <span className={`sync-dot ${error ? "stale" : ""}`}></span>
            {error ? "Erro ao sincronizar" : `Sincronizado ${timeAgo(fetchedAt)}`}
          </div>
        </div>
      </header>

      {error && (
        <div className="notice">
          <span>&#9888;</span>
          <div>
            <b>Não consegui ler a planilha agora.</b> {error} — os dados mostrados abaixo (se houver) são da última sincronização bem-sucedida.
          </div>
        </div>
      )}

      <nav className="tabs">
        <button className={tab === "kanban" ? "active" : ""} onClick={() => setTab("kanban")}>
          Kanban <span className="count">{activeLeads.length}</span>
        </button>
        <button className={tab === "perdidos" ? "active" : ""} onClick={() => setTab("perdidos")}>
          Perdidos <span className="count">{lostLeads.length}</span>
        </button>
        <button className={tab === "funil" ? "active" : ""} onClick={() => setTab("funil")}>
          Funil
        </button>
        <button className={tab === "config" ? "active" : ""} onClick={() => setTab("config")}>
          Configurações
        </button>
      </nav>

      {leads === null && !error && <div className="loading-state">Carregando leads da planilha…</div>}

      {tab === "kanban" && leads !== null && (
        <section>
          <div className="view-head">
            <div>
              <h2>Kanban de leads</h2>
              <p>Novos leads chegam automaticamente da planilha na coluna “Novos leads”. Mova o card conforme o atendimento avança.</p>
            </div>
          </div>
          <div className="board">
            {COLUMNS.map((col) => {
              const items = activeLeads.filter((l) => l.status === col.key);
              return (
                <div className="col" key={col.key}>
                  <div className="col-head">
                    <div className="col-title">
                      <span className={`status-dot dot-${col.key}`}></span>
                      <h3>{col.title}</h3>
                    </div>
                    <span className="col-count">{items.length}</span>
                  </div>
                  <div className="cards">
                    {items.length === 0 && <div className="col-empty">Nenhum lead aqui.</div>}
                    {items.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        saving={savingId === lead.id}
                        onMove={(status) => patchCard(lead.id, { status })}
                        onToggleFup={(n) => toggleFup(lead, n)}
                        onSummaryChange={(summary) => patchCard(lead.id, { summary })}
                        onMarkLost={() => markLost(lead)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "perdidos" && leads !== null && (
        <section>
          <div className="view-head">
            <div>
              <h2>Leads perdidos</h2>
              <p>Saem do Kanban ativo para não poluir o board, mas continuam contando na métrica de perdas do Funil.</p>
            </div>
          </div>
          <div className="table-card">
            {lostLeads.length === 0 ? (
              <div className="empty-state">Nenhum lead perdido até agora.</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Nome</th><th>Telefone</th><th>Imóvel</th><th>Motivo</th><th>Perdido em</th><th></th></tr>
                </thead>
                <tbody>
                  {lostLeads.map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td className="table-phone">{l.phone.display || "—"}</td>
                      <td>{l.property}</td>
                      <td>{l.lostReason || "—"}</td>
                      <td className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{formatDate(l.updatedAt)}</td>
                      <td>
                        <button className="lost-link" style={{ color: "var(--accent)" }} onClick={() => patchCard(l.id, { status: "novo", lostReason: "" })}>
                          Reabrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {tab === "funil" && leads !== null && (
        <section>
          <div className="view-head">
            <div>
              <h2>Funil comercial</h2>
              <p>Métricas calculadas em tempo real a partir dos leads atuais da planilha.</p>
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat-tile"><div className="label">Conversas iniciadas</div><div className="num">{funnel.iniciadas}</div></div>
            <div className="stat-tile"><div className="label">Em follow-up</div><div className="num">{funnel.followup}</div></div>
            <div className="stat-tile"><div className="label">Em acompanhamento</div><div className="num">{funnel.acompanhamento}</div></div>
            <div className="stat-tile"><div className="label">Perdas</div><div className="num">{funnel.perdidos}</div></div>
          </div>
        </section>
      )}

      {tab === "config" && (
        <section>
          <div className="view-head">
            <div>
              <h2>Configurações</h2>
              <p>Status da conexão com a planilha de origem dos leads.</p>
            </div>
          </div>
          <div className="config-card">
            <div className="config-row">
              <span className="k">Status da conexão</span>
              {error ? <span className="v status-bad">Erro na última leitura</span> : <span className="v status-ok"><span className="sync-dot"></span> Conectado</span>}
            </div>
            <div className="config-row">
              <span className="k">Última sincronização</span>
              <span className="v mono">{fetchedAt ? new Date(fetchedAt).toLocaleString("pt-BR") : "—"}</span>
            </div>
            <div className="config-row">
              <span className="k">Frequência de checagem</span>
              <span className="v">A cada abertura da página + a cada 45s automaticamente</span>
            </div>
            <div className="config-row">
              <span className="k">Total de leads na planilha</span>
              <span className="v mono">{leads ? leads.length : "—"}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function LeadCard({ lead, saving, onMove, onToggleFup, onSummaryChange, onMarkLost }) {
  const [summaryDraft, setSummaryDraft] = useState(lead.summary || "");

  useEffect(() => setSummaryDraft(lead.summary || ""), [lead.id]);

  return (
    <div className="card" style={{ opacity: saving ? 0.7 : 1 }}>
      <div className="card-top">
        <div>
          <div className="card-name">{lead.name || "Sem nome"}</div>
          <div className="card-source">{lead.source}</div>
        </div>
      </div>

      {lead.phone.valid ? (
        <a className="whats-btn" href={`https://wa.me/${lead.phone.e164}`} target="_blank" rel="noopener noreferrer">
          <WhatsIcon /><span>{lead.phone.display}</span><span className="go">abrir &rarr;</span>
        </a>
      ) : (
        <div className="whats-btn disabled">
          <WhatsIcon /><span>número incompleto</span>
        </div>
      )}

      <div className="card-meta">
        <div className="meta-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
          <span className={`val ${lead.propertyUncertain ? "warn" : ""}`}>{lead.property}</span>
        </div>
        <div className="meta-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M7 3v3M17 3v3M3.5 9h17M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" /></svg>
          <span className="date">Contato: {formatDate(lead.createdAt)}</span>
        </div>
        {(lead.formAnswers.porOnde || lead.formAnswers.prazo) && (
          <div className="meta-row">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M12 3v9l6 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <span className="val">{[lead.formAnswers.porOnde, lead.formAnswers.prazo].filter(Boolean).join(" · ")}</span>
        </div>
        )}
      </div>

      <div className="fup-row">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className={`fup ${n <= lead.fup ? "done" : ""}`} onClick={() => onToggleFup(n)}>
            FUP {n}
          </div>
        ))}
      </div>

      <div className="summary">
        <span className="summary-label">Resumo da conversa</span>
        <textarea
          placeholder="Ex: conversei com ele, tem uma casa pra vender antes de comprar outra…"
          value={summaryDraft}
          onChange={(e) => setSummaryDraft(e.target.value)}
          onBlur={() => { if (summaryDraft !== lead.summary) onSummaryChange(summaryDraft); }}
        />
      </div>

      <div className="card-actions">
        <select className="move-select" value={lead.status} onChange={(e) => onMove(e.target.value)}>
          <option value="novo">Novos leads</option>
          <option value="visita">Visita agendada</option>
          <option value="followup">Follow-up</option>
          <option value="acompanhamento">Acompanhamento</option>
        </select>
        <button className="lost-link" onClick={onMarkLost}>Marcar perdido</button>
      </div>
    </div>
  );
}
