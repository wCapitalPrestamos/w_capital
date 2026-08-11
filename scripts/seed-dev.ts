/**
 * Seed de DESARROLLO — crea usuarios y datos de ejemplo en el Supabase local.
 * Uso:  node scripts/seed-dev.ts   (Node 23+, lee .env.local)
 * Idempotente a nivel práctico: usa upserts y busca por claves naturales.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildSchedule, addDays } from "../src/lib/loans/amortization.ts";

// Carga .env.local (sin dependencia de dotenv)
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = "wcapital123";

async function ensureUser(email: string, fullName: string, role: string) {
  const { data: list } = await db.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    await db.from("profiles").update({ full_name: fullName, role }).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) throw error;
  // El trigger crea el perfil; forzamos rol por si acaso
  await db.from("profiles").update({ full_name: fullName, role }).eq("id", data.user.id);
  return data.user.id;
}

async function ensureContact(c: {
  full_name: string;
  phone?: string;
  wa_id?: string;
  messenger_psid?: string;
  source_channel: string;
}) {
  const key = c.wa_id ? { col: "wa_id", val: c.wa_id } : { col: "messenger_psid", val: c.messenger_psid! };
  const { data: found } = await db.from("contacts").select("id").eq(key.col, key.val).maybeSingle();
  if (found) return found.id;
  const { data, error } = await db.from("contacts").insert(c).select("id").single();
  if (error) throw error;
  return data.id;
}

async function ensureConversation(contactId: string, channel: string, threadId: string, extra: object = {}) {
  const { data: found } = await db
    .from("conversations")
    .select("id")
    .eq("channel", channel)
    .eq("external_thread_id", threadId)
    .maybeSingle();
  if (found) return found.id;
  const { data, error } = await db
    .from("conversations")
    .insert({ contact_id: contactId, channel, external_thread_id: threadId, ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function addMessage(conversationId: string, msg: object) {
  const { error } = await db.from("messages").insert({ conversation_id: conversationId, ...msg });
  if (error && !error.message.includes("duplicate")) throw error;
}

async function main() {
  console.log("→ usuarios…");
  await ensureUser("admin@wcapital.mx", "Ulises Dessens", "admin");
  const advisorId = await ensureUser("asesora@wcapital.mx", "Karyme López", "advisor");
  await ensureUser("analista@wcapital.mx", "Lupita Calvo", "analyst");

  console.log("→ contactos y conversaciones…");
  const juanId = await ensureContact({
    full_name: "Juan Pérez",
    phone: "+526621234567",
    wa_id: "526621234567",
    source_channel: "whatsapp",
  });
  const mariaId = await ensureContact({
    full_name: "María González",
    phone: "+526627654321",
    wa_id: "526627654321",
    source_channel: "whatsapp",
  });
  const pedroId = await ensureContact({
    full_name: "Pedro Soto",
    messenger_psid: "24031234567890",
    source_channel: "messenger",
  });

  const convJuan = await ensureConversation(juanId, "whatsapp", "526621234567");
  await addMessage(convJuan, {
    direction: "inbound", sender_type: "client", body: "Hola, ¿cuáles son los requisitos para un préstamo?",
    external_message_id: "wamid.seed.1", status: "received",
  });
  await addMessage(convJuan, {
    direction: "outbound", sender_type: "bot",
    body: "¡Hola! Para iniciar necesitas: solicitud de crédito, INE vigente, comprobante de domicilio, comprobante de ingresos y una garantía (propiedad en Hermosillo o factura de auto 2010 en adelante). ¿Te gustaría comenzar?",
    external_message_id: "wamid.seed.2", status: "sent",
  });

  const convMaria = await ensureConversation(mariaId, "whatsapp", "526627654321", { status: "human" });
  await addMessage(convMaria, {
    direction: "inbound", sender_type: "client",
    body: "Tengo mi casa en empeño con otra financiera, ¿me pueden ayudar a recuperarla y cuánto me cobrarían en mi caso específico?",
    external_message_id: "wamid.seed.3", status: "received",
  });

  const convPedro = await ensureConversation(pedroId, "messenger", "24031234567890");
  await addMessage(convPedro, {
    direction: "inbound", sender_type: "client", body: "¿Dónde están ubicados?",
    external_message_id: "mid.seed.1", status: "received",
  });
  await addMessage(convPedro, {
    direction: "outbound", sender_type: "bot",
    body: "Nos ubicamos en Colosio 158 local 6, Plaza Universidad, Colonia Centenario, Hermosillo. Atendemos de 9:00 a 17:30 de lunes a viernes y sábados de 9:00 a 13:00.",
    external_message_id: "mid.seed.2", status: "sent",
  });

  console.log("→ leads…");
  const { data: leadExists } = await db.from("leads").select("id").eq("contact_id", juanId).maybeSingle();
  if (!leadExists) {
    await db.from("leads").insert([
      { contact_id: juanId, stage: "interested", interest_amount: 15000, assigned_to: advisorId },
      { contact_id: pedroId, stage: "new" },
    ]);
  }

  console.log("→ solicitudes…");
  const { data: appExists } = await db
    .from("loan_applications").select("id").eq("contact_id", mariaId).maybeSingle();
  let appMariaId = appExists?.id;
  if (!appMariaId) {
    const { data, error } = await db
      .from("loan_applications")
      .insert({
        contact_id: mariaId, requested_amount: 20000, term_weeks: 26,
        purpose: "Recuperar casa en empeño", collateral_type: "property",
        collateral_description: "Casa en Col. Centenario", status: "docs_pending",
        advisor_id: advisorId,
      })
      .select("id").single();
    if (error) throw error;
    appMariaId = data.id;
    await db.from("documents").insert([
      {
        application_id: appMariaId, contact_id: mariaId, doc_type: "ine",
        storage_path: `applications/${appMariaId}/ine/seed.jpg`, file_name: "ine.jpg",
        mime_type: "image/jpeg", size_bytes: 120000, uploaded_via: "portal",
      },
      {
        application_id: appMariaId, contact_id: mariaId, doc_type: "proof_of_address",
        storage_path: `applications/${appMariaId}/proof_of_address/seed.jpg`, file_name: "cfe.jpg",
        mime_type: "image/jpeg", size_bytes: 98000, uploaded_via: "portal",
        review_status: "approved", reviewed_by: advisorId, reviewed_at: new Date().toISOString(),
      },
    ]);
  }

  console.log("→ préstamo activo con historial…");
  const { data: loanExists } = await db.from("loans").select("id").limit(1).maybeSingle();
  if (!loanExists) {
    // Solicitud aprobada para Juan, desembolsada hace 8 semanas
    const { data: appJuan, error: appErr } = await db
      .from("loan_applications")
      .insert({
        contact_id: juanId, requested_amount: 10000, term_weeks: 26,
        purpose: "Capital de trabajo", collateral_type: "car",
        collateral_description: "Factura Versa 2019", status: "approved",
        approved_amount: 10000, approved_term_weeks: 26, advisor_id: advisorId,
      })
      .select("id").single();
    if (appErr) throw appErr;

    const today = new Date().toISOString().slice(0, 10);
    const disbursedAt = addDays(today, -56); // hace 8 semanas
    const firstPayment = addDays(disbursedAt, 7);
    const schedule = buildSchedule({
      principal: 10000, weeklyRate: 0.0197, termWeeks: 26, firstPaymentDate: firstPayment,
    });

    const { data: loanId, error: loanErr } = await db.rpc("create_loan_with_schedule", {
      p_application_id: appJuan.id,
      p_principal: 10000,
      p_weekly_rate: 0.0197,
      p_term_weeks: 26,
      p_weekly_payment: schedule.weeklyPayment,
      p_disbursed_at: disbursedAt,
      p_first_payment_date: firstPayment,
      p_installments: schedule.rows,
    });
    if (loanErr) throw loanErr;

    // Paga las primeras 5 semanas (una con abono partido en dos pagos)
    const { data: insts } = await db
      .from("installments").select("*").eq("loan_id", loanId).order("number");
    if (insts) {
      for (const inst of insts.slice(0, 5)) {
        const { error } = await db.rpc("record_payment", {
          p_loan_id: loanId,
          p_amount: inst.total_due,
          p_paid_on: inst.due_date,
          p_method: "cash",
          p_reference: null,
          p_note: null,
          p_allocations: [{
            installment_id: inst.id,
            interest_amount: inst.interest_due,
            principal_amount: inst.principal_due,
          }],
        });
        if (error) throw error;
      }
    }

    // Marca mora de las semanas 6-8 no pagadas
    const { error: overdueErr } = await db.rpc("mark_overdue", { p_today: today });
    if (overdueErr) throw overdueErr;
  }

  console.log("✔ Seed completo.");
  console.log(`  Usuarios: admin@wcapital.mx / asesora@wcapital.mx / analista@wcapital.mx`);
  console.log(`  Contraseña (dev): ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
