import { WhatsAppInboxPage } from "@/components/whatsapp/WhatsAppInboxPage";

export const metadata = {
  title: "Mensagens WhatsApp | InnoveCRM",
};

export default function Page() {
  return (
    <div className="h-full min-h-0">
      <WhatsAppInboxPage />
    </div>
  );
}
