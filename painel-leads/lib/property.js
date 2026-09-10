// Extrai o nome do empreendimento/imóvel a partir do nome do anúncio (ad_name).
// Os nomes de anúncio seguem padrões como:
//   "AD071 - Estático N84 - Santorni 1700k"
//   "AD115E - CHAMADA DIRETA SANTORINI"
//   "AD122E - N129 ESTANCIA 1065K"
//   "AD126E - N130 ACACIAS"
//
// Não há um padrão 100% fixo, então usamos uma lista de empreendimentos
// conhecidos (com variações/erros de digitação comuns) e procuramos por eles
// dentro do texto do anúncio. Se nada bater, devolvemos o próprio ad_name
// "limpo" como fallback, pra nunca deixar o campo vazio.

const KNOWN_PROPERTIES = [
  { match: ["santorini", "santorni"], label: "Santorini" },
  { match: ["portinari"], label: "Portinari" },
  { match: ["royal garden"], label: "Royal Garden" },
  { match: ["estancia", "estância"], label: "Casas Estância" },
  { match: ["acacias", "acácias"], label: "Casas Acácias" },
];

function stripAccents(str) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function findKnownProperty(text) {
  const source = stripAccents(text || "").toLowerCase();
  for (const property of KNOWN_PROPERTIES) {
    if (property.match.some((needle) => source.includes(needle))) {
      return property.label;
    }
  }
  return null;
}

export function extractProperty(adName, campaignName) {
  const combined = `${adName || ""} ${campaignName || ""}`;

  // Anúncio com erro de permissão do Meta na integração — não dá pra confiar
  // no texto, então sinalizamos claramente em vez de mostrar a mensagem de erro.
  if (
    combined.toLowerCase().includes("permiss") &&
    combined.toLowerCase().includes("facebook.com")
  ) {
    return { label: "Não identificado", uncertain: true };
  }

  // Prioriza o nome do PRÓPRIO anúncio (ad_name) — o campaign_name às vezes
  // lista vários empreendimentos juntos (ex: "PORTINARI / SANTORINI") e
  // pegaria o nome errado se olhássemos ele primeiro.
  const fromAdName = findKnownProperty(adName);
  if (fromAdName) return { label: fromAdName, uncertain: false };

  const fromCampaign = findKnownProperty(campaignName);
  if (fromCampaign) return { label: fromCampaign, uncertain: false };

  // Fallback: usa o nome do anúncio "limpo" (tira o prefixo "ADxxx - ")
  const cleaned = (adName || campaignName || "")
    .replace(/^AD\S*\s*-\s*/i, "")
    .trim();

  return {
    label: cleaned || "Não identificado",
    uncertain: !cleaned,
  };
}
