import type { ApplicationStatus } from "@/lib/types";

// Transiciones de status permitidas (validación de flujo, no de rol).
// Vive fuera de actions/applications.ts porque ese archivo es "use server" y
// solo puede exportar funciones async — un objeto plano ahí rompe el módulo.
export const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ["docs_pending", "cancelled"],
  docs_pending: ["under_review", "cancelled"],
  under_review: ["approved", "rejected", "docs_pending", "cancelled"],
  approved: ["cancelled"], // → disbursed solo vía RPC de desembolso
  rejected: ["under_review"],
  disbursed: [],
  cancelled: ["draft"],
};
