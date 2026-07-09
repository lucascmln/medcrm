/**
 * whatsapp-qr-provider.ts
 *
 * Adapter layer para provedores de WhatsApp via QR Code.
 * Atualmente suporta: Evolution API (https://doc.evolution-api.com)
 *
 * O CRM nunca mantém conexão WebSocket — apenas chama o provider via HTTP
 * e recebe eventos por webhook. Isso é compatível com Vercel/serverless.
 *
 * Para trocar de provider no futuro: implemente as mesmas funções exportadas
 * e troque WHATSAPP_QR_PROVIDER no .env.
 */

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type QrConnectionStatus =
  | "disconnected"
  | "qr_ready"
  | "connecting"
  | "connected"
  | "error"
  | "not_configured";

export interface QrInstanceInfo {
  instanceName: string;
  status: QrConnectionStatus;
  phoneNumber?: string | null;
  qrCodeBase64?: string | null;
  qrCodeText?: string | null;
  lastError?: string | null;
}

export interface ProviderConfig {
  apiUrl: string;
  apiKey: string;
  webhookUrl: string; // URL do CRM que receberá eventos do provider
}

export type ProviderMode = "evolution" | "mock" | "none";

// ── Modo do provider ──────────────────────────────────────────────────────────
//
//   WHATSAPP_QR_PROVIDER=mock       → provider simulado (testes sem WhatsApp real)
//   WHATSAPP_QR_PROVIDER=evolution  → Evolution API (exige URL + KEY configuradas)
//   (ausente)                       → detecta evolution se URL+KEY existirem, senão "none"
//
export function getProviderMode(): ProviderMode {
  const explicit = process.env.WHATSAPP_QR_PROVIDER?.trim().toLowerCase();
  if (explicit === "mock") return "mock";

  const hasEvolution =
    !!process.env.EVOLUTION_API_URL &&
    !!process.env.EVOLUTION_API_KEY &&
    !!process.env.APP_BASE_URL;

  if (explicit === "evolution") return hasEvolution ? "evolution" : "none";
  return hasEvolution ? "evolution" : "none";
}

// ── Lê configuração do provider a partir das variáveis de ambiente ────────────

export function getProviderConfig(): ProviderConfig | null {
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");

  if (!apiUrl || !apiKey || !appBaseUrl) return null;

  return {
    apiUrl,
    apiKey,
    webhookUrl: `${appBaseUrl}/api/webhooks/whatsapp-qr`,
  };
}

/** True se há um provider utilizável (Evolution configurada OU modo mock). */
export function isProviderConfigured(): boolean {
  return getProviderMode() !== "none";
}

/** Número fictício exibido quando conectado em modo mock. */
const MOCK_PHONE = "+5511900000000";

// ── Helpers internos ──────────────────────────────────────────────────────────

async function evolutionFetch(
  config: ProviderConfig,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${config.apiUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: config.apiKey,
      ...(options.headers ?? {}),
    },
  });
  return res;
}

