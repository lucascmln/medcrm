import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // ========================
  // SUPER ADMIN
  // ========================
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@medcrm.com" },
    update: {},
    create: {
      email: "superadmin@medcrm.com",
      name: "Super Admin",
      password: await bcrypt.hash("admin123", 10),
      role: "SUPER_ADMIN",
    },
  });
  console.log("✅ Super admin criado:", superAdmin.email);

  // ========================
  // TENANT 1 — Clínica Estética
  // ========================
  const tenant1 = await prisma.tenant.upsert({
    where: { slug: "clinica-estetica-bella" },
    update: {},
    create: {
      name: "Clínica Estética Bella",
      slug: "clinica-estetica-bella",
      primaryColor: "#0284c7",
      plan: "pro",
    },
  });

  // Admin do tenant 1
  const adminT1 = await prisma.user.upsert({
    where: { email: "admin@bellaClinica.com" },
    update: {},
    create: {
      tenantId: tenant1.id,
      email: "admin@bellaClinica.com",
      name: "Dr. Ricardo Mendes",
      password: await bcrypt.hash("admin123", 10),
      role: "ADMIN",
    },
  });

  // Usuários do tenant 1
  const attendant1 = await prisma.user.upsert({
    where: { email: "juliana@bellaClinica.com" },
    update: {},
    create: {
      tenantId: tenant1.id,
      email: "juliana@bellaClinica.com",
      name: "Juliana Costa",
      password: await bcrypt.hash("admin123", 10),
      role: "ATTENDANT",
    },
  });

  const attendant2 = await prisma.user.upsert({
    where: { email: "fernanda@bellaClinica.com" },
    update: {},
    create: {
      tenantId: tenant1.id,
      email: "fernanda@bellaClinica.com",
      name: "Fernanda Oliveira",
      password: await bcrypt.hash("admin123", 10),
      role: "ATTENDANT",
    },
  });

  const manager1 = await prisma.user.upsert({
    where: { email: "gestor@bellaClinica.com" },
    update: {},
    create: {
      tenantId: tenant1.id,
      email: "gestor@bellaClinica.com",
      name: "Carlos Andrade",
      password: await bcrypt.hash("admin123", 10),
      role: "MANAGER",
    },
  });

  // Unidades do tenant 1
  const unit1a = await prisma.unit.upsert({
    where: { id: "unit-bella-moema" },
    update: {},
    create: {
      id: "unit-bella-moema",
      tenantId: tenant1.id,
      name: "Unidade Moema",
      address: "Av. Ibirapuera, 2907 - Moema, São Paulo",
      phone: "(11) 3333-1111",
    },
  });

  const unit1b = await prisma.unit.upsert({
    where: { id: "unit-bella-itaim" },
    update: {},
    create: {
      id: "unit-bella-itaim",
      tenantId: tenant1.id,
      name: "Unidade Itaim",
      address: "R. Leopoldo Couto de Magalhães Jr., 110 - Itaim Bibi",
      phone: "(11) 3333-2222",
    },
  });

  // Médicos do tenant 1
  const doctor1 = await prisma.doctor.upsert({
    where: { id: "doctor-bella-1" },
    update: {},
    create: {
      id: "doctor-bella-1",
      tenantId: tenant1.id,
      unitId: unit1a.id,
      name: "Dr. Ricardo Mendes",
      crm: "CRM/SP 123456",
      specialty: "Cirurgia Plástica",
      email: "dr.ricardo@bellaClinica.com",
    },
  });

  const doctor2 = await prisma.doctor.upsert({
    where: { id: "doctor-bella-2" },
    update: {},
    create: {
      id: "doctor-bella-2",
      tenantId: tenant1.id,
      unitId: unit1b.id,
      name: "Dra. Ana Paula Lima",
      crm: "CRM/SP 654321",
      specialty: "Dermatologia",
      email: "dra.ana@bellaClinica.com",
    },
  });

  // Canais de origem do tenant 1
  const sources1 = await Promise.all([
    prisma.leadSource.upsert({
      where: { id: "src-bella-whatsapp" },
      update: {},
      create: {
        id: "src-bella-whatsapp",
        tenantId: tenant1.id,
        name: "WhatsApp",
        icon: "MessageCircle",
        color: "#25D366",
      },
    }),
    prisma.leadSource.upsert({
      where: { id: "src-bella-instagram" },
      update: {},
      create: {
        id: "src-bella-instagram",
        tenantId: tenant1.id,
        name: "Instagram",
        icon: "Instagram",
        color: "#E1306C",
      },
    }),
    prisma.leadSource.upsert({
      where: { id: "src-bella-meta" },
      update: {},
      create: {
        id: "src-bella-meta",
        tenantId: tenant1.id,
        name: "Meta Ads",
        icon: "Target",
        color: "#1877F2",
      },
    }),
    prisma.leadSource.upsert({
      where: { id: "src-bella-google" },
      update: {},
      create: {
        id: "src-bella-google",
        tenantId: tenant1.id,
        name: "Google Ads",
        icon: "Search",
        color: "#EA4335",
      },
    }),
    prisma.leadSource.upsert({
      where: { id: "src-bella-site" },
      update: {},
      create: {
        id: "src-bella-site",
        tenantId: tenant1.id,
        name: "Site",
        icon: "Globe",
        color: "#7C3AED",
      },
    }),
    prisma.leadSource.upsert({
      where: { id: "src-bella-indicacao" },
      update: {},
      create: {
        id: "src-bella-indicacao",
        tenantId: tenant1.id,
        name: "Indicação",
        icon: "Users",
        color: "#059669",
      },
    }),
  ]);

  // Suborigens
  await Promise.all([
    prisma.leadSubsource.upsert({
      where: { id: "subsrc-bella-wa-organico" },
      update: {},
      create: {
        id: "subsrc-bella-wa-organico",
        sourceId: sources1[0].id,
        name: "WhatsApp Orgânico",
      },
    }),
    prisma.leadSubsource.upsert({
      where: { id: "subsrc-bella-wa-instagram" },
      update: {},
      create: {
        id: "subsrc-bella-wa-instagram",
        sourceId: sources1[0].id,
        name: "WhatsApp via Instagram",
      },
    }),
    prisma.leadSubsource.upsert({
      where: { id: "subsrc-bella-ig-direct" },
      update: {},
      create: {
        id: "subsrc-bella-ig-direct",
        sourceId: sources1[1].id,
        name: "Instagram Direct",
      },
    }),
    prisma.leadSubsource.upsert({
      where: { id: "subsrc-bella-meta-rhino" },
      update: {},
      create: {
        id: "subsrc-bella-meta-rhino",
        sourceId: sources1[2].id,
        name: "Campanha Rinoplastia",
      },
    }),
    prisma.leadSubsource.upsert({
      where: { id: "subsrc-bella-meta-lipo" },
      update: {},
      create: {
        id: "subsrc-bella-meta-lipo",
        sourceId: sources1[2].id,
        name: "Campanha Lipoaspiração",
      },
    }),
    prisma.leadSubsource.upsert({
      where: { id: "subsrc-bella-google-implante" },
      update: {},
      create: {
        id: "subsrc-bella-google-implante",
        sourceId: sources1[3].id,
        name: "Campanha Implante Mamário",
      },
    }),
  ]);

  // Funil do tenant 1
  const stages1 = await Promise.all([
    prisma.funnelStage.upsert({
      where: { id: "stage-bella-1" },
      update: {},
      create: {
        id: "stage-bella-1",
        tenantId: tenant1.id,
        name: "Novo Lead",
        color: "#64748b",
        order: 1,
        isDefault: true,
      },
    }),
    prisma.funnelStage.upsert({
      where: { id: "stage-bella-2" },
      update: {},
      create: {
        id: "stage-bella-2",
        tenantId: tenant1.id,
        name: "Em Atendimento",
        color: "#3b82f6",
        order: 2,
      },
    }),
    prisma.funnelStage.upsert({
      where: { id: "stage-bella-3" },
      update: {},
      create: {
        id: "stage-bella-3",
        tenantId: tenant1.id,
        name: "Aguardando Retorno",
        color: "#f59e0b",
        order: 3,
      },
    }),
    prisma.funnelStage.upsert({
      where: { id: "stage-bella-4" },
      update: {},
      create: {
        id: "stage-bella-4",
        tenantId: tenant1.id,
        name: "Agendado",
        color: "#8b5cf6",
        order: 4,
      },
    }),
    prisma.funnelStage.upsert({
      where: { id: "stage-bella-5" },
      update: {},
      create: {
        id: "stage-bella-5",
        tenantId: tenant1.id,
        name: "Compareceu",
        color: "#06b6d4",
        order: 5,
      },
    }),
    prisma.funnelStage.upsert({
      where: { id: "stage-bella-6" },
      update: {},
      create: {
        id: "stage-bella-6",
        tenantId: tenant1.id,
        name: "Fechado",
        color: "#10b981",
        order: 6,
        isFinal: true,
      },
    }),
    prisma.funnelStage.upsert({
      where: { id: "stage-bella-7" },
      update: {},
      create: {
        id: "stage-bella-7",
        tenantId: tenant1.id,
        name: "Perdido",
        color: "#ef4444",
        order: 7,
        isLost: true,
      },
    }),
  ]);

  // Motivos de perda
  const lossReasons1 = await Promise.all([
    prisma.lossReason.upsert({
      where: { id: "lr-bella-1" },
      update: {},
      create: { id: "lr-bella-1", tenantId: tenant1.id, name: "Preço alto" },
    }),
    prisma.lossReason.upsert({
      where: { id: "lr-bella-2" },
      update: {},
      create: { id: "lr-bella-2", tenantId: tenant1.id, name: "Não respondeu" },
    }),
    prisma.lossReason.upsert({
      where: { id: "lr-bella-3" },
      update: {},
      create: { id: "lr-bella-3", tenantId: tenant1.id, name: "Foi para concorrente" },
    }),
    prisma.lossReason.upsert({
      where: { id: "lr-bella-4" },
      update: {},
      create: { id: "lr-bella-4", tenantId: tenant1.id, name: "Desistiu do procedimento" },
    }),
  ]);

  // Tags
  await Promise.all([
    prisma.tag.upsert({
      where: { id: "tag-bella-vip" },
      update: {},
      create: { id: "tag-bella-vip", tenantId: tenant1.id, name: "VIP", color: "#f59e0b" },
    }),
    prisma.tag.upsert({
      where: { id: "tag-bella-urgente" },
      update: {},
      create: { id: "tag-bella-urgente", tenantId: tenant1.id, name: "Urgente", color: "#ef4444" },
    }),
    prisma.tag.upsert({
      where: { id: "tag-bella-retorno" },
      update: {},
      create: { id: "tag-bella-retorno", tenantId: tenant1.id, name: "Retorno", color: "#8b5cf6" },
    }),
  ]);

  // Campanhas
  const campaigns1 = await Promise.all([
    prisma.campaign.upsert({
      where: { id: "camp-bella-1" },
      update: {},
      create: {
        id: "camp-bella-1",
        tenantId: tenant1.id,
        name: "Rinoplastia Janeiro 2025",
        channel: "Meta Ads",
        budget: 3000,
        isActive: false,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-01-31"),
      },
    }),
    prisma.campaign.upsert({
      where: { id: "camp-bella-2" },
      update: {},
      create: {
        id: "camp-bella-2",
        tenantId: tenant1.id,
        name: "Lipoaspiração Verão",
        channel: "Meta Ads",
        budget: 5000,
        isActive: true,
        startDate: new Date("2025-02-01"),
      },
    }),
    prisma.campaign.upsert({
      where: { id: "camp-bella-3" },
      update: {},
      create: {
        id: "camp-bella-3",
        tenantId: tenant1.id,
        name: "Google - Implante Mamário",
        channel: "Google Ads",
        budget: 2500,
        isActive: true,
        startDate: new Date("2025-01-15"),
      },
    }),
  ]);

  // API Key
  await prisma.apiKey.upsert({
    where: { key: "wh_bella_demo_key_123456789" },
    update: {},
    create: {
      tenantId: tenant1.id,
      name: "Webhook Site Principal",
      key: "wh_bella_demo_key_123456789",
    },
  });

  // ========================
  // LEADS DE DEMONSTRAÇÃO
  // ========================
  const leadData = [
    {
      name: "Marina Santos",
      phone: "(11) 98765-4321",
      email: "marina@email.com",
      procedure: "Rinoplastia",
      stageIdx: 1,
      sourceIdx: 0,
      doctorId: doctor1.id,
      assignedToId: attendant1.id,
      unitId: unit1a.id,
      potentialValue: 12000,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Camila Ferreira",
      phone: "(11) 97654-3210",
      email: "camila@email.com",
      procedure: "Lipoaspiração",
      stageIdx: 3,
      sourceIdx: 2,
      campaignIdx: 1,
      doctorId: doctor1.id,
      assignedToId: attendant1.id,
      unitId: unit1a.id,
      potentialValue: 18000,
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Beatriz Alves",
      phone: "(21) 96543-2109",
      procedure: "Implante Mamário",
      stageIdx: 5,
      sourceIdx: 3,
      campaignIdx: 2,
      doctorId: doctor1.id,
      assignedToId: attendant2.id,
      unitId: unit1b.id,
      potentialValue: 22000,
      firstContactAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      scheduledAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      attendedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Larissa Mendes",
      phone: "(11) 95432-1098",
      email: "larissa@email.com",
      procedure: "Botox",
      stageIdx: 1,
      sourceIdx: 1,
      doctorId: doctor2.id,
      assignedToId: attendant1.id,
      unitId: unit1b.id,
      potentialValue: 2500,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Ana Clara Rocha",
      phone: "(11) 94321-0987",
      procedure: "Harmonização Facial",
      stageIdx: 6,
      sourceIdx: 0,
      lossReasonId: lossReasons1[0].id,
      assignedToId: attendant2.id,
      unitId: unit1a.id,
      potentialValue: 4500,
      lostAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Patrícia Lima",
      phone: "(11) 93210-9876",
      email: "patricia@email.com",
      procedure: "Lipoaspiração",
      stageIdx: 2,
      sourceIdx: 4,
      doctorId: doctor1.id,
      assignedToId: attendant1.id,
      unitId: unit1a.id,
      potentialValue: 15000,
      firstContactAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Vanessa Cardoso",
      phone: "(21) 92109-8765",
      procedure: "Rinoplastia",
      stageIdx: 0,
      sourceIdx: 2,
      campaignIdx: 0,
      assignedToId: attendant2.id,
      unitId: unit1b.id,
      potentialValue: 13000,
      slaBreached: true,
      createdAt: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Juliana Torres",
      phone: "(11) 91098-7654",
      email: "juliana.t@email.com",
      procedure: "Abdominoplastia",
      stageIdx: 4,
      sourceIdx: 5,
      doctorId: doctor1.id,
      assignedToId: attendant1.id,
      unitId: unit1a.id,
      potentialValue: 20000,
      firstContactAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      scheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      attendedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Roberta Nascimento",
      phone: "(11) 90987-6543",
      procedure: "Blefaroplastia",
      stageIdx: 3,
      sourceIdx: 3,
      campaignIdx: 2,
      doctorId: doctor2.id,
      assignedToId: attendant2.id,
      unitId: unit1b.id,
      potentialValue: 9000,
      scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Cristiane Moura",
      phone: "(11) 98877-6655",
      email: "cris@email.com",
      procedure: "Otoplastia",
      stageIdx: 1,
      sourceIdx: 1,
      doctorId: doctor1.id,
      assignedToId: attendant1.id,
      unitId: unit1a.id,
      potentialValue: 7500,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Débora Pinheiro",
      phone: "(11) 97766-5544",
      procedure: "Prótese de Glúteo",
      stageIdx: 6,
      sourceIdx: 2,
      campaignIdx: 1,
      lossReasonId: lossReasons1[2].id,
      assignedToId: attendant2.id,
      unitId: unit1b.id,
      potentialValue: 16000,
      lostAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
    },
    {
      name: "Marcela Freitas",
      phone: "(21) 96655-4433",
      email: "marcela@email.com",
      procedure: "Lipoaspiração",
      stageIdx: 5,
      sourceIdx: 0,
      doctorId: doctor1.id,
      assignedToId: attendant1.id,
      unitId: unit1a.id,
      potentialValue: 17000,
      firstContactAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      scheduledAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      attendedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const lead of leadData) {
    const existing = await prisma.lead.findFirst({
      where: { tenantId: tenant1.id, phone: lead.phone },
    });
    if (existing) continue;

    await prisma.lead.create({
      data: {
        tenantId: tenant1.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        procedure: lead.procedure,
        potentialValue: lead.potentialValue,
        funnelStageId: stages1[lead.stageIdx].id,
        sourceId: sources1[lead.sourceIdx].id,
        campaignId: lead.campaignIdx !== undefined ? campaigns1[lead.campaignIdx].id : undefined,
        doctorId: lead.doctorId,
        assignedToId: lead.assignedToId,
        unitId: lead.unitId,
        lossReasonId: lead.lossReasonId,
        firstContactAt: lead.firstContactAt,
        scheduledAt: lead.scheduledAt,
        attendedAt: lead.attendedAt,
        closedAt: lead.closedAt,
        lostAt: lead.lostAt,
        slaBreached: lead.slaBreached ?? false,
        createdAt: lead.createdAt,
      },
    });
  }

  console.log(`✅ ${leadData.length} leads criados`);
  console.log("\n🎉 Seed concluído com sucesso!\n");
  console.log("📋 Credenciais de acesso:");
  console.log("  Super Admin:  superadmin@medcrm.com  / admin123");
  console.log("  Admin Clínica: admin@bellaClinica.com / admin123");
  console.log("  Gestor:       gestor@bellaClinica.com / admin123");
  console.log("  Atendente 1:  juliana@bellaClinica.com / admin123");
  console.log("  Atendente 2:  fernanda@bellaClinica.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
