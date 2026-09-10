// Mostra o nome do imóvel exatamente como está no campo ad_name da planilha
// — é por esse nome (ex: "AD122E - N129 ESTANCIA 1065K") que o corretor
// reconhece de qual imóvel/anúncio o lead veio, então não simplificamos.

export function extractProperty(adName, campaignName) {
  const raw = (adName || campaignName || "").trim();

  // Anúncio com erro de permissão do Meta na integração — não dá pra confiar
  // no texto, então sinalizamos claramente em vez de mostrar a mensagem de erro.
  if (raw.toLowerCase().includes("permiss") && raw.toLowerCase().includes("facebook.com")) {
    return { label: "Não identificado", uncertain: true };
  }

  if (!raw) {
    return { label: "Não identificado", uncertain: true };
  }

  return { label: raw, uncertain: false };
}
