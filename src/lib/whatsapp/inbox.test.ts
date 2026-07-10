import { test } from "node:test";
import assert from "node:assert/strict";
import { phoneTail } from "./phone";
import {
  processInboundMessage,
  type InboxStore,
  type ConversationRef,
  type LeadRef,
} from "./inbox";

/**
 * Store em memória para testar a lógica de negócio sem banco.
 * Toda coleção é escopada por tenantId, espelhando o isolamento do Prisma store.
 */
class FakeStore implements InboxStore {
  leads: Array<LeadRef & { tenantId: string; phone: string; funnelStageId: string }> = [];
  conversations: Array<ConversationRef & { tenantId: string; unreadCount: number; lastMessage: string | null }> = [];
  messages: Array<{ id: string; tenantId: string; conversationId: string; externalMessageId: string | null; direction: string; body: string }> = [];
  history: Array<{ leadId: string; action: string; description: string }> = [];
  private seq = 0;
  // tenantId → etapas (a primeira da lista é a inicial)
  constructor(private stagesByTenant: Record<string, string[]> = {}) {}
  private id(prefix: string) { return `${prefix}_${++this.seq}`; }

  async getFirstStage(tenantId: string) {
    const s = this.stagesByTenant[tenantId];
    return s && s.length ? { id: s[0] } : null;
  }
  async findWhatsAppSource() { return { id: "src_whatsapp" }; }

  async findLeadByPhone(tenantId: string, phone: string) {
    const tail = phoneTail(phone);
    const lead = this.leads.find((l) => l.tenantId === tenantId && phoneTail(l.phone) === tail);
    return lead ? { id: lead.id, name: lead.name } : null;
  }
  async createLead(input: { tenantId: string; name: string; phone: string; funnelStageId: string; sourceId: string | null }) {
    const lead = { id: this.id("lead"), tenantId: input.tenantId, name: input.name, phone: input.phone, funnelStageId: input.funnelStageId };
    this.leads.push(lead);
    return { id: lead.id, name: lead.name };
  }
  async touchLead() {}
  async addLeadHistory(input: { leadId: string; action: string; description: string }) {
    this.history.push({ leadId: input.leadId, action: input.action, description: input.description });
  }

  async findConversation(tenantId: string, phone: string) {
    const c = this.conversations.find((x) => x.tenantId === tenantId && x.phone === phone);
    return c ? { id: c.id, leadId: c.leadId, phone: c.phone, contactName: c.contactName, status: c.status, remoteJid: c.remoteJid } : null;
  }
  async createConversation(input: { tenantId: string; phone: string; contactName: string | null; instanceName: string | null; leadId: string | null; remoteJid: string | null }) {
    const c = { id: this.id("conv"), tenantId: input.tenantId, leadId: input.leadId, phone: input.phone, contactName: input.contactName, status: "OPEN", unreadCount: 0, lastMessage: null as string | null, remoteJid: input.remoteJid };
    this.conversations.push(c);
    return { id: c.id, leadId: c.leadId, phone: c.phone, contactName: c.contactName, status: c.status, remoteJid: c.remoteJid };
  }
  async linkConversationLead(conversationId: string, leadId: string) {
    const c = this.conversations.find((x) => x.id === conversationId);
    if (c) c.leadId = leadId;
  }
  async setConversationRemoteJid(conversationId: string, remoteJid: string) {
    const c = this.conversations.find((x) => x.id === conversationId);
    if (c) c.remoteJid = remoteJid;
  }
  async bumpConversationInbound(conversationId: string, input: { lastMessage: string; lastMessageAt: Date }) {
    const c = this.conversations.find((x) => x.id === conversationId);
    if (c) { c.unreadCount += 1; c.lastMessage = input.lastMessage; c.status = "OPEN"; }
  }

  async findMessageByExternalId(tenantId: string, externalMessageId: string) {
    const m = this.messages.find((x) => x.tenantId === tenantId && x.externalMessageId === externalMessageId);
    return m ? { id: m.id } : null;
  }
  async createMessage(input: { tenantId: string; conversationId: string; externalMessageId: string | null; direction: string; body: string }) {
    const m = { id: this.id("msg"), tenantId: input.tenantId, conversationId: input.conversationId, externalMessageId: input.externalMessageId, direction: input.direction, body: input.body };
    this.messages.push(m);
    return { id: m.id };
  }
}

const T = "tenant_a";
const base = { tenantId: T, instanceName: "inst_a", phone: "+5511987654321", contactName: "Maria" };

test("primeiro inbound: cria lead na 1ª etapa, cria conversa e salva mensagem", async () => {
  const store = new FakeStore({ [T]: ["stage_novo", "stage_2"] });
  const r = await processInboundMessage(store, { ...base, text: "Oi", externalMessageId: "m1" });

  assert.equal(r.status, "processed");
  assert.equal(r.leadCreated, true);
  assert.equal(r.conversationCreated, true);
  assert.equal(store.leads.length, 1);
  assert.equal(store.leads[0].funnelStageId, "stage_novo"); // primeira etapa
  assert.equal(store.conversations.length, 1);
  assert.equal(store.conversations[0].leadId, store.leads[0].id);
  assert.equal(store.messages.length, 1);
  assert.equal(store.messages[0].direction, "INBOUND");
  // histórico: criação do lead + mensagem
  assert.ok(store.history.some((h) => h.action === "LEAD_CREATED"));
  assert.ok(store.history.some((h) => h.action === "WHATSAPP_MESSAGE"));
});

