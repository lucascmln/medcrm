/**
 * /api/cron/cleanup-webhooks
 *
 * Cron job para apagar WebhookEvents com mais de 30 dias.
 * Configurado no vercel.json para rodar diariamente às 03:00 UTC.
 *
 * Autenticação: Vercel injeta automaticamente
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * Referência: https://vercel.com/docs/cron-jobs/manage-cron-jobs
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60; // segundos

export async function GET(req: NextRequest) {
  // Valida autorização — Vercel injeta CRON_SECRET automaticamente
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[cron/cleanup-webhooks] Requisição não autorizada — header inválido");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30); // 30 dias atrás

  console.log(`[cron/cleanup-webhooks] Iniciando limpeza — removendo eventos anteriores a ${cutoff.toISOString()}`);

  try {
    // Deleta WebhookEvents antigos em lotes para não travar o banco
    const deleted = await prisma.$executeRaw`
      DELETE FROM webhook_events
      WHERE created_at < ${cutoff}
        AND status IN ('PROCESSED', 'ERROR')
    `;

    console.log(`[cron/cleanup-webhooks] Concluído — ${deleted} evento(s) removido(s)`);

    return NextResponse.json({
      success: true,
      deletedCount: Number(deleted),
      cutoffDate: cutoff.toISOString(),
      ranAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[cron/cleanup-webhooks] Erro ao limpar eventos:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
