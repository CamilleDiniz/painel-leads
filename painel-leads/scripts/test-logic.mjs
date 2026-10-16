import { extractProperty } from "../lib/property.js";
import { normalizePhone } from "../lib/phone.js";

const samples = [
  ["AD071 - Estático N84 - Santorni 1700k", "[LEADS - FORMS] - Santorini | Portinari | Royal Garden"],
  ["AD115E - CHAMADA DIRETA SANTORINI", "02-08 [LEADS] FORMS - PORTINARI / SANTORINI"],
  ["AD110E - N107 SOBRA PORTINARI 1900K", "02-08 [LEADS] FORMS - PORTINARI / SANTORINI"],
  ["AD122E - N129 ESTANCIA 1065K", "04/09 - [LEADS] - Casas Estância"],
  ["AD126E - N130 ACACIAS", "07/09 - [LEADS] - Casas Acacias"],
  ["Você não tem permissão suficiente. Consulte esta ajuda: https://www.facebook.com/business/help/766393076839635", ""],
];

console.log("--- extractProperty ---");
for (const [ad, camp] of samples) {
  console.log(JSON.stringify(extractProperty(ad, camp)));
}

console.log("\n--- normalizePhone ---");
for (const p of ["+5519982564543", "19974049848", "993103635", "+15918704813", "19987721402"]) {
  console.log(p, "->", JSON.stringify(normalizePhone(p)));
}

// --- Leads do Google (planilha do site) ---
import { extractGoogleProperty } from "../lib/property.js";
import { parseBRDateTime, googleLeadId } from "../lib/sheetsGoogle.js";

console.log("\n--- extractGoogleProperty ---");
const googleSamples = [
  { imovel: "Casa Térrea Alto Padrão", valor: "R$ 1.190.000", condominio: "Terras da Estância" },
  { imovel: "Lotes Residenciais", valor: "Residencial Mont Blanc", condominio: "" },
  { imovel: "Casa Térrea", valor: "", condominio: "" },
  { mensagem: "Olá Patrícia, tenho interesse em casas no La Dolce Vita em Paulínia" },
  { mensagem: "Olá Patrícia, gostaria de avaliar minha permuta!" },
  { mensagem: "Olá Patrícia, gostaria de saber mais sobre casas em condomínio em Paulínia!" },
  { mensagem: "Olá Patrícia, quero encontrar a casa ideal em Paulínia!" },
];
for (const s of googleSamples) console.log(JSON.stringify(extractGoogleProperty(s)));

console.log("\n--- parseBRDateTime / googleLeadId ---");
for (const d of ["25/03/2026, 14:02", "01/06/2026, 16:00", "texto estranho"]) {
  console.log(d, "->", parseBRDateTime(d));
}
const a = { dataHora: "14/04/2026, 08:13", telefone: "19993054393", origem: "Sobre a Corretora" };
console.log("linha repetida gera mesmo id:", googleLeadId(a) === googleLeadId({ ...a, nome: "outro" }));
console.log("+55 19 98330-8903 ->", JSON.stringify(normalizePhone("+55 19 98330-8903")));

console.log("\n--- groupGoogleRows (um card por pessoa) ---");
import { groupGoogleRows } from "../lib/sheetsGoogle.js";
const rows = [
  ["09/05/2026, 17:52", "Valdecir", "14998331780", "Página Inicial - Hero", "", "", "", "casas em condomínio"],
  ["24/05/2026, 10:53", "valdecir", "14998331780", "Botão Flutuante WhatsApp", "", "", "", "casas em condomínio"],
  ["28/05/2026, 14:42", "valdecir", "14998331780", "Página Inicial - Hero", "", "", "", "casas em condomínio"],
  ["06/07/2026, 20:19", "Aline", "19992278001", "Casa", "Lotes Residenciais", "Residencial Mont Blanc", "", "x"],
  ["06/07/2026, 20:19", "Aline", "19992278001", "Casa", "Lotes Residenciais", "Residencial Mont Blanc", "", "x"],
  ["06/07/2026, 20:19", "Aline", "19992278001", "Casa", "Lotes Residenciais", "Terrassos Residencial", "", "x"],
  ["18/05/2026, 11:07", "Camila Oliveira da Silveira Braga", "19992548873", "Casa", "Casa Térrea Alto Padrão", "R$ 1.218.000", "", "x"],
  ["01/07/2026, 13:19", "Camila Oliveira da Silveira Braga", "19992548873", "Botão Flutuante WhatsApp", "", "", "", "Olá Patrícia, gostaria de saber mais sobre casas em condomínio em Paulínia!"],
].map(([dataHora, nome, telefone, origem, imovel, valor, condominio, mensagem]) => ({
  dataHora, nome, telefone, origem, imovel, valor, condominio, mensagem, createdTime: parseBRDateTime(dataHora),
}));
for (const g of groupGoogleRows(rows)) {
  console.log(g.nome, "|", g.contacts, "contatos |", g.origens.join(" + "), "|", g.firstContact, "->", g.createdTime,
    "|", [...new Set(g.entries.map((e) => extractGoogleProperty(e).label))].join(" | "));
}