test("dedupe: mesma externalMessageId não duplica mensagem nem lead", async () => {
  const store = new FakeStore({ [T]: ["stage_novo"] });
  await processInboundMessage(store, { ...base, text: "Oi", externalMessageId: "dup1" });
  const r2 = await processInboundMessage(store, { ...base, text: "Oi", externalMessageId: "dup1" });

  assert.equal(r2.status, "duplicate");
  assert.equal(store.messages.length, 1);
  assert.equal(store.leads.length, 1);
});

test("segunda mensagem do mesmo telefone reusa lead e conversa e incrementa não-lidas", async () => {
  const store = new FakeStore({ [T]: ["stage_novo"] });
  await processInboundMessage(store, { ...base, text: "1", externalMessageId: "a" });
  const r2 = await processInboundMessage(store, { ...base, text: "2", externalMessageId: "b" });

  assert.equal(r2.leadCreated, false);
  assert.equal(r2.conversationCreated, false);
  assert.equal(store.leads.length, 1);
  assert.equal(store.conversations.length, 1);
  assert.equal(store.messages.length, 2);
  assert.equal(store.conversations[0].unreadCount, 2);
});

test("isolamento por tenant: mesmo telefone em tenants distintos não se cruza", async () => {
  const store = new FakeStore({ tenant_a: ["a_novo"], tenant_b: ["b_novo"] });
  await processInboundMessage(store, { tenantId: "tenant_a", instanceName: "i", phone: "+5511999999999", text: "A", externalMessageId: "x" });
  await processInboundMessage(store, { tenantId: "tenant_b", instanceName: "j", phone: "+5511999999999", text: "B", externalMessageId: "y" });

  assert.equal(store.leads.length, 2);
  assert.equal(store.conversations.length, 2);
  assert.equal(store.leads.filter((l) => l.tenantId === "tenant_a").length, 1);
  assert.equal(store.leads.filter((l) => l.tenantId === "tenant_b").length, 1);
  // etapas corretas por tenant
  assert.equal(store.leads.find((l) => l.tenantId === "tenant_a")!.funnelStageId, "a_novo");
  assert.equal(store.leads.find((l) => l.tenantId === "tenant_b")!.funnelStageId, "b_novo");
});

test("conversa CLOSED reabre automaticamente ao receber nova mensagem", async () => {
  const store = new FakeStore({ [T]: ["stage_novo"] });
  await processInboundMessage(store, { ...base, text: "1", externalMessageId: "a" });
  // Simula encerramento manual da conversa
  store.conversations[0].status = "CLOSED";
  store.conversations[0].unreadCount = 0;

  const r2 = await processInboundMessage(store, { ...base, text: "2", externalMessageId: "b" });

  assert.equal(r2.conversationReopened, true);
  assert.equal(store.conversations[0].status, "OPEN"); // reaberta
  assert.equal(store.conversations[0].unreadCount, 1); // incrementou
  assert.equal(store.conversations.length, 1); // não duplicou
  assert.equal(store.leads.length, 1); // não duplicou lead
  assert.ok(store.history.some((h) => h.action === "WHATSAPP_REOPENED"));
});

test("conversa OPEN não gera evento de reabertura", async () => {
  const store = new FakeStore({ [T]: ["stage_novo"] });
  await processInboundMessage(store, { ...base, text: "1", externalMessageId: "a" });
  const r2 = await processInboundMessage(store, { ...base, text: "2", externalMessageId: "b" });
  assert.equal(r2.conversationReopened, false);
  assert.ok(!store.history.some((h) => h.action === "WHATSAPP_REOPENED"));
});

test("armazena remoteJid ao criar conversa e faz backfill em conversa antiga", async () => {
  const store = new FakeStore({ [T]: ["stage_novo"] });
  const jid = "5562904225255654@s.whatsapp.net";
  await processInboundMessage(store, { ...base, text: "1", externalMessageId: "a", remoteJid: jid });
  assert.equal(store.conversations[0].remoteJid, jid);

  // Simula conversa antiga sem remoteJid → próxima mensagem faz backfill.
  store.conversations[0].remoteJid = null;
  await processInboundMessage(store, { ...base, text: "2", externalMessageId: "b", remoteJid: jid });
  assert.equal(store.conversations[0].remoteJid, jid); // backfill
  assert.equal(store.conversations.length, 1); // não duplica
});

test("funil vazio lança erro", async () => {
  const store = new FakeStore({}); // sem etapas
  await assert.rejects(
    () => processInboundMessage(store, { ...base, text: "Oi", externalMessageId: "z" }),
    /Funil vazio/
  );
});
