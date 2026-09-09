import { describe, expect, it } from "vitest";
import { isFillerMessage } from "@/lib/filler-messages";

describe("isFillerMessage", () => {
  it("detecta emojis sueltos", () => {
    expect(isFillerMessage("👍")).toBe(true);
    expect(isFillerMessage("🙏")).toBe(true);
    expect(isFillerMessage("😊")).toBe(true);
    expect(isFillerMessage("👍🙏")).toBe(true);
    expect(isFillerMessage("  👍  ")).toBe(true);
  });

  it("detecta emojis compuestos (tono de piel, ZWJ, variation selector)", () => {
    expect(isFillerMessage("👍🏽")).toBe(true); // thumbs up + skin tone
    expect(isFillerMessage("🫶🏻")).toBe(true); // heart hands + skin tone
    expect(isFillerMessage("❤️")).toBe(true); // heart + variation selector
    expect(isFillerMessage("👨‍👩‍👧")).toBe(true); // familia con ZWJ
  });

  it("detecta ánimo y variantes con acentos/repetición", () => {
    expect(isFillerMessage("Animo")).toBe(true);
    expect(isFillerMessage("Animoooo")).toBe(true);
    expect(isFillerMessage("ánimo")).toBe(true);
    expect(isFillerMessage("ÁNIMO!!")).toBe(true);
    expect(isFillerMessage("Suerte!")).toBe(true);
    expect(isFillerMessage("Éxito")).toBe(true);
    expect(isFillerMessage("arriba")).toBe(true);
    expect(isFillerMessage("bravo")).toBe(true);
    expect(isFillerMessage("felicidades")).toBe(true);
    expect(isFillerMessage("wow")).toBe(true);
    expect(isFillerMessage("ole")).toBe(true);
    expect(isFillerMessage("aplausos")).toBe(true);
  });

  it("detecta ánimos, reacciones y muletillas sin contenido", () => {
    expect(isFillerMessage("vamos")).toBe(true);
    expect(isFillerMessage("Vamosss!")).toBe(true);
    expect(isFillerMessage("ándale")).toBe(true);
    expect(isFillerMessage("órale")).toBe(true);
    expect(isFillerMessage("eso")).toBe(true);
    expect(isFillerMessage("lol")).toBe(true);
    expect(isFillerMessage("LOL")).toBe(true);
    expect(isFillerMessage("lmao")).toBe(true);
    expect(isFillerMessage("mmm")).toBe(true);
    expect(isFillerMessage("hmmm")).toBe(true);
    expect(isFillerMessage("ajá")).toBe(true);
  });

  it("detecta risas sueltas y variaciones", () => {
    expect(isFillerMessage("jaja")).toBe(true);
    expect(isFillerMessage("jajaja")).toBe(true);
    expect(isFillerMessage("jeje")).toBe(true);
    expect(isFillerMessage("jijiji")).toBe(true);
    expect(isFillerMessage("jsjsjs")).toBe(true);
    expect(isFillerMessage("jojojo")).toBe(true);
    expect(isFillerMessage("hahaha")).toBe(true);
    expect(isFillerMessage("xdxd")).toBe(true);
  });

  it("detecta texto + emoji combinados (caso original: Animoooo 👍)", () => {
    expect(isFillerMessage("Animoooo 👍")).toBe(true);
    expect(isFillerMessage("jaja 😂")).toBe(true);
  });

  it("NO trata como relleno palabras que podrían ser una respuesta real", () => {
    // El bot hace preguntas de texto libre fuera de botones (ver
    // e4fb9da) — estas palabras podrían estar contestándolas.
    expect(isFillerMessage("sí")).toBe(false);
    expect(isFillerMessage("si")).toBe(false);
    expect(isFillerMessage("no")).toBe(false);
    // "dale" y "adelante" se quedan fuera del relleno a propósito: son las
    // que más suenan a "sí, continúe" si alguien las escribe en vez de tocar
    // un botón, y ahí callarse costaría el trámite.
    expect(isFillerMessage("vale")).toBe(false);
    expect(isFillerMessage("dale")).toBe(false);
    expect(isFillerMessage("adelante")).toBe(false);
    expect(isFillerMessage("perfecto")).toBe(false);
    expect(isFillerMessage("claro")).toBe(false);
    expect(isFillerMessage("ok")).toBe(false);
    expect(isFillerMessage("gracias")).toBe(false);
  });

  it("NO trata como relleno mensajes con contenido real", () => {
    expect(isFillerMessage("Necesito 200 mil pesos")).toBe(false);
    expect(isFillerMessage("Hola")).toBe(false);
    expect(isFillerMessage("¿Cuál es la tasa?")).toBe(false);
    expect(isFillerMessage("no pude, piden tener carro")).toBe(false);
    expect(isFillerMessage("quiero cancelar")).toBe(false);
  });

  it("maneja mensajes vacíos o solo espacios", () => {
    expect(isFillerMessage("")).toBe(false);
    expect(isFillerMessage("   ")).toBe(false);
  });
});