/** Mapeia o estado retornado pela Evolution API para o nosso QrConnectionStatus */
function mapEvolutionState(state: string | undefined): QrConnectionStatus {
  switch (state) {
    case "open":        return "connected";
    case "connecting":  return "connecting";
    case "close":       return "disconnected";
    case "qr":          return "qr_ready";
    default:            return "disconnected";
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Cria uma nova instância WhatsApp no provider.
 * Se já existir, retorna as informações da existente.
 */
export async function createInstance(
  tenantId: string,
  instanceName: string
): Promise<QrInstanceInfo> {
  if (getProviderMode() === "mock") {
    // Mock: instância "conecta" instantaneamente, sem QR real.
    return { instanceName, status: "connected", phoneNumber: MOCK_PHONE };
  }

  const config = getProviderConfig();
  if (!config) {
    return { instanceName, status: "not_configured" };
  }

  const body = {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    webhook: config.webhookUrl,
    webhook_by_events: false,
    events: [
      "MESSAGES_UPSERT",
      "CONNECTION_UPDATE",
      "QRCODE_UPDATED",
    ],
  };

  const res = await evolutionFetch(config, "/instance/create", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    // 409 = já existe — ok, vamos buscar o estado atual
    if (res.status !== 409) {
      console.error("[whatsapp-qr] createInstance falhou:", res.status, err);
      return { instanceName, status: "error", lastError: `Provider error: ${res.status}` };
    }
  }

  // Configura o webhook explicitamente (idempotente)
  await configureWebhook(instanceName);

  return getConnectionStatus(instanceName);
}

/**
 * Busca o status atual da conexão de uma instância.
 */
export async function getConnectionStatus(
  instanceName: string
): Promise<QrInstanceInfo> {
  if (getProviderMode() === "mock") {
    return { instanceName, status: "connected", phoneNumber: MOCK_PHONE };
  }

  const config = getProviderConfig();
  if (!config) {
    return { instanceName, status: "not_configured" };
  }

  try {
    const res = await evolutionFetch(
      config,
      `/instance/connectionState/${encodeURIComponent(instanceName)}`
    );

    if (!res.ok) {
      if (res.status === 404) {
        return { instanceName, status: "disconnected" };
      }
      return { instanceName, status: "error", lastError: `HTTP ${res.status}` };
    }

    const data = await res.json();
    // Evolution API retorna: { instance: { instanceName, state } }
    const state: string = data?.instance?.state ?? data?.state ?? "close";
    const status = mapEvolutionState(state);

    let phoneNumber: string | null = null;
    // Quando conectado, tenta buscar o número
    if (status === "connected") {
      try {
        const infoRes = await evolutionFetch(
          config,
          `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`
        );
        if (infoRes.ok) {
          const instances = await infoRes.json();
          const inst = Array.isArray(instances)
            ? instances.find((i: any) => i.instance?.instanceName === instanceName)
            : instances;
          phoneNumber = inst?.instance?.owner ?? inst?.owner ?? null;
        }
      } catch {}
    }

    return { instanceName, status, phoneNumber };
  } catch (err: any) {
    return { instanceName, status: "error", lastError: err.message };
  }
}

/**
 * Gera / retorna o QR Code atual da instância.
 * Retorna base64 da imagem PNG e o texto do código.
 */
export async function getQRCode(
  instanceName: string
): Promise<QrInstanceInfo> {
  if (getProviderMode() === "mock") {
    // Mock já está "conectado" — não há QR a escanear.
    return { instanceName, status: "connected", phoneNumber: MOCK_PHONE };
  }

  const config = getProviderConfig();
  if (!config) {
    return { instanceName, status: "not_configured" };
  }

  try {
    const res = await evolutionFetch(
      config,
      `/instance/connect/${encodeURIComponent(instanceName)}`
    );

    if (!res.ok) {
      const errText = await res.text();
      // 428 = já conectado
      if (res.status === 428) {
        const info = await getConnectionStatus(instanceName);
        return info;
      }
      return {
        instanceName,
        status: "error",
        lastError: `Provider returned ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = await res.json();

    // Evolution retorna: { base64: "data:image/png;base64,...", code: "...", count: N }
    const base64: string | null = data?.base64 ?? null;
    const text: string | null = data?.code ?? null;

    if (!base64 && !text) {
      // Pode estar conectando — tenta checar o estado
      const stateInfo = await getConnectionStatus(instanceName);
      return stateInfo;
    }

    return {
      instanceName,
      status: "qr_ready",
      qrCodeBase64: base64,
      qrCodeText: text,
    };
  } catch (err: any) {
    return { instanceName, status: "error", lastError: err.message };
  }
}

/**
 * Desconecta e remove a instância do provider.
 */
export async function disconnectInstance(instanceName: string): Promise<void> {
  const config = getProviderConfig();
  if (!config) return;

  try {
    // Tenta fazer logout primeiro (graceful)
    await evolutionFetch(
      config,
      `/instance/logout/${encodeURIComponent(instanceName)}`,
      { method: "DELETE" }
    );
  } catch {}

  try {
    // Depois deleta a instância
    await evolutionFetch(
      config,
      `/instance/delete/${encodeURIComponent(instanceName)}`,
      { method: "DELETE" }
    );
  } catch (err: any) {
    console.warn("[whatsapp-qr] disconnectInstance:", err.message);
  }
}

/**
 * Configura (ou reconfigura) o webhook da instância no provider.
 */
export async function configureWebhook(instanceName: string): Promise<void> {
  const config = getProviderConfig();
  if (!config) return;

  try {
    await evolutionFetch(
      config,
      `/webhook/set/${encodeURIComponent(instanceName)}`,
      {
        method: "POST",
        body: JSON.stringify({
          url: config.webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        }),
      }
    );
  } catch (err: any) {
    console.warn("[whatsapp-qr] configureWebhook:", err.message);
  }
}

/**
 * Envia mensagem de texto via WhatsApp (opcional — para uso futuro).
 */
export async function sendMessage(
  instanceName: string,
  to: string,       // número no formato internacional sem +, ex: "5511987654321"
  text: string
): Promise<boolean> {
  if (getProviderMode() === "mock") {
    console.log(`[whatsapp-qr:mock] sendMessage → ${to}: ${text.slice(0, 80)}`);
    return true;
  }

  const config = getProviderConfig();
  if (!config) return false;

  try {
    const res = await evolutionFetch(
      config,
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        method: "POST",
        body: JSON.stringify({
          number: to,
          textMessage: { text },
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Gera um nome de instância único e seguro para o tenant.
 * Formato: innove_{slug} — 32 chars máx para Evolution API.
 */
export function buildInstanceName(tenantId: string, suffix?: string): string {
  const base = `innove_${tenantId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const full = suffix ? `${base}_${suffix}` : base;
  return full.slice(0, 32);
}
