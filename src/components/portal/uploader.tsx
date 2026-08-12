"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Clock3, RefreshCcw, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { docTypeLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type { DocType, DocumentRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;

type SlotState =
  | { kind: "missing" }
  | { kind: "pending" }
  | { kind: "approved" }
  | { kind: "rejected"; note: string | null };

function slotState(docs: DocumentRow[]): SlotState {
  if (docs.length === 0) return { kind: "missing" };
  if (docs.some((d) => d.review_status === "approved")) return { kind: "approved" };
  if (docs.some((d) => d.review_status === "pending")) return { kind: "pending" };
  const rejected = docs.find((d) => d.review_status === "rejected");
  return { kind: "rejected", note: rejected?.review_note ?? null };
}

export function PortalUploader({
  rawToken,
  requiredDocs,
  initialDocuments,
  contactName,
}: {
  rawToken: string;
  requiredDocs: DocType[];
  initialDocuments: DocumentRow[];
  contactName: string;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [busyType, setBusyType] = useState<DocType | null>(null);
  const [pickingType, setPickingType] = useState<DocType | null>(null);
  const [name, setName] = useState(contactName);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveName = async () => {
    const fullName = nameDraft.trim();
    if (fullName.length < 2) {
      toast.error("Escribe tu nombre completo.");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/portal/set-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken, full_name: fullName }),
      }).then((r) => r.json());
      if (!res.ok) {
        toast.error(
          res.error === "token_invalid"
            ? "La liga venció. Pide una nueva por WhatsApp."
            : "No se pudo guardar tu nombre. Intenta de nuevo.",
        );
        return;
      }
      setName(fullName);
    } finally {
      setSavingName(false);
    }
  };

  const uploadedCount = requiredDocs.filter(
    (t) => slotState(documents.filter((d) => d.doc_type === t)).kind !== "missing",
  ).length;

  const handlePick = (docType: DocType) => {
    setPickingType(docType);
    fileInputRef.current?.click();
  };

  const handleFile = async (file: File | null) => {
    const docType = pickingType;
    setPickingType(null);
    if (!file || !docType) return;

    setBusyType(docType);
    try {
      let toUpload: File = file;

      // Comprime imágenes en el navegador (fotos de celular de 5-10 MB → ~1 MB)
      if (file.type.startsWith("image/")) {
        try {
          const { default: imageCompression } = await import("browser-image-compression");
          toUpload = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
            fileType: "image/jpeg",
          });
        } catch {
          // Si la compresión falla, intenta con el original
        }
      }

      if (toUpload.size > MAX_BYTES) {
        toast.error("El archivo es muy pesado (máximo 10 MB).");
        return;
      }

      const prep = await fetch("/api/portal/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: rawToken,
          doc_type: docType,
          file_name: toUpload.name || file.name || "documento.jpg",
        }),
      }).then((r) => r.json());

      if (!prep.ok) {
        toast.error(
          prep.error === "token_invalid"
            ? "La liga venció. Pide una nueva por WhatsApp."
            : "No se pudo preparar la subida. Intenta de nuevo.",
        );
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(prep.path, prep.upload_token, toUpload);

      if (uploadError) {
        toast.error("Falló la subida. Revisa tu conexión e intenta de nuevo.");
        return;
      }

      const confirm = await fetch("/api/portal/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: rawToken,
          doc_type: docType,
          path: prep.path,
          file_name: toUpload.name || file.name || "documento.jpg",
          mime_type: toUpload.type || "application/octet-stream",
          size_bytes: toUpload.size,
        }),
      }).then((r) => r.json());

      if (!confirm.ok) {
        toast.error("El archivo subió pero no se registró. Intenta de nuevo.");
        return;
      }

      // Registra localmente para reflejar el nuevo estado
      setDocuments((prev) => [
        {
          id: crypto.randomUUID(),
          application_id: "",
          contact_id: "",
          doc_type: docType,
          storage_path: prep.path,
          file_name: toUpload.name || "documento",
          mime_type: toUpload.type,
          size_bytes: toUpload.size,
          uploaded_via: "portal",
          upload_token_id: null,
          review_status: "pending",
          review_note: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success("¡Documento recibido!");
    } finally {
      setBusyType(null);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h1 className="text-lg font-semibold">
          {name ? `Hola, ${name.split(" ")[0]} 👋` : "Hola 👋"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube una foto clara o PDF de cada documento para avanzar con tu préstamo.
          Puedes tomar la foto directamente con tu celular.
        </p>
        {!name && (
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Tu nombre completo"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
              }}
              disabled={savingName}
            />
            <Button onClick={handleSaveName} disabled={savingName}>
              {savingName ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(uploadedCount / requiredDocs.length) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {uploadedCount} de {requiredDocs.length} documentos
        </p>
      </div>

      {requiredDocs.map((docType) => {
        const state = slotState(documents.filter((d) => d.doc_type === docType));
        const busy = busyType === docType;

        return (
          <div
            key={docType}
            className={cn(
              "rounded-2xl border bg-card p-4 shadow-sm",
              state.kind === "rejected" && "border-destructive/40",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <StateIcon state={state} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{docTypeLabels[docType]}</p>
                  <p className="text-xs text-muted-foreground">
                    {state.kind === "missing" && "Falta por subir"}
                    {state.kind === "pending" && "En revisión por W Capital"}
                    {state.kind === "approved" && "Aprobado ✓"}
                    {state.kind === "rejected" &&
                      (state.note ? `Rechazado: ${state.note}` : "Rechazado, vuelve a subirlo")}
                  </p>
                </div>
              </div>

              {state.kind === "missing" && (
                <Button size="sm" onClick={() => handlePick(docType)} disabled={busy}>
                  <Upload className="size-4" /> {busy ? "Subiendo…" : "Subir"}
                </Button>
              )}
              {state.kind === "rejected" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePick(docType)}
                  disabled={busy}
                >
                  <RefreshCcw className="size-4" /> {busy ? "Subiendo…" : "Reintentar"}
                </Button>
              )}
              {state.kind === "pending" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePick(docType)}
                  disabled={busy}
                >
                  {busy ? "Subiendo…" : "Cambiar"}
                </Button>
              )}
            </div>
          </div>
        );
      })}

      <div className="rounded-2xl bg-accent p-4 text-xs leading-relaxed text-accent-foreground">
        ¿Sin comprobante de ingresos? También aceptamos tus últimos 3 estados de
        cuenta bancarios (súbelos en ese apartado). Si tienes dudas, escríbenos por
        WhatsApp y con gusto te ayudamos.
      </div>
    </div>
  );
}

function StateIcon({ state }: { state: SlotState }) {
  if (state.kind === "approved")
    return <CheckCircle2 className="size-6 shrink-0 text-success" />;
  if (state.kind === "pending")
    return <Clock3 className="size-6 shrink-0 text-warning" />;
  if (state.kind === "rejected")
    return <XCircle className="size-6 shrink-0 text-destructive" />;
  return <span className="size-6 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/40" />;
}
