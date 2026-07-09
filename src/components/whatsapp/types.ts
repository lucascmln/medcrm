export interface WaStageRef {
  id: string;
  name: string;
  color: string;
  isFinal?: boolean;
  isLost?: boolean;
}

export interface WaLeadSummary {
  id: string;
  name: string;
  email?: string | null;
  funnelStageId?: string;
  funnelStage?: WaStageRef | null;
}

export interface WaConversationSummary {
  id: string;
  phone: string;
  contactName: string | null;
  status: string;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lead: WaLeadSummary | null;
}

export interface WaMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  body: string | null;
  mediaUrl?: string | null;
  status: string | null;
  sentAt: string | null;
  createdAt: string;
  optimistic?: boolean;
  failed?: boolean;
}

export interface WaLeadHistoryItem {
  id: string;
  action: string;
  description: string | null;
  createdAt: string;
}

export interface WaConversationDetail {
  id: string;
  phone: string;
  contactName: string | null;
  status: string;
  unreadCount: number;
  instanceName: string | null;
  createdAt: string;
  lead:
    | (WaLeadSummary & {
        phone?: string;
        trafficSource?: string | null;
        history?: WaLeadHistoryItem[];
      })
    | null;
}

export interface WaConnectionStatus {
  configured: boolean;
  providerConfigured: boolean;
  providerMode?: "evolution" | "mock" | "none";
  status: string; // disconnected | qr_ready | connecting | connected | error | not_configured
  phoneNumber?: string | null;
  instanceName?: string;
  lastError?: string | null;
}

export type WaFilter = "open" | "unread" | "all" | "closed";
