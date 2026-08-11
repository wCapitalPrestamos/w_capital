// Etiquetas es-MX para los enums del esquema

import type {
  ApplicationStatus,
  Channel,
  ConversationStatus,
  DocType,
  InstallmentStatus,
  LeadStage,
  LoanStatus,
  PaymentMethod,
  ReviewStatus,
  Role,
  SourceChannel,
} from "@/lib/types";

export const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  advisor: "Asesora",
  analyst: "Analista",
};

export const channelLabels: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
};

export const sourceChannelLabels: Record<SourceChannel, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  referral: "Recomendación",
  walk_in: "Visita en oficina",
  other: "Otro",
};

export const conversationStatusLabels: Record<ConversationStatus, string> = {
  bot: "Bot",
  human: "Humano",
  closed: "Cerrada",
};

export const leadStageLabels: Record<LeadStage, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  interested: "Interesado",
  applying: "En solicitud",
  discarded: "Descartado",
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  draft: "Borrador",
  docs_pending: "Documentos pendientes",
  under_review: "En análisis",
  approved: "Aprobada",
  rejected: "Rechazada",
  disbursed: "Desembolsada",
  cancelled: "Cancelada",
};

export const borrowerTypeLabels: Record<"personal" | "business", string> = {
  personal: "Personal",
  business: "Empresa / negocio",
};

export const collateralTypeLabels: Record<
  "property" | "car" | "machinery" | "other",
  string
> = {
  property: "Propiedad en Hermosillo (casa o terreno)",
  car: "Factura de automóvil (2010 en adelante)",
  machinery: "Maquinaria o equipo",
  other: "Otra garantía",
};

export const docTypeLabels: Record<DocType, string> = {
  credit_application: "Solicitud de crédito",
  bureau_authorization: "Autorización de buró",
  ine: "INE / Pasaporte",
  proof_of_address: "Comprobante de domicilio",
  proof_of_income: "Comprobante de ingresos",
  bank_statement: "Estado de cuenta bancario",
  collateral: "Garantía (propiedad o factura)",
  aval_ine: "INE del aval",
  other: "Otro documento",
};

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  pending: "Por revisar",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const loanStatusLabels: Record<LoanStatus, string> = {
  active: "Activo",
  paid_off: "Liquidado",
  overdue: "En mora",
  written_off: "Castigado",
};

export const installmentStatusLabels: Record<InstallmentStatus, string> = {
  pending: "Pendiente",
  partial: "Abono parcial",
  paid: "Pagada",
  overdue: "Vencida",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  deposit: "Depósito",
};

export function applicationFolio(folio: number): string {
  return `SOL-${String(folio).padStart(6, "0")}`;
}

export function loanFolio(folio: number): string {
  return `PRE-${String(folio).padStart(6, "0")}`;
}
