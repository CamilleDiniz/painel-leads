import "./globals.css";

export const metadata = {
  title: "Painel de Leads",
  description: "CRM Kanban de leads imobiliários, alimentado pela planilha de Ads.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
