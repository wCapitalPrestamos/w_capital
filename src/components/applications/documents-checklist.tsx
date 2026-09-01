"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, FileUp, X } from "lucide-react";
import { toast } from "sonner";
import {
  confirmStaffUpload,
  createStaffUploadUrl,
  getDocumentUrl,
  reviewDocument,
} from "@/actions/documents";
import { ReviewStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { docTypeLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type { DocType, DocumentRow } from "@/lib/types";

// La solicitud de crédito y la autorización de buró NO son documentos que se
// suban — son autorizaciones que el cliente acepta con un check (ver
// AuthorizationsCard). Solo lo que realmente es un archivo va aquí.
const BASE_REQUIRED: DocType[] = [
  "ine",
  "proof_of_address",
  "proof_of_income",
  "collateral",
];

export function DocumentsChecklist({
  applicationId,
  hasAval,
  documents,
}: {
  applicationId: string;
  hasAval: boolean;
  documents: DocumentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploadingType, setUploadingType] = useState<DocType | null>(null);
  const [rejecting, setRejecting] = useState<DocumentRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const required = hasAval ? [...BASE_REQUIRED, "aval_ine" as DocType] : BASE_REQUIRED;

  const handlePickFile = (docType: DocType) => {
    setUploadingType(docType);
    fileInputRef.current?.click();
  };

  const handleFile = (file: File | null) => {
    const docType = uploadingType;
    setUploadingType(null);
    if (!file || !docType) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo supera 10 MB.");
      return;
    }

    startTransition(async () => {
      const prep = await createStaffUploadUrl(applicationId, docType, file.name);
      if (!prep.ok || !prep.path || !prep.token) {
        toast.error(prep.error ?? "No se pudo preparar la subida.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(prep.path, prep.token, file);

      if (error) {
        toast.error(`Falló la subida: ${error.message}`);
        return;
      }

      const confirm = await confirmStaffUpload({
        applicationId,
        docType,
        path: prep.path,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      if (confirm.ok) {
        toast.success("Documento subido.");
        router.refresh();
      } else {
        toast.error(confirm.error ?? "No se pudo registrar el documento.");
      }
    });
  };

  const handleView = (doc: DocumentRow) => {
    startTransition(async () => {
      const result = await getDocumentUrl(doc.id);
      if (result.ok && result.url) window.open(result.url, "_blank");
      else toast.error(result.error ?? "No se pudo abrir el documento.");
    });
  };

  const handleApprove = (doc: DocumentRow) => {
    startTransition(async () => {
      const result = await reviewDocument(doc.id, "approved");
      if (result.ok) {
        toast.success("Documento aprobado.");
        router.refresh();
      } else toast.error(result.error ?? "Error al aprobar.");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Expediente de documentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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

        {required.map((docType) => {
          const docs = documents.filter((d) => d.doc_type === docType);
          const hasApproved = docs.some((d) => d.review_status === "approved");
          return (
            <div key={docType} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {hasApproved ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <span className="size-4 rounded-full border-2 border-muted-foreground/40" />
                  )}
                  {docTypeLabels[docType]}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePickFile(docType)}
                  disabled={pending}
                >
                  <FileUp className="size-4" /> Subir
                </Button>
              </div>

              {docs.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {doc.file_name}
                        <span className="ml-2 text-muted-foreground">
                          {formatDateTime(doc.created_at)} ·{" "}
                          {doc.uploaded_via === "portal" ? "cliente" : "oficina"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ReviewStatusBadge status={doc.review_status} />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => handleView(doc)}
                          aria-label="Ver documento"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        {doc.review_status === "pending" && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-success"
                              onClick={() => handleApprove(doc)}
                              aria-label="Aprobar"
                            >
                              <Check className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-destructive"
                              onClick={() => setRejecting(doc)}
                              aria-label="Rechazar"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </span>
                      {doc.review_status === "rejected" && doc.review_note && (
                        <p className="w-full text-destructive">Motivo: {doc.review_note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground">
          ¿Sin comprobante de ingresos? Se aceptan los últimos 3 estados de cuenta
          bancarios.
        </p>
      </CardContent>

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)} disablePointerDismissal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar documento</DialogTitle>
          </DialogHeader>
          <form
            action={(formData) => {
              const doc = rejecting;
              if (!doc) return;
              startTransition(async () => {
                const result = await reviewDocument(
                  doc.id,
                  "rejected",
                  String(formData.get("note") ?? "").trim() || undefined,
                );
                if (result.ok) {
                  toast.success("Documento rechazado.");
                  setRejecting(null);
                  router.refresh();
                } else toast.error(result.error ?? "Error al rechazar.");
              });
            }}
            className="grid gap-4 px-7 py-[22px]"
          >
            <div className="grid gap-2">
              <Label htmlFor="note">Motivo (visible para el cliente en el portal)</Label>
              <Textarea
                id="note"
                name="note"
                rows={2}
                placeholder="Ilegible, vuelve a subir la foto…"
                required
              />
            </div>
            <Button type="submit" variant="destructive" disabled={pending}>
              Confirmar rechazo
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
