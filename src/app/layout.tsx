import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedCrm Innove – Gestão de Leads para Clínicas",
  description: "Plataforma de CRM especializada para médicos e clínicas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
