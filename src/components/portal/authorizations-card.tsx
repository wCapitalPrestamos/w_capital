"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AuthType = "credit" | "bureau";

const COPY: Record<AuthType, string> = {
  credit:
    "Autorizo a W Capital a procesar mi solicitud de crédito con la información que he proporcionado.",
  bureau:
    "Autorizo a W Capital a consultar mi historial crediticio ante las Sociedades de Información Crediticia (Buró de Crédito), conforme a la Ley para Regular las Sociedades de Información Crediticia.",
};

export function AuthorizationsCard({
  rawToken,
  creditAcceptedAt,
  bureauAcceptedAt,
}: {
  rawToken: string;
  creditAcceptedAt: string | null;
  bureauAcceptedAt: string | null;
}) {
  const [credit, setCredit] = useState(creditAcceptedAt);
  const [bureau, setBureau] = useState(bureauAcceptedAt);
  const [busy, setBusy] = useState<AuthType | null>(null);

  const accept = async (type: AuthType) => {
    setBusy(type);
    try {
      const res = await fetch("/api/portal/accept-authorization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken, type }),
      }).then((r) => r.json());

      if (!res.ok) {
        toast.error(
          res.error === "token_invalid"
            ? "La liga venció. Pide una nueva por WhatsApp."
            : "No se pudo registrar tu autorización. Intenta de nuevo.",
        );
        return;
      }
      if (type === "credit") setCredit(res.accepted_at);
      else setBureau(res.accepted_at);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold">Autorizaciones</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Estas no son documentos — solo confirma con un clic.
      </p>
      <div className="mt-3 space-y-2.5">
        <AuthRow
          label={COPY.credit}
          accepted={credit}
          busy={busy === "credit"}
          onAccept={() => accept("credit")}
        />
        <AuthRow
          label={COPY.bureau}
          accepted={bureau}
          busy={busy === "bureau"}
          onAccept={() => accept("bureau")}
        />
      </div>
    </div>
  );
}

function AuthRow({
  label,
  accepted,
  busy,
  onAccept,
}: {
  label: string;
  accepted: string | null;
  busy: boolean;
  onAccept: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-xs leading-relaxed",
        accepted && "border-success/40 bg-success/5",
      )}
    >
      <input
        type="checkbox"
        checked={Boolean(accepted)}
        disabled={Boolean(accepted) || busy}
        onChange={() => !accepted && onAccept()}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="flex-1">{label}</span>
      {accepted && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
    </label>
  );
}
