// opus-recorder no publica tipos propios (ver package.json: sin campo "types").
// Solo se declara la superficie que usamos: graba PCM del micrófono y lo
// codifica a Ogg Opus en un worker (WASM), formato que WhatsApp sí acepta
// para notas de voz salientes (a diferencia del webm/opus que produce
// MediaRecorder nativo en Chrome/Edge).
declare module "opus-recorder" {
  export interface RecorderOptions {
    encoderPath?: string;
    numberOfChannels?: number;
    encoderSampleRate?: 8000 | 12000 | 16000 | 24000 | 48000;
    encoderBitRate?: number;
    encoderApplication?: number;
    streamPages?: boolean;
    mediaTrackConstraints?: boolean | MediaTrackConstraints;
  }

  export default class Recorder {
    constructor(options?: RecorderOptions);
    ondataavailable: (typedArray: Uint8Array) => void;
    onstart?: () => void;
    onstop?: () => void;
    onpause?: () => void;
    onresume?: () => void;
    start(stream?: MediaStream): Promise<void>;
    stop(): void;
    pause(): void;
    resume(): void;
    close(): void;
  }
}
