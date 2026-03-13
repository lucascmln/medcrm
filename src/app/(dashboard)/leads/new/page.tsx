"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LeadFormModal } from "@/components/leads/LeadFormModal";

export default function NewLeadPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <div className="p-6">
      <button
        onClick={() => router.push("/leads")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para Leads
      </button>

      <LeadFormModal
        open={open}
        onClose={() => { setOpen(false); router.push("/leads"); }}
        onSuccess={() => router.push("/leads")}
      />
    </div>
  );
}
