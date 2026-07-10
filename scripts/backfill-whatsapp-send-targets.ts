/**
 * scripts/backfill-whatsapp-send-targets.ts
 *
 * Backfill SEGURO do destino discável (sendTargetJid) e correção de
 * remoteJid / lead.phone para conversas/leads de TESTE que ficaram com um
 * número opaco de LID (`@lid`) — ex.: "+195223946834081".
 *
 * ─ MODOS ──────────────────────────────────────────────────────────────────────
 *   (padrão) --dry-run   SOMENTE LEITURA. Não escreve nada no banco. Localiza as
 *                        conversas problemáticas e PROPÕE os updates.
 *   --apply --force      Aplica os updates AUTO_FIX_READY (conversa + lead).
 *                        NÃO rode sem autorização explícita. Exige as DUAS flags.
 *
 * ─ USO ────────────────────────────────────────────────────────────────────────
 *   # dry-run contra o DATABASE_URL atual (read-only):
 *   npx tsx scripts/backfill-whatsapp-send-targets.ts --dry-run
 *
 *   # dry-run apontando explicitamente para o banco real, SOMENTE LEITURA:
 *   DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require" \
 *     npx tsx scripts/backfill-whatsapp-send-targets.ts --dry-run
 *
 * ─ GARANTIAS ──────────────────────────────────────────────────────────────────
 *   • Nunca transforma `@lid` em telefone.
 *   • Nunca inventa número — só usa JIDs discáveis (@s.whatsapp.net / @c.us)
 *     efetivamente encontrados nos payloads salvos em webhook_events.
 *   • dry-run NÃO executa nenhum INSERT/UPDATE/DELETE.
 *   • Robusto a a coluna send_target_jid ainda não existir (pré db push).
 *   • Telefones são mascarados na saída.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import {
  normalizePhone,
  jidToNumber,
  isDialableJid,
  isLidJid,
  looksLikeDialablePhone,
} from "../src/lib/whatsapp/phone";

/**
 * Carrega variáveis de .env.local e .env (nesta ordem, sem sobrescrever o que já
 * está no ambiente) — replica a resolução do Next.js para um script standalone.
 * Feito sem dependência externa (dotenv não está instalado).
 */
