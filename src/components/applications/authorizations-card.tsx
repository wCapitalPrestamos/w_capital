"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { setApplicationAuthorization } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

type AuthType = "credit" | "bureau";

const LABELS: Record<AuthType, string> = {
  credit: "Solicitud de crédito",
  bureau: "Consulta en Buró de Crédito",
};

// No son documentos — son autorizaciones que el cliente acepta con un check
// en el portal. Aquí el staff solo las ve y, si hace falta (ej. el cliente
// autorizó en persona), las puede marcar a mano.
export function AuthorizationsCard({
  applicationId,
  creditAcceptedAt,
  bureauAcceptedAt,
}: {
  applicationId: string;
  creditAcceptedAt: string | null;
  bureauAcceptedAt: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Autorizaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AuthRow
          applicationId={applicationId}
          type="credit"
          acceptedAt={creditAcceptedAt}
        />
        <AuthRow
          applicationId={applicationId}
          type="bureau"
          acceptedAt={bureauAcceptedAt}
        />
      </CardContent>
    </Card>
  );
}

function AuthRow({
  applicationId,
  type,
  acceptedAt,
}: {
  applicationId: string;
  type: AuthType;
  acceptedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const result = await setApplicationAuthorization(
        applicationId,
        type,
        !acceptedAt,
      );
      if (!result.ok) toast.error(result.error ?? "No se pudo actualizar.");
    });
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center gap-2">
        {acceptedAt ? (
          <Check className="size-4 text-success" />
        ) : (
          <span className="size-4 rounded-full border-2 border-muted-foreground/40" />
        )}
        <div>
          <p className="font-medium">{LABELS[type]}</p>
          <p className="text-xs text-muted-foreground">
            {acceptedAt
              ? `Autorizado el ${formatDateTime(acceptedAt)}`
              : "Pendiente de autorizar"}
          </p>
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={toggle} disabled={pending}>
        {acceptedAt ? "Revertir" : "Marcar como autorizado"}
      </Button>
    </div>
  );
}
