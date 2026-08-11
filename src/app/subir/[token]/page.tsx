import { PortalUploader } from "@/components/portal/uploader";
import { validatePortalToken } from "@/lib/portal-tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocType, DocumentRow } from "@/lib/types";

export const metadata = { title: "Sube tus documentos · W Capital" };

const BASE_REQUIRED: DocType[] = [
  "credit_application",
  "bureau_authorization",
  "ine",
  "proof_of_address",
  "proof_of_income",
  "collateral",
];

export default async function PortalPage({ params }: PageProps<"/subir/[token]">) {
  const { token: rawToken } = await params;
  const db = createAdminClient();

  const validation = await validatePortalToken(db, rawToken);

  if (!validation.valid) {
    return (
      <PortalShell>
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">
            {validation.reason === "expired"
              ? "Esta liga ya venció"
              : "Liga no válida"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {validation.reason === "expired"
              ? "Por seguridad, las ligas duran 7 días. Pídenos una nueva por WhatsApp o Messenger y con gusto te la enviamos."
              : "Verifica que copiaste la liga completa, o pídenos una nueva por WhatsApp o Messenger."}
          </p>
        </div>
      </PortalShell>
    );
  }

  const token = validation.token;

  const [{ data: app }, { data: documents }] = await Promise.all([
    db
      .from("loan_applications")
      .select("id, has_aval, contact:contacts(full_name)")
      .eq("id", token.application_id)
      .single(),
    db
      .from("documents")
      .select("*")
      .eq("application_id", token.application_id)
      .order("created_at", { ascending: false }),
  ]);

  const hasAval = Boolean(app?.has_aval);
  const required = hasAval ? [...BASE_REQUIRED, "aval_ine" as DocType] : BASE_REQUIRED;
  const contactName =
    (app?.contact as unknown as { full_name?: string } | null)?.full_name ?? "";

  return (
    <PortalShell>
      <PortalUploader
        rawToken={rawToken}
        requiredDocs={required}
        initialDocuments={(documents ?? []) as DocumentRow[]}
        contactName={contactName}
      />
    </PortalShell>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex-1 bg-background">
      <header className="bg-primary px-4 py-5 text-primary-foreground">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground text-xl font-black italic text-primary">
            W
          </div>
          <div>
            <p className="font-semibold leading-tight">W Capital</p>
            <p className="text-xs opacity-90">Impulsemos el futuro</p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-lg p-4 pb-10">{children}</div>
      <footer className="mx-auto max-w-lg px-4 pb-8 text-center text-[11px] leading-relaxed text-muted-foreground">
        Tus documentos se transmiten cifrados y solo los usa W Capital para evaluar
        tu solicitud de crédito, conforme a nuestro aviso de privacidad. Colosio 158
        local 6, Plaza Universidad, Col. Centenario, Hermosillo, Son.
      </footer>
    </main>
  );
}
