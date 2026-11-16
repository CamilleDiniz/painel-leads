// Filtro de data do painel. Tudo no horário de Brasília (America/Sao_Paulo),
// comparando só o DIA (AAAA-MM-DD), pra "Hoje" ser o hoje da corretora e não
// o do servidor ou do navegador.

const TZ = "America/Sao_Paulo";
const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const PERIOD_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "custom", label: "Personalizado" },
];

/** Data (ISO ou Date) -> "AAAA-MM-DD" no horário de Brasília. null se inválida. */
export function dayKey(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return dayFmt.format(d); // en-CA já sai como AAAA-MM-DD
}

/** Soma dias a um "AAAA-MM-DD" (sem depender de fuso). */
export function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/**
 * Devolve { from, to } (dias inclusivos, "AAAA-MM-DD") para o período, ou null
 * para "Todos". "7 dias" = hoje + 6 dias anteriores.
 */
export function periodRange(period, custom = {}, now = new Date()) {
  const today = dayKey(now);
  switch (period) {
    case "hoje":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "mes":
      return { from: today.slice(0, 8) + "01", to: today };
    case "custom": {
      let { from, to } = custom;
      if (!from && !to) return null;
      if (from && to && from > to) [from, to] = [to, from];
      return { from: from || "0000-01-01", to: to || "9999-12-31" };
    }
    default:
      return null;
  }
}

/** O lead (pela data de chegada) está dentro do período? */
export function inRange(createdAt, range) {
  if (!range) return true;
  const k = dayKey(createdAt);
  if (!k) return false; // sem data válida não entra em período nenhum
  return k >= range.from && k <= range.to;
}
