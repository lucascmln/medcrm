/**
 * whatsapp/inbox.ts
 *
 * Núcleo (pure logic) do processamento de mensagens WhatsApp recebidas.
 *
 * Toda a persistência é abstraída pela interface `InboxStore`, o que torna a
 * lógica de negócio — dedupe, criação automática de lead, entrada na 1ª etapa
 * do funil e isolamento por tenant — testável sem banco de dados real.
 *
 * A implementação Prisma vive em `inbox-store.ts`.
 */

// ── Tipos de referência ────────────────────────────────────────────────────────

export type LeadRef = { id: string; name: string };

export type ConversationRef = {
  id: string;
  leadId: string | null;
  phone: string;
  contactName: string | null;
};

export type StageRef = { id: string };

// ── Entrada / saída ─────────────────────────────────────────────────────────────

export interface InboundInput {
  tenantId: string;
  instanceName: string;
  phone: string; // já normalizado (+55DDDNUMERO)
  contactName?: string;
  text: string;
  externalMessageId?: string | null;
  type?: string; // TEXT | IMAGE | AUDIO | DOCUMENT
  sentAt?: Date;
}

export interface InboundResult {
  status: "processed" | "duplicate";
  conversationId: string;
  leadId: string | null;
  leadCreated: boolean;
  conversationCreated: boolean;
  messageId?: string;
}

// ── Contrato de persistência ────────────────────────────────────────────────────

export interface InboxStore {
  getFirstStage(tenantId: string): Promise<StageRef | null>;
  findWhatsAppSource(tenantId: string): Promise<{ id: string } | null>;

  findLeadByPhone(tenantId: string, phone: string): Promise<LeadRef | null>;
  createLead(input: {
    tenantId: string;
    name: string;
    phone: string;
    funnelStageId: string;
    sourceId: string | null;
  }): Promise<LeadRef>;
  touchLead(leadId: string, at: Date): Promise<void>;
  addLeadHistory(input: {
    leadId: string;
    action: string;
    description: string;
    createdAt: Date;
  }): Promise<void>;

  findConversation(tenantId: string, phone: string): Promise<ConversationRef | null>;
  createConversation(input: {
    tenantId: string;
    phone: string;
    contactName: string | null;
    instanceName: string | null;
    leadId: string | null;
  }): Promise<ConversationRef>;
  linkConversationLead(conversationId: string, leadId: string): Promise<void>;
  bumpConversationInbound(
    conversationId: string,
    input: { lastMessage: string; lastMessageAt: Date; contactName?: string | null }
  ): Promise<void>;

  findMessageByExternalId(
    tenantId: string,
    externalMessageId: string
  ): Promise<{ id: string } | null>;
  createMessage(input: {
    tenantId: string;
    conversationId: string;
    externalMessageId: string | null;
    direction: "INBOUND" | "OUTBOUND";
    type: string;
    body: string;
    status: string;
    sentAt: Date;
  }): Promise<{ id: string }>;
}

// ── Núcleo do processamento ──────────────────────────────────────────────────────

/**
 * Processa uma mensagem INBOUND:
 *  1. Deduplica por externalMessageId (mesma mensagem entregue 2x pelo webhook).
 *  2. Garante que exista um Lead para o telefone (cria na 1ª etapa do funil).
 *  3. Garante que exista uma Conversa vinculada ao Lead.
 *  4. Persiste a mensagem, atualiza a conversa e registra o histórico do lead.
 *
 * Idempotente: reentregas do webhook não duplicam mensagens nem leads.
 */
export async function processInboundMessage(
  store: InboxStore,
  input: InboundInput
): Promise<InboundResult> {
  const {
    tenantId,
    instanceName,
    phone,
    contactName,
    text,
    externalMessageId,
    type = "TEXT",
    sentAt = new Date(),
  } = input;

  if (!tenantId) throw new Error("tenantId obrigatório");
  if (!phone) throw new Error("telefone inválido");

  // 1. Dedupe — se a mensagem já existe, garante a conversa e retorna sem re-gravar.
  if (externalMessageId) {
    const dup = await store.findMessageByExternalId(tenantId, externalMessageId);
    if (dup) {
      const existingConv = await store.findConversation(tenantId, phone);
      return {
        status: "duplicate",
        conversationId: existingConv?.id ?? "",
        leadId: existingConv?.leadId ?? null,
        leadCreated: false,
        conversationCreated: false,
      };
    }
  }

  // 2. Lead — busca por telefone; cria na 1ª etapa do funil se não existir.
  let lead = await store.findLeadByPhone(tenantId, phone);
  let leadCreated = false;
  if (!lead) {
    const stage = await store.getFirstStage(tenantId);
    if (!stage) throw new Error(`Funil vazio para tenant ${tenantId}`);
    const source = await store.findWhatsAppSource(tenantId);
    lead = await store.createLead({
      tenantId,
      name: contactName?.trim() || phone,
      phone,
      funnelStageId: stage.id,
      sourceId: source?.id ?? null,
    });
    leadCreated = true;
  }

  // 3. Conversa — busca por telefone; cria vinculada ao lead se não existir.
  let conversation = await store.findConversation(tenantId, phone);
  let conversationCreated = false;
  if (!conversation) {
    conversation = await store.createConversation({
      tenantId,
      phone,
      contactName: contactName?.trim() || null,
      instanceName: instanceName || null,
      leadId: lead.id,
    });
    conversationCreated = true;
  } else if (!conversation.leadId) {
    await store.linkConversationLead(conversation.id, lead.id);
    conversation = { ...conversation, leadId: lead.id };
  }

  // 4. Persiste a mensagem INBOUND.
  const message = await store.createMessage({
    tenantId,
    conversationId: conversation.id,
    externalMessageId: externalMessageId ?? null,
    direction: "INBOUND",
    type,
    body: text,
    status: "RECEIVED",
    sentAt,
  });

  // 5. Atualiza a conversa (última mensagem + contador de não-lidas).
  await store.bumpConversationInbound(conversation.id, {
    lastMessage: text,
    lastMessageAt: sentAt,
    contactName: contactName?.trim() || undefined,
  });

  // 6. Histórico do lead.
  if (leadCreated) {
    await store.addLeadHistory({
      leadId: lead.id,
      action: "LEAD_CREATED",
      description: "Lead criado automaticamente a partir de mensagem do WhatsApp.",
      createdAt: new Date(sentAt.getTime() - 1000),
    });
  }
  await store.addLeadHistory({
    leadId: lead.id,
    action: "WHATSAPP_MESSAGE",
    description: `Mensagem WhatsApp recebida: "${text.slice(0, 280)}"`,
    createdAt: sentAt,
  });
  await store.touchLead(lead.id, sentAt);

  return {
    status: "processed",
    conversationId: conversation.id,
    leadId: lead.id,
    leadCreated,
    conversationCreated,
    messageId: message.id,
  };
}
