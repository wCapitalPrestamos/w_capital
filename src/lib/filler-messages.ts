// Mensajes de "relleno": reacciones, ánimos o risas sueltas que no aportan
// información y no requieren respuesta del bot ni atención del equipo.
//
// Regla de seguridad: nunca agregar aquí una palabra que pueda ser una
// respuesta real a una pregunta del bot. El bot sí hace preguntas de texto
// libre fuera de los botones (ej. "¿Le ayudo a comenzar su solicitud?"), así
// que palabras como "sí", "no", "vale", "dale", "va", "adelante", "perfecto"
// o "claro" NUNCA deben tratarse como relleno, aunque parezcan reacciones.

const EMOJI_ONLY_RE =
  /^[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️\s]+$/u;

const LAUGH_RE = /^(ja|je|ji|jo|ha|he|hi|ho|js|xd)+$/;

// Reacciones y muletillas sin contenido. Se comparan ya normalizadas (sin
// acentos ni letras repetidas), así que "mmm" entra como "m" y "Ándaleee"
// como "andale".

const ACCENT_MAP: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ñ: "n",
  ü: "u",
};

function toLettersOnly(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => ACCENT_MAP[ch] ?? ch)
    .filter((ch) => ch >= "a" && ch <= "z")
    .join("");
}

// "Animoooo" / "jajajaja" tienen letras repetidas por énfasis — se colapsan
// para comparar contra la lista de palabras de relleno. Esto también
// colapsa dobles letras legítimas del español (ej. "arriba" -> "ariba"),
// así que el diccionario se colapsa igual al construirlo, no a mano.
function collapseRepeats(text: string): string {
  return text
    .split("")
    .filter((ch, i, arr) => ch !== arr[i - 1])
    .join("");
}

const FILLER_WORDS = new Set(
  [
    // ánimo / celebración
    "animo",
    "suerte",
    "exito",
    "arriba",
    "bravo",
    "felicidades",
    "vamos",
    "andale",
    "eso",
    "ole",
    "aplausos",
    // reacciones
    "wow",
    "lol",
    "lmao",
    "orale",
    // muletillas sin contenido
    "mmm",
    "hmm",
    "aja",
  ].map(collapseRepeats),
);

export function isFillerMessage(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (EMOJI_ONLY_RE.test(trimmed)) return true;

  const lettersOnly = toLettersOnly(trimmed);
  if (lettersOnly.length === 0) return false;

  if (FILLER_WORDS.has(collapseRepeats(lettersOnly))) return true;
  if (LAUGH_RE.test(lettersOnly)) return true;

  return false;
}
