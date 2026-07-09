/**
 * whatsapp/inbox-store.ts
 *
 * Implementação Prisma da interface `InboxStore`.
 * Toda query é escopada por tenantId — nunca cruza tenants.
 */

import { prisma } from "@/lib/prisma";
import { phoneTail } from "./phone";
import type { InboxStore, ConversationRef, LeadRef, StageRef } from "./inbox";

export const prismaInboxStore: InboxStore = {
  async getFirstStage(tenantId: string): Promise<StageRef | null> {
    const stage =
      (await prisma.funnelStage.findFirst({
        where: { tenantId, isDefault: true },
        orderBy: { order: "asc" },
        select: { id: true },
      })) ??
      (await prisma.funnelStage.findFirst({
        where: { tenantId },
        orderBy: { order: "asc" },
        select: { id: true },
      }));
    return stage;
  },

  async findWhatsAppSource(tenantId: string) {
    return prisma.leadSource.findFirst({
      where: { tenantId, name: { contains: "WhatsApp", mode: "insensitive" } },
      select: { id: true },
    });
  },

  async findLeadByPhone(tenantId: string, phone: string): Promise<LeadRef | null> {
    const tail = phoneTail(phone);
    return prisma.lead.findFirst({
      where: {
        tenantId,
        OR: [
          { phone },
          ...(tail.length >= 10 ? [{ phone: { endsWith: tail } }] : []),
        ],
      },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
  },

  async createLead(input): Promise<LeadRef> {
    const lead = await prisma.lead.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        phone: input.phone,
        funnelStageId: input.funnelStageId,
        sourceId: input.sourceId,
        trafficSource: "WHATSAPP",
        observations: "Lead criado automaticamente via WhatsApp.",
        firstContactAt: new Date(),
        lastInteractionAt: new Date(),
      },
      select: { id: true, name: true },
    });
    return lead;
  },

  async touchLead(leadId: string, at: Date): Promise<void> {
    await prisma.lead.update({
      where: { id: leadId },
      data: { lastInteractionAt: at },
    });
  },

  async addLeadHistory(input): Promise<void> {
    await prisma.leadHistory.create({
      data: {
        leadId: input.leadId,
        action: input.action,
        description: input.description,
        createdAt: input.createdAt,
      },
    });
  },

  async findConversation(tenantId: string, phone: string): Promise<ConversationRef | null> {
    const conv = await prisma.whatsAppConversation.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
      select: { id: true, leadId: true, phone: true, contactName: true, status: true },
    });
    return conv;
  },

  async createConversation(input): Promise<ConversationRef> {
    const conv = await prisma.whatsAppConversation.create({
      data: {
        tenantId: input.tenantId,
        phone: input.phone,
        contactName: input.contactName,
        instanceName: input.instanceName,
        leadId: input.leadId,
        status: "OPEN",
        unreadCount: 0,
      },
      select: { id: true, leadId: true, phone: true, contactName: true, status: true },
    });
    return conv;
  },

  async linkConversationLead(conversationId: string, leadId: string): Promise<void> {
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { leadId },
    });
  },

  async bumpConversationInbound(conversationId, input): Promise<void> {
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: input.lastMessage.slice(0, 500),
        lastMessageAt: input.lastMessageAt,
        unreadCount: { increment: 1 },
        status: "OPEN", // reabre conversa encerrada ao receber nova mensagem
        ...(input.contactName ? { contactName: input.contactName } : {}),
      },
    });
  },

  async findMessageByExternalId(tenantId: string, externalMessageId: string) {
    return prisma.whatsAppMessage.findUnique({
      where: { tenantId_externalMessageId: { tenantId, externalMessageId } },
      select: { id: true },
    });
  },

  async createMessage(input): Promise<{ id: string }> {
    const msg = await prisma.whatsAppMessage.create({
      data: {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        externalMessageId: input.externalMessageId,
        direction: input.direction,
        type: input.type,
        body: input.body,
        status: input.status,
        sentAt: input.sentAt,
      },
      select: { id: true },
    });
    return msg;
  },
};
