/**
 * webhook-processors.ts
 *
 * Funções de processamento assíncrono para webhooks de Meta Lead Ads e WhatsApp.
 * Os endpoints recebem o payload, salvam o evento bruto e chamam essas funções.
 *
 * Estado atual: preparado para integração futura.
 * TODOs marcados indicam o que será necessário ao conectar no Meta Developers.
 */

import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de payload (baseados na documentação oficial do Meta)
// ─────────────────────────────────────────────────────────────────────────────

interface MetaLeadgenChange {
  field: string;
  value: {
    ad_id?: string;
    ad_name?: string;
    adset_id?: string;
    adset_name?: string;
    campaign_id?: string;
    campaign_name?: string;
    form_id?: string;
    leadgen_id?: string;
    created_time?: number;
    page_id?: string;
  };
}

interface MetaLeadPayload {
  object: string;
  entry: Array<{
    id: string;       // page_id
    time: number;
    changes: MetaLeadgenChange[];
  }>;
}

interface WhatsAppMessage {
  from: string;      // wa_id (número sem +)
  id: string;        // wamid...
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppChange {
  field: string;
  value: {
    messaging_product: string;
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: Array<{ profile: { name: string }; wa_id: string }>;
    messages?: WhatsAppMessage[];
    statuses?: Array<{ id: string; status: string; timestamp: string; recipient_id: string }>;
  };
}

interface WhatsAppPayload {
  object: string;
  entry: Array<{
    id: string;       // whatsapp_business_account_id
    changes: WhatsAppChange[];
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza número de telefone: remove tudo que não é dígito.
 * Para comparação, usa os últimos 11 dígitos (padrão BR: 11 + número).
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Formata número WhatsApp para o padrão do sistema.
 * wa_id vem sem "+", ex: "5511987654321" → "+55 (11) 98765-4321" não — apenas guarda como está.
 */
function formatWhatsAppPhone(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  // Retorna com + para consistência com formulários internacionais
  return `+${digits}`;
}

/**
 * Marca o evento como processado ou com erro.
 * Usa $executeRaw para funcionar mesmo se o Prisma Client não foi regenerado
 * após o db push (mesma estratégia do tracking).
 */
async function markEventProcessed(eventId: string) {
  await prisma.$executeRaw`
    UPDATE webhook_events
    SET status = 'PROCESSED', processed_at = NOW()
    WHERE id = ${eventId}
  `;
}

async function markEventError(eventId: string, errorMessage: string) {
  const truncated = errorMessage.slice(0, 500);
  await prisma.$executeRaw`
    UPDATE webhook_events
    SET status = 'ERROR', error = ${truncated}
    WHERE id = ${eventId}
  `;
}

async function markEventPending(eventId: string, reason: string) {
  await prisma.$executeRaw`
    UPDATE webhook_events
    SET status = ${reason}
    WHERE id = ${eventId}
  `;
}

/**
 * Resolve o tenant a partir do externalId (page_id ou phone_number_id).
 * Consulta a tabela tenant_integrations — vazia até que você registre as integrações.
 *
 * TODO (fase conectar): no painel admin, criar uma tela para vincular
 *   página Meta / número WhatsApp ao tenant correto.
 */
async function resolveTenantByIntegration(
  provider: "meta" | "whatsapp",
  externalId: string
): Promise<string | null> {
  try {
    const result = await prisma.$queryRaw<Array<{ tenant_id: string }>>`
      SELECT tenant_id FROM tenant_integrations
      WHERE provider = ${provider}
        AND external_id = ${externalId}
        AND is_active = true
      LIMIT 1
    `;
    return result[0]?.tenant_id ?? null;
  } catch (err: any) {
    console.warn(`[webhook] resolveTenant(${provider}, ${externalId}) failed:`, err.message);
    return null;
  }
}

/**
 * Encontra ou cria um lead por telefone dentro do tenant.
 * Evita duplicação comparando os últimos 11 dígitos do número.
 */
async function findOrCreateLeadByPhone(
  tenantId: string,
  phone: string,
  data: {
    name?: string;
    sourceId?: string;
    trafficSource?: string;
    observations?: string;
    utmSource?: string;
    utmCampaign?: string;
  }
): Promise<{ lead: { id: string; name: string }; created: boolean }> {
  const digits = normalizePhone(phone);
  const tail11 = digits.slice(-11); // últimos 11 dígitos BR

  // Busca por correspondência exata ou pelos últimos 11 dígitos
  const existing = await prisma.lead.findFirst({
    where: {
      tenantId,
      OR: [
        { phone },
        ...(tail11.length === 11 ? [{ phone: { endsWith: tail11 } }] : []),
      ],
    },
    select: { id: true, name: true },
  });

  if (existing) {
    // Atualiza última interação sem criar duplicata
    await prisma.$executeRaw`
      UPDATE leads SET last_interaction_at = NOW() WHERE id = ${existing.id}
    `;
    console.log(`[webhook] Lead existente encontrado: ${existing.id} (${existing.name})`);
    return { lead: existing, created: false };
  }

  // Busca estágio padrão do funil
  const defaultStage =
    (await prisma.funnelStage.findFirst({
      where: { tenantId, isDefault: true },
      orderBy: { order: "asc" },
    })) ??
    (await prisma.funnelStage.findFirst({
      where: { tenantId },
      orderBy: { order: "asc" },
    }));

  if (!defaultStage) {
    throw new Error(`Nenhuma etapa de funil configurada para tenant ${tenantId}`);
  }

  const lead = await prisma.lead.create({
    data: {
      tenantId,
      name: data.name ?? "Contato via Webhook",
      phone,
      sourceId: data.sourceId ?? null,
      observations: data.observations ?? null,
      funnelStageId: defaultStage.id,
    },
    select: { id: true, name: true },
  });

  // Aplica trafficSource e UTMs via raw SQL (schema-agnostic)
  const ts = data.trafficSource ?? "DIRECT";
  const utmSrc = data.utmSource ?? null;
  const utmCamp = data.utmCampaign ?? null;
  await prisma.$executeRaw`
    UPDATE leads
    SET traffic_source = ${ts},
        utm_source     = ${utmSrc},
        utm_campaign   = ${utmCamp}
    WHERE id = ${lead.id}
  `;

  console.log(`[webhook] Novo lead criado: ${lead.id} (${lead.name})`);
  return { lead, created: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// processMetaLeadWebhook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processa um evento de Meta Lead Ads.
 *
 * Fluxo completo (quando conectado):
 *  1. Parse entry/changes do tipo "leadgen"
 *  2. Resolve tenant pelo page_id via TenantIntegration
 *  3. Chama GET /{leadgen_id}?fields=...&access_token=... na Graph API
 *     para obter nome, telefone, email e campos do formulário
 *  4. Cria/atualiza lead por telefone
 *
 * Estado atual: passos 1 e 2 implementados.
 * Passos 3 e 4 marcados como TODO — serão ativados ao cadastrar a URL pública.
 */
export async function processMetaLeadWebhook(
  eventId: string,
  body: MetaLeadPayload
): Promise<void> {
  console.log(`[meta-leads] Processando evento ${eventId}`);

  const leadgenNotifications: Array<{
    pageId: string;
    leadgenId: string;
    formId?: string;
    adId?: string;
    campaignId?: string;
  }> = [];

  // Extrai todas as notificações de leadgen do payload
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") {
        console.log(`[meta-leads] Ignorando change de campo: ${change.field}`);
        continue;
      }
      const v = change.value;
      if (!v.leadgen_id) {
        console.warn(`[meta-leads] change leadgen sem leadgen_id — ignorando`);
        continue;
      }
      leadgenNotifications.push({
        pageId: v.page_id ?? entry.id,
        leadgenId: v.leadgen_id,
        formId: v.form_id,
        adId: v.ad_id,
        campaignId: v.campaign_id,
      });
    }
  }

  if (leadgenNotifications.length === 0) {
    console.log(`[meta-leads] Nenhuma notificação leadgen encontrada no payload`);
    await markEventProcessed(eventId);
    return;
  }

  console.log(`[meta-leads] ${leadgenNotifications.length} notificação(ões) leadgen:`, leadgenNotifications);

  // Processa cada notificação
  for (const notif of leadgenNotifications) {
    // 1. Resolve o tenant pelo page_id
    const tenantId = await resolveTenantByIntegration("meta", notif.pageId);

    if (!tenantId) {
      console.warn(
        `[meta-leads] Tenant não encontrado para page_id "${notif.pageId}". ` +
        `TODO: registrar integração em TenantIntegration (provider=meta, externalId=${notif.pageId})`
      );
      await markEventPending(eventId, "PENDING_TENANT");
      continue;
    }

    // 2. Busca dados do lead via Meta Graph API (usando access_token da integração)
    const integration = await prisma.$queryRaw<Array<{ config: string | null }>>`
      SELECT config FROM tenant_integrations
      WHERE provider = 'meta'
        AND external_id = ${notif.pageId}
        AND is_active = true
      LIMIT 1
    `;

    const config = integration[0]?.config ? JSON.parse(integration[0].config) : {};
    const accessToken: string | undefined = config.accessToken;

    if (!accessToken) {
      console.warn(
        `[meta-leads] Sem access_token para page_id "${notif.pageId}" — ` +
        `cadastre o token na tela de Integrações. Marcando como PENDING_GRAPH_API.`
      );
      await markEventPending(eventId, "PENDING_GRAPH_API");
      continue;
    }

    // Chama Graph API para obter os dados do formulário
    let phone: string | undefined;
    let name: string | undefined;
    let email: string | undefined;
    let procedure: string | undefined;

    try {
      const graphUrl =
        `https://graph.facebook.com/v20.0/${notif.leadgenId}` +
        `?fields=id,created_time,field_data&access_token=${encodeURIComponent(accessToken)}`;

      const graphRes = await fetch(graphUrl);
      const leadData = await graphRes.json();

      if (leadData.error) {
        console.error(`[meta-leads] Graph API error:`, leadData.error);
        await markEventError(eventId, `Graph API: ${leadData.error.message}`);
        continue;
      }

      // Normaliza os campos do formulário (nomes variam por cliente)
      const fields: Record<string, string> = {};
      for (const f of leadData.field_data ?? []) {
        fields[f.name.toLowerCase()] = f.values?.[0] ?? "";
      }

      phone     = fields["phone_number"] || fields["telefone"] || fields["phone"] || fields["whatsapp"];
      name      = fields["full_name"] || fields["nome"] || fields["name"] || fields["nome_completo"];
      email     = fields["email"];
      procedure = fields["procedimento"] || fields["procedure"] || fields["interesse"] || fields["interest"];

      console.log(`[meta-leads] Graph API → leadgen ${notif.leadgenId}:`, { name, phone, email, procedure });
    } catch (err: any) {
      console.error(`[meta-leads] Falha ao chamar Graph API:`, err.message);
      await markEventError(eventId, `Graph API fetch failed: ${err.message}`);
      continue;
    }

    if (!phone) {
      console.warn(`[meta-leads] leadgen_id=${notif.leadgenId} sem telefone — salvando evento como PROCESSED sem criar lead`);
      await markEventProcessed(eventId);
      continue;
    }

    // 3. Cria ou atualiza o lead no tenant
    try {
      const { lead, created } = await findOrCreateLeadByPhone(tenantId, phone, {
        name,
        trafficSource: "META_ADS",
        utmSource:   "facebook",
        utmCampaign: notif.campaignId,
        observations: email ? `E-mail: ${email}` : undefined,
      });

      // Se o lead foi criado, preenche campos adicionais
      if (created) {
        if (procedure || email || notif.adId) {
          await prisma.$executeRaw`
            UPDATE leads SET
              procedure  = COALESCE(${procedure ?? null}, procedure),
              email      = COALESCE(${email ?? null}, email),
              fbclid     = COALESCE(${notif.adId ?? null}, fbclid)
            WHERE id = ${lead.id}
          `;
        }

        // Registra histórico
        await prisma.leadHistory.create({
          data: {
            leadId:      lead.id,
            action:      "META_LEAD_ADS",
            description: `Lead recebido via Meta Lead Ads` +
              (notif.formId    ? ` · Form: ${notif.formId}`       : "") +
              (notif.campaignId ? ` · Campanha: ${notif.campaignId}` : ""),
          },
        });
      }

      console.log(`[meta-leads] Lead ${created ? "criado" : "atualizado"}: ${lead.id} (${lead.name})`);
    } catch (err: any) {
      console.error(`[meta-leads] Erro ao criar lead:`, err.message);
      await markEventError(eventId, err.message);
      continue;
    }

    await markEventProcessed(eventId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// processWhatsAppWebhook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processa um evento do WhatsApp Cloud API.
 *
 * Fluxo:
 *  1. Parse entry/changes do tipo "messages"
 *  2. Resolve tenant pelo phone_number_id via TenantIntegration
 *  3. Para cada mensagem recebida, cria/atualiza lead por número (wa_id)
 *  4. Registra histórico no lead
 */
export async function processWhatsAppWebhook(
  eventId: string,
  body: WhatsAppPayload
): Promise<void> {
  console.log(`[whatsapp] Processando evento ${eventId}`);

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") {
        console.log(`[whatsapp] Ignorando change de campo: ${change.field}`);
        continue;
      }

      const val = change.value;

      // Ignora eventos de status (delivered, read, sent) — não são mensagens recebidas
      if (val.statuses?.length && !val.messages?.length) {
        console.log(`[whatsapp] Evento de status ignorado (${val.statuses.length} status(es))`);
        await markEventProcessed(eventId);
        continue;
      }

      if (!val.messages?.length) {
        console.log(`[whatsapp] Nenhuma mensagem encontrada no change`);
        continue;
      }

      const phoneNumberId = val.metadata?.phone_number_id;
      const displayNumber = val.metadata?.display_phone_number;

      // Resolve o tenant pelo phone_number_id
      const tenantId = await resolveTenantByIntegration("whatsapp", phoneNumberId ?? "");

      if (!tenantId) {
        console.warn(
          `[whatsapp] Tenant não encontrado para phone_number_id "${phoneNumberId}" ` +
          `(número: ${displayNumber}). ` +
          `TODO: registrar integração em TenantIntegration (provider=whatsapp, externalId=${phoneNumberId})`
        );
        await markEventPending(eventId, "PENDING_TENANT");
        continue;
      }

      // Processa cada mensagem recebida
      for (const message of val.messages) {
        const waId = message.from;
        const phone = formatWhatsAppPhone(waId);

        // Busca nome do contato no campo contacts (quando disponível)
        const contact = val.contacts?.find((c) => c.wa_id === waId);
        const name = contact?.profile?.name;

        const messageText =
          message.type === "text" ? message.text?.body : `[${message.type}]`;

        console.log(
          `[whatsapp] Mensagem de ${phone}` +
          (name ? ` (${name})` : "") +
          `: ${messageText?.slice(0, 80)}`
        );

        try {
          const { lead, created } = await findOrCreateLeadByPhone(tenantId, phone, {
            name,
            trafficSource: "DIRECT", // WhatsApp = contato direto
          });

          // Registra histórico da interação
          await prisma.leadHistory.create({
            data: {
              leadId: lead.id,
              action: "WHATSAPP_MESSAGE",
              description:
                `Mensagem WhatsApp recebida` +
                (messageText ? `: "${messageText.slice(0, 200)}"` : ""),
            },
          });

          console.log(
            `[whatsapp] Lead ${created ? "criado" : "atualizado"}: ${lead.id} (${lead.name})`
          );
        } catch (err: any) {
          console.error(`[whatsapp] Erro ao processar mensagem de ${phone}:`, err.message);
          await markEventError(eventId, err.message);
          return;
        }
      }

      await markEventProcessed(eventId);
    }
  }
}
