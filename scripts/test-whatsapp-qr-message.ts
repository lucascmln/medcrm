/**
 * TESTE — Simula mensagem WhatsApp QR recebida
 *
 * Envia uma requisição ao endpoint /api/webhooks/whatsapp-qr
 * simulando uma mensagem chegando via Evolution API.
 *
 * Uso:
 *   npx tsx scripts/test-whatsapp-qr-message.ts
 *
 * Variáveis (opcional, usa defaults para teste local):
 *   APP_BASE_URL   — URL da aplicação (default: http://localhost:3000)
 *   INSTANCE_NAME  — nome da instância (default: busca no banco)
 *   TEST_PHONE     — número de teste (default: +5511999887766)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APP_BASE_URL = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WEBHOOK_URL  = `${APP_BASE_URL}/api/webhooks/whatsapp-qr`;

async function main() {
  console.log("=== TESTE WhatsApp QR — Simulação de Mensagem ===\n");

  // Descobrir a instância registrada no banco
  const rows = await prisma.$queryRaw<any[]>`
    SELECT t.name as tenant_name, ti.external_id as instance_name, ti.tenant_id
    FROM tenant_integrations ti
    JOIN tenants t ON t.id = ti.tenant_id
    WHERE ti.provider = 'whatsapp_qr' AND ti.is_active = true
    ORDER BY ti.created_at DESC
    LIMIT 1
  `;

  if (!rows.length) {
    console.error("Nenhuma integração whatsapp_qr ativa encontrada no banco.");
    console.error("Crie a integração primeiro em Configurações → WhatsApp QR.");
    process.exit(1);
  }

  const { tenant_name, instance_name, tenant_id } = rows[0];
  const instanceName = process.env.INSTANCE_NAME ?? instance_name;
  const testPhone    = process.env.TEST_PHONE ?? "5511999887766";

  console.log(`Tenant:    ${tenant_name} (${tenant_id})`);
  console.log(`Instância: ${instanceName}`);
  console.log(`Webhook:   ${WEBHOOK_URL}`);
  console.log(`Telefone:  +${testPhone}`);
  console.log("");

  // ── 1. Mensagem de texto simples ────────────────────────────────────────────
  const payload = {
    event: "messages.upsert",
    instance: instanceName,
    data: {
      key: {
        remoteJid: `${testPhone}@s.whatsapp.net`,
        fromMe: false,
        id: `TESTE_${Date.now()}`,
      },
      pushName: "Paciente Teste QR",
      message: {
        conversation: "Olá, vim pelo WhatsApp! Gostaria de saber mais sobre harmonização facial.",
      },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
    destination: WEBHOOK_URL,
    date_time: new Date().toISOString(),
    sender: `${testPhone}@s.whatsapp.net`,
    server_url: "https://test-evolution-api.local",
    apikey: "test-key",
  };

  console.log("Enviando payload de teste...");

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await res.json();

  console.log(`\nResposta HTTP: ${res.status}`);
  console.log("Resultado:", JSON.stringify(result, null, 2));

  if (!res.ok && res.status !== 200) {
    console.error("\nFalha no webhook. Verifique os logs do servidor.");
    process.exit(1);
  }

  const leadId   = result.leadId;
  const created  = result.leadCreated ?? result.created;
  const phone    = result.phone ?? testPhone;

  if (!leadId) {
    console.warn("\nAviso: webhook não retornou leadId. Verifique se a instância está cadastrada e o tenant está ativo.");
    return;
  }

  console.log(`\n${created ? "✔ Lead CRIADO" : "✔ Lead ATUALIZADO"}: ${leadId}`);

  // ── 2. Valida no banco ──────────────────────────────────────────────────────
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      funnelStage: { select: { name: true } },
      source:      { select: { name: true } },
      history:     { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  if (!lead) {
    console.error("Lead não encontrado no banco após criação. Erro inesperado.");
    process.exit(1);
  }

  console.log("\n=== Dados do Lead ===");
  console.log(`  Nome:    ${lead.name}`);
  console.log(`  Telefone:${lead.phone}`);
  console.log(`  Etapa:   ${lead.funnelStage?.name ?? "—"}`);
  console.log(`  Origem:  ${lead.source?.name ?? "—"}`);
  console.log(`  Traffic: ${lead.trafficSource ?? "—"}`);

  console.log("\n=== Histórico recente ===");
  for (const h of lead.history) {
    console.log(`  [${h.createdAt.toLocaleString("pt-BR")}] ${h.action}: ${h.description?.slice(0, 80)}`);
  }

  const webhookEvt = await prisma.webhookEvent.findFirst({
    where: { source: "whatsapp-qr" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true },
  });

  console.log("\n=== WebhookEvent ===");
  if (webhookEvt) {
    console.log(`  id:     ${webhookEvt.id}`);
    console.log(`  status: ${webhookEvt.status}`);
    console.log(`  em:     ${webhookEvt.createdAt.toLocaleString("pt-BR")}`);
  } else {
    console.log("  Nenhum evento encontrado.");
  }

  console.log("\n=== Validação ===");
  console.log(`  Lead no banco:     ${lead ? "OK" : "FALHOU"}`);
  console.log(`  Etapa do funil:    ${lead.funnelStage?.name ? "OK" : "FALHOU"}`);
  console.log(`  Histórico:         ${lead.history.length > 0 ? "OK" : "FALHOU"}`);
  console.log(`  WebhookEvent:      ${webhookEvt ? "OK" : "nao encontrado"}`);
  console.log(`  TenantId correto:  ${lead.tenantId === tenant_id ? "OK" : "FALHOU"}`);

  console.log(`\nAcesse o lead em: ${APP_BASE_URL}/leads/${leadId}`);

  // ── 3. Segunda mensagem — testa deduplicação ─────────────────────────────────
  console.log("\n--- Testando deduplicação (mesmo telefone, 2ª mensagem) ---");
  const payload2 = {
    ...payload,
    data: {
      ...payload.data,
      key: { ...payload.data.key, id: `TESTE2_${Date.now()}` },
      message: { conversation: "Oi, é de novo! Quando vocês têm horário?" },
    },
  };

  const res2 = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload2),
  });
  const result2 = await res2.json();

  console.log(`  Lead criado (deve ser false): ${result2.created}`);
  console.log(`  Mesmo leadId: ${result2.leadId === leadId ? "OK" : "DIFERENTE — verificar deduplicação"}`);

  console.log("\n=== TESTE CONCLUÍDO ===\n");
}

main()
  .catch((e) => { console.error("ERRO:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
