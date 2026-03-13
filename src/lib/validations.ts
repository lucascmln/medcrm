import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const leadSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().min(10, "Telefone inválido"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  procedure: z.string().optional(),
  potentialValue: z.coerce.number().positive().optional().nullable(),
  observations: z.string().optional(),
  sourceId: z.string().optional().nullable(),
  subsourceId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  funnelStageId: z.string().min(1, "Etapa do funil é obrigatória"),
  doctorId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  lossReasonId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
});

export const userSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
  role: z.enum(["ADMIN", "MANAGER", "ATTENDANT", "DOCTOR"]),
  unitId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const doctorSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  crm: z.string().optional(),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  unitId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const unitSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  address: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const noteSchema = z.object({
  content: z.string().min(1, "Conteúdo não pode ser vazio"),
  isPrivate: z.boolean().optional(),
});

export const tenantSettingsSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
});

export const webhookLeadSchema = z.object({
  apiKey: z.string().min(1, "API Key obrigatória"),
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  channel: z.string().optional(),
  subsource: z.string().optional(),
  campaign: z.string().optional(),
  observations: z.string().optional(),
  procedure: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LeadInput = z.infer<typeof leadSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type DoctorInput = z.infer<typeof doctorSchema>;
export type UnitInput = z.infer<typeof unitSchema>;
export type NoteInput = z.infer<typeof noteSchema>;
export type TenantSettingsInput = z.infer<typeof tenantSettingsSchema>;
export type WebhookLeadInput = z.infer<typeof webhookLeadSchema>;
