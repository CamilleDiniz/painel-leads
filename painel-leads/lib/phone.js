// Normaliza o número do WhatsApp vindo da planilha pra sempre gerar um link
// wa.me válido. Trata os casos observados nos dados reais:
//   "+5519982564543"  -> já ok
//   "19974049848"     -> sem "+", mas já com DDI 55 embutido
//   "993103635"       -> sem DDI nenhum (assume Brasil, DDD desconhecido)

export function normalizePhone(raw) {
  if (!raw) return { e164: null, display: "", valid: false };

  const digits = String(raw).replace(/\D/g, "");

  if (!digits) return { e164: null, display: raw, valid: false };

  let withCountry = digits;

  if (digits.startsWith("55") && digits.length >= 12) {
    withCountry = digits; // já tem DDI 55
  } else if (digits.length === 10 || digits.length === 11) {
    withCountry = `55${digits}`; // DDD + número, sem DDI
  } else if (digits.length < 10) {
    // Número incompleto (sem DDD reconhecível) — não dá pra confiar no link.
    return { e164: null, display: raw, valid: false };
  }

  const display = formatBRDisplay(withCountry);
  return { e164: withCountry, display, valid: true };
}

function formatBRDisplay(withCountry) {
  // withCountry: 55 + DDD (2) + número (8 ou 9)
  const rest = withCountry.slice(2);
  const ddd = rest.slice(0, 2);
  const number = rest.slice(2);
  if (number.length === 9) {
    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }
  if (number.length === 8) {
    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }
  return `(${ddd}) ${number}`;
}