function loadEnvFiles(): void {
  for (const file of [".env.local", ".env"]) {
    const full = path.resolve(__dirname, "..", file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue; // não sobrescreve o ambiente
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}
loadEnvFiles();

// ── Flags ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const FORCE = argv.includes("--force");
const MODE: "apply" | "dry-run" = APPLY ? "apply" : "dry-run";
const MAX_RECORDS = 5;

// ── Mascaramento de telefone/JID para a saída ─────────────────────────────────

function mask(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "(vazio)";
  const s = String(value);
  const at = s.indexOf("@");
  const suffix = at >= 0 ? s.slice(at) : ""; // preserva @lid / @s.whatsapp.net (não é segredo)
  const local = at >= 0 ? s.slice(0, at) : s;
  const digits = local.replace(/\D/g, "");
  if (digits.length === 0) return `${local}${suffix}`;
  if (digits.length <= 5) return `${"*".repeat(digits.length)}${suffix}`;
  const head = digits.slice(0, 4);
  const tail = digits.slice(-2);
  return `${head}${"*".repeat(Math.max(1, digits.length - 6))}${tail}${suffix}`;
}

// ── Heurísticas ────────────────────────────────────────────────────────────────

/** True se o telefone atual é opaco/suspeito (derivado de @lid, longo demais, etc.). */
function isOpaquePhone(phone: string | null, remoteJid: string | null): boolean {
  if (isLidJid(remoteJid)) return true;
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return true;
  const brPlausible = d.startsWith("55") && d.length >= 12 && d.length <= 13;
  const genericPlausible = d.length >= 10 && d.length <= 13;
  return !(brPlausible || genericPlausible);
}

/** Prioridade das conversas de teste conhecidas. Menor = mais prioritário. */
function nameRank(name: string | null): number {
  const n = (name ?? "").toLowerCase();
  if (/lucas\s+natale/.test(n)) return 0;
  if (/rafael\s+gon/.test(n)) return 0;
  return 1;
}

// ── Extração de destino discável a partir de um payload do webhook ────────────

interface DialableHit {
  jid: string;
  field: string;
}

/**
 * Procura, em um payload bruto da Evolution, o primeiro JID discável
 * (@s.whatsapp.net / @c.us). Só aceita valores com sufixo discável — nunca
 * dígitos crus (que poderiam ser o dono da instância ou um lid) nem `@lid`.
 */
function extractDialableFromPayload(raw: string): DialableHit | null {
  let p: any;
  try {
    p = JSON.parse(raw);
  } catch {
    return null;
  }
  const d = p?.data ?? {};
  const k = d?.key ?? {};
  const ordered: Array<[string, unknown]> = [
    ["key.senderPn", k?.senderPn],
    ["data.senderPn", d?.senderPn],
    ["key.participantPn", k?.participantPn],
    ["key.remoteJidAlt", k?.remoteJidAlt],
    ["key.participant", k?.participant],
    ["data.participant", d?.participant],
    ["sender", p?.sender],
    ["from", p?.from ?? d?.from],
    ["number", p?.number ?? d?.number],
    ["key.remoteJid", k?.remoteJid],
    ["remoteJid", d?.remoteJid],
  ];
  for (const [field, val] of ordered) {
    if (typeof val === "string" && isDialableJid(val)) {
      return { jid: val, field };
    }
  }
  return null;
}

// ── Tipos de linha ─────────────────────────────────────────────────────────────

interface ConvRow {
  id: string;
  lead_id: string | null;
  phone: string | null;
  remote_jid: string | null;
  send_target_jid: string | null;
  instance_name: string | null;
  contact_name: string | null;
  status: string | null;
  created_at: Date;
  lead_name: string | null;
  lead_phone: string | null;
}

interface Proposal {
  row: ConvRow;
  decision: "AUTO_FIX_READY" | "NEEDS_MANUAL_MAPPING";
  sourceField: string | null;
  proposedSendTargetJid: string | null;
  proposedRemoteJid: string | null; // só difere se remote_jid estava vazio
  proposedLeadPhone: string | null; // só se telefone real confiável e diferente
  reason: string;
}

// ── Prisma ────────────────────────────────────────────────────────────────────

const dbUrl = process.env.DATABASE_URL ?? "";

async function columnExists(
  prisma: PrismaClient,
  table: string,
  column: string
): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2
     ) AS exists`,
    table,
    column
  );
  return Boolean(rows[0]?.exists);
}

async function payloadsFor(
  prisma: PrismaClient,
  needle: string
): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ payload: string }>>(
    `SELECT payload FROM webhook_events
     WHERE source = 'whatsapp-qr' AND payload LIKE $1
     ORDER BY created_at DESC
     LIMIT 10`,
    `%${needle}%`
  );
  return rows.map((r) => r.payload).filter((x): x is string => Boolean(x));
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Backfill WhatsApp send targets — modo: ${MODE.toUpperCase()} ===\n`);

  if (!dbUrl) {
    console.error("✖ DATABASE_URL não definido. Nada foi feito.");
    process.exit(1);
  }
  if (!/^postgres(ql)?:\/\//i.test(dbUrl)) {
    const scheme = (dbUrl.split("://")[0] || dbUrl.slice(0, 12)).trim();
    console.log(`⚠ DATABASE_URL local não é PostgreSQL (scheme: "${scheme}").`);
    console.log("  Nenhuma conexão e nenhuma escrita foram feitas — este é um placeholder local.");
    console.log("  Os dados reais (Lucas Natale / Rafael Gonçalves) estão no banco de produção.");
    console.log("  Para inspecionar em SOMENTE LEITURA, rode apontando o DATABASE_URL ao banco real:\n");
    console.log('    DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require" \\');
    console.log("      npx tsx scripts/backfill-whatsapp-send-targets.ts --dry-run\n");
    process.exit(0);
  }

  if (MODE === "apply" && !FORCE) {
    console.error("✖ --apply exige também --force (trava de segurança). Nada foi aplicado.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const hasSendTarget = await columnExists(prisma, "whatsapp_conversations", "send_target_jid");
    if (!hasSendTarget) {
      console.log(
        "ℹ Coluna send_target_jid ainda NÃO existe neste banco (db push pendente).\n" +
          "  O dry-run apenas calcula/propõe; --apply ficará bloqueado até a coluna existir.\n"
      );
    }

    const stSelect = hasSendTarget ? "c.send_target_jid" : "NULL::text AS send_target_jid";
    const convs = await prisma.$queryRawUnsafe<ConvRow[]>(
      `SELECT c.id, c.lead_id, c.phone, c.remote_jid, ${stSelect},
              c.instance_name, c.contact_name, c.status, c.created_at,
              l.name AS lead_name, l.phone AS lead_phone
       FROM whatsapp_conversations c
       LEFT JOIN leads l ON l.id = c.lead_id
       ORDER BY c.created_at DESC
       LIMIT 50`
    );

    // Seleciona conversas problemáticas (opacas / @lid / sem sendTarget), priorizando
    // os nomes de teste conhecidos e as mais recentes.
    const problematic = convs
      .filter(
        (c) =>
          isOpaquePhone(c.phone, c.remote_jid) ||
          isLidJid(c.remote_jid) ||
          (hasSendTarget && !c.send_target_jid && isLidJid(c.remote_jid)) ||
          nameRank(c.lead_name ?? c.contact_name) === 0
      )
      .sort((a, b) => {
        const r = nameRank(a.lead_name ?? a.contact_name) - nameRank(b.lead_name ?? b.contact_name);
        if (r !== 0) return r;
        return b.created_at.getTime() - a.created_at.getTime();
      })
      .slice(0, MAX_RECORDS);

    if (problematic.length === 0) {
      console.log("Nenhuma conversa problemática encontrada nas 50 mais recentes. Nada a propor.");
      return;
    }

    // Monta as propostas consultando os payloads salvos.
    const proposals: Proposal[] = [];
    for (const c of problematic) {
      const lidDigits = isLidJid(c.remote_jid) ? jidToNumber(c.remote_jid) : "";
      const phoneDigits = (c.phone ?? "").replace(/\D/g, "");
      const needles = Array.from(
        new Set([lidDigits, phoneDigits, c.remote_jid ?? ""].filter((n) => n && n.length >= 6))
      );

      let hit: DialableHit | null = null;
      for (const needle of needles) {
        const payloads = await payloadsFor(prisma, needle);
        for (const raw of payloads) {
          const found = extractDialableFromPayload(raw);
          if (found) {
            hit = found;
            break;
          }
        }
        if (hit) break;
      }

      if (hit) {
        const proposedPhone = normalizePhone(hit.jid);
        const leadPhoneOpaque = isOpaquePhone(c.lead_phone, c.remote_jid);
        // Só propõe trocar lead.phone se for telefone real E o atual for opaco/diferente.
        const proposedLeadPhone =
          looksLikeDialablePhone(proposedPhone) &&
          proposedPhone !== (c.lead_phone ?? "") &&
          (leadPhoneOpaque || !c.lead_phone)
            ? proposedPhone
            : null;
        proposals.push({
          row: c,
          decision: "AUTO_FIX_READY",
          sourceField: hit.field,
          proposedSendTargetJid: hit.jid,
          proposedRemoteJid: !c.remote_jid ? hit.jid : c.remote_jid,
          proposedLeadPhone,
          reason: `destino discável encontrado em ${hit.field}`,
        });
      } else {
        proposals.push({
          row: c,
          decision: "NEEDS_MANUAL_MAPPING",
          sourceField: null,
          proposedSendTargetJid: null,
          proposedRemoteJid: c.remote_jid,
          proposedLeadPhone: null,
          reason: isLidJid(c.remote_jid)
            ? "remoteJid é @lid e nenhum payload com número discável (@s.whatsapp.net) foi encontrado"
            : "nenhum destino discável confiável encontrado nos payloads salvos",
        });
      }
    }

    // ── Relatório (tabela detalhada, telefones mascarados) ──────────────────────
    console.log(`Conversas de teste analisadas: ${proposals.length} (máx ${MAX_RECORDS})\n`);
    proposals.forEach((p, i) => {
      const c = p.row;
      console.log(`[${i + 1}] ${c.lead_name ?? c.contact_name ?? "(sem nome)"}  →  ${p.decision}`);
      console.log(`    conversationId : ${c.id}`);
      console.log(`    leadId         : ${c.lead_id ?? "(sem lead)"}`);
      console.log(`    instanceName   : ${c.instance_name ?? "(nenhum)"}`);
      console.log(`    phone atual    : ${mask(c.phone)}`);
      console.log(`    remoteJid atual: ${mask(c.remote_jid)}`);
      console.log(`    sendTarget at. : ${mask(c.send_target_jid)}`);
      console.log(`    ── proposto ──`);
      console.log(`    sendTarget novo: ${mask(p.proposedSendTargetJid)}   (origem: ${p.sourceField ?? "—"})`);
      if (p.proposedRemoteJid !== c.remote_jid) {
        console.log(`    remoteJid novo : ${mask(p.proposedRemoteJid)}   (estava vazio)`);
      }
      console.log(`    lead.phone at. : ${mask(c.lead_phone)}`);
      console.log(`    lead.phone novo: ${p.proposedLeadPhone ? mask(p.proposedLeadPhone) : "(inalterado)"}`);
      console.log(`    motivo         : ${p.reason}`);
      console.log("");
    });

    const autoFix = proposals.filter((p) => p.decision === "AUTO_FIX_READY");
    const manual = proposals.filter((p) => p.decision === "NEEDS_MANUAL_MAPPING");

    console.log("── Resumo ──────────────────────────────────────────────");
    console.log(`  AUTO_FIX_READY       : ${autoFix.length}`);
    console.log(`  NEEDS_MANUAL_MAPPING : ${manual.length}`);

    if (manual.length > 0) {
      console.log("\n⚠ Precisam de número manual (informe o telefone real discável):");
      manual.forEach((p) => {
        console.log(
          `  • ${p.row.lead_name ?? p.row.contact_name ?? "(sem nome)"} | phone atual ${mask(p.row.phone)} | motivo: ${p.reason}`
        );
        console.log(
          `    → me informe o número correto (E.164, ex.: +55DDDNXXXXXXXX) para ${p.row.id}`
        );
      });
    }

    if (autoFix.length > 0) {
      console.log("\n── UPDATEs que seriam aplicados (--apply --force) ──");
      autoFix.forEach((p) => {
        console.log(
          `  UPDATE whatsapp_conversations SET send_target_jid=${mask(p.proposedSendTargetJid)}` +
            (p.proposedRemoteJid !== p.row.remote_jid ? `, remote_jid=${mask(p.proposedRemoteJid)}` : "") +
            ` WHERE id=${p.row.id};`
        );
        if (p.proposedLeadPhone && p.row.lead_id) {
          console.log(
            `  UPDATE leads SET phone=${mask(p.proposedLeadPhone)} WHERE id=${p.row.lead_id};`
          );
        }
      });
    }

    // ── APPLY (bloqueado por padrão; exige --apply --force e coluna existente) ──
    if (MODE === "apply") {
      if (!hasSendTarget) {
        console.error(
          "\n✖ Coluna send_target_jid não existe — rode a migration/db push antes. Nada aplicado."
        );
        process.exit(1);
      }
      console.log("\n▶ Aplicando correções AUTO_FIX_READY...");
      for (const p of autoFix) {
        await prisma.whatsAppConversation.update({
          where: { id: p.row.id },
          data: {
            sendTargetJid: p.proposedSendTargetJid,
            ...(p.proposedRemoteJid !== p.row.remote_jid ? { remoteJid: p.proposedRemoteJid } : {}),
          },
        });
        if (p.proposedLeadPhone && p.row.lead_id) {
          await prisma.lead.update({
            where: { id: p.row.lead_id },
            data: { phone: p.proposedLeadPhone },
          });
        }
        console.log(`  ✔ ${p.row.id} atualizado`);
      }
      console.log(`\n✔ Aplicado em ${autoFix.length} conversa(s).`);
    } else {
      console.log("\n✔ DRY-RUN concluído — nenhuma escrita foi feita no banco.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("ERRO:", e?.message ?? e);
  process.exit(1);
});
