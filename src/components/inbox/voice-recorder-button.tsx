"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Trash2 } from "lucide-react";
import Recorder from "opus-recorder";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Graba directo a Ogg Opus (vía opus-recorder, WASM en un worker) en vez de
// usar MediaRecorder nativo: Chrome/Edge solo pueden grabar en webm/opus, y
// WhatsApp no acepta ese formato para notas de voz salientes — solo
// ogg-opus, mp3, aac, amr o mp4-audio.
const ENCODER_PATH = "/opus-recorder/encoderWorker.min.js";

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorderButton({
  disabled,
  onRecordingChange,
  onSend,
}: {
  disabled: boolean;
  onRecordingChange: (recording: boolean) => void;
  onSend: (file: File) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<Recorder | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.close();
    };
  }, []);

  const getRecorder = () => {
    if (!recorderRef.current) {
      const recorder = new Recorder({
        encoderPath: ENCODER_PATH,
        encoderSampleRate: 24000,
        encoderBitRate: 24000,
        encoderApplication: 2048, // VOIP: optimizado para voz, no música
        numberOfChannels: 1,
      });
      recorder.ondataavailable = (typedArray) => {
        if (!cancelledRef.current) {
          // Copia a un ArrayBuffer propio: el worker puede entregar un
          // buffer que TS no acepta directamente como BlobPart.
          const buffer = new ArrayBuffer(typedArray.byteLength);
          new Uint8Array(buffer).set(typedArray);
          const blob = new Blob([buffer], { type: "audio/ogg" });
          onSend(new File([blob], `nota-de-voz-${Date.now()}.ogg`, { type: "audio/ogg" }));
        }
      };
      recorderRef.current = recorder;
    }
    return recorderRef.current;
  };

  const setRecordingState = (value: boolean) => {
    setRecording(value);
    onRecordingChange(value);
  };

  const handleStart = async () => {
    if (disabled || recording) return;
    try {
      cancelledRef.current = false;
      await getRecorder().start();
      setRecordingState(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleSend = () => {
    cancelledRef.current = false;
    recorderRef.current?.stop();
    setRecordingState(false);
    stopTimer();
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
    setRecordingState(false);
    stopTimer();
  };

  if (recording) {
    return (
      <div className="flex h-11 flex-1 items-center gap-2.5 rounded-[14px] border border-line-2 bg-background px-3.5">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-destructive" />
        <span className="flex-1 font-mono text-[13px] tabular-nums text-ink-2">
          {formatSeconds(seconds)}
        </span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={handleCancel}
          aria-label="Cancelar grabación"
        >
          <Trash2 className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          onClick={handleSend}
          aria-label="Enviar nota de voz"
          className="rounded-full"
        >
          <Send className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      onClick={handleStart}
      disabled={disabled}
      aria-label="Grabar nota de voz"
      className="size-11 shrink-0 rounded-[14px]"
    >
      <Mic className="size-[17px]" />
    </Button>
  );
}
