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

// ---------------------------------------------------------------------------
// Leads do Google (planilha do site): o imóvel vem em colunas separadas
// (Imóvel, Valor, Condomínio). Montamos um rótulo legível, ex:
//   "Casa Térrea Alto Padrão · Terras da Estância · R$ 1.190.000"
// Particularidade da planilha: em "Lotes Residenciais" o nome do
// empreendimento vem na coluna Valor (ex: "Residencial Mont Blanc"), então
// só tratamos Valor como preço quando começa com "R$".
// Quando o lead veio de um botão genérico do site (sem imóvel), usamos a
// mensagem pra dizer o que a pessoa procura.

export function extractGoogleProperty({ imovel, valor, condominio, mensagem } = {}) {
  const tipo = (imovel || "").trim();
  const valorTxt = (valor || "").trim();
  const isPrice = /^r\$/i.test(valorTxt);
  const empreendimento = (condominio || "").trim() || (!isPrice ? valorTxt : "");
  const preco = isPrice ? valorTxt : "";

  if (tipo || empreendimento) {
    const label = [tipo, empreendimento, preco].filter(Boolean).join(" · ");
    return { label, uncertain: false };
  }

  const msg = (mensagem || "").trim();
  if (/permuta/i.test(msg)) {
    return { label: "Avaliação de permuta", uncertain: false };
  }
  const noLocal = msg.match(/interesse em casas no ([^!.]+?) em Paul[ií]nia/i);
  if (noLocal) {
    return { label: `Casas no ${noLocal[1].trim()}`, uncertain: false };
  }
  if (/condom[ií]nio/i.test(msg)) {
    return { label: "Interesse geral · casas em condomínio", uncertain: false };
  }
  return { label: "Interesse geral (site)", uncertain: false };
}
