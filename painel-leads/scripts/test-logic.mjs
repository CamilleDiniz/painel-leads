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
