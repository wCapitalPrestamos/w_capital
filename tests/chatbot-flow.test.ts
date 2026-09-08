import { describe, expect, it } from "vitest";
import { isFillerMessage } from "@/lib/filler-messages";
import spec from "./fixtures/n8n-flow-spec.json";

// Simula el árbol de decisión del workflow de n8n ("Workflow WCapital",
// FImVrHGa4c5nmPL3) usando las expresiones EXACTAS que están publicadas.
// El fixture n8n-flow-spec.json se exporta del workflow real; si alguien
// cambia el flujo en n8n hay que re-exportarlo, y estas pruebas detectan
// la diferencia. Cubre los tres bugs que ya nos mordieron en producción:
// clics interceptados por el nodo equivocado, mensajes de relleno que
// disparaban respuesta, y el menú que dejó de mandarse tras un saludo.

type Ctx = Record<string, unknown>;

function evalExpr(expr: unknown, $json: Ctx, refs: Record<string, Ctx> = {}): unknown {
  if (typeof expr !== "string" || !expr.trim().startsWith("={{")) return expr;
  const body = expr.trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
  const $ = (name: string) => {
    if (!(name in refs)) throw new Error(`Nodo no disponible en esta ruta: ${name}`);
    return { item: { json: refs[name] } };
  };
  return new Function("$json", "$", `return (${body});`)($json, $);
}

type Cond = { left: unknown; right: unknown; op: string; type: string };

function evalCond(c: Cond, $json: Ctx, refs: Record<string, Ctx> = {}): boolean {
  const left = evalExpr(c.left, $json, refs);
  if (c.type === "boolean") {
    if (c.op === "true") return left === true;
    if (c.op === "false") return left === false;
  }
  if (c.type === "string" && c.op === "equals") return left === c.right;
  throw new Error(`Operador no soportado: ${c.type}/${c.op}`);
}

function evalIf(
  node: { conds: Cond[]; comb: string },
  $json: Ctx,
  refs: Record<string, Ctx> = {},
): boolean {
  const results = node.conds.map((c) => evalCond(c, $json, refs));
  return node.comb === "or" ? results.some(Boolean) : results.every(Boolean);
}

function extract(channel: "wa" | "mg", payload: Ctx): Ctx {
  const fields = channel === "wa" ? spec.wa_fields : spec.mg_fields;
  const out: Ctx = {};
  for (const [k, v] of Object.entries(fields)) out[k] = evalExpr(v, payload);
  return out;
}

/** Cadena de routing de clics: Tipo Préstamo -> Cancelar -> Menú Info -> Inbound */
function routeClick(d: Ctx): string {
  if (evalIf(spec.if_tipo as never, d)) return "tipo_prestamo";
  if (evalIf(spec.if_cancel as never, d)) return "cancelar";
  if (evalIf(spec.if_menu as never, d)) return "menu_info";
  return "inbound";
}

/** Salida del Switch de menú -> nombre del nodo destino real */
function menuDestination(d: Ctx, channel: "wa" | "mg"): string {
  const selection = evalExpr(spec.mapper, d) as string;
  const sw = channel === "wa" ? spec.sw_menu_wa : spec.sw_menu_mg;
  const conns = channel === "wa" ? spec.conn_menu_wa : spec.conn_menu_mg;
  const idx = sw.rules.findIndex((r) => r.right === selection);
  // fallbackOutput "extra" => última salida (reenvía el menú)
  const out = idx === -1 ? conns.length - 1 : idx;
  return conns[out][0];
}

/** Tras HTTP Request - Inbound: Es Texto -> No Requiere Respuesta -> Bot Activo */
function routeAfterInbound(inbound: Ctx, extracted: Ctx): string {
  const refs = { "NoOp - Antes de IA": extracted };
  if (!evalIf(spec.if_texto as never, inbound, refs)) return "media";
  if (evalIf(spec.if_norequiere as never, inbound, refs)) return "sin_respuesta";
  if (!evalIf(spec.if_botactivo as never, inbound, refs)) return "bot_pausado";
  return "clasificador";
}

/** Salida del Switch de acción (WhatsApp) -> nodo destino real */
function accionDestination(parsed: Ctx): string {
  const idx = spec.sw_accion_wa.rules.findIndex((r) => r.right === parsed.accion);
  // fallbackOutput "1" => rama de humano
  const out = idx === -1 ? Number(spec.sw_accion_wa.fallback) : idx;
  const target = spec.conn_accion_wa[out][0];
  if (target !== "If - ¿Saludo De Inicio? (WA)") return target;
  return evalIf(spec.if_saludo_wa as never, parsed)
    ? spec.conn_saludo_wa[0][0]
    : spec.conn_saludo_wa[1][0];
}

const waText = (text: string): Ctx => ({
  messages: [{ from: "5216624335276", id: "w1", type: "text", text: { body: text } }],
  contacts: [{ profile: { name: "Uma" } }],
});
const waList = (id: string): Ctx => ({
  messages: [
    { from: "5216624335276", id: "w2", type: "interactive", interactive: { type: "list_reply", list_reply: { id } } },
  ],
  contacts: [{ profile: { name: "Uma" } }],
});
const waButton = (id: string): Ctx => ({
  messages: [
    { from: "5216624335276", id: "w3", type: "interactive", interactive: { type: "button_reply", button_reply: { id } } },
  ],
  contacts: [{ profile: { name: "Uma" } }],
});
const mgQuick = (payload: string): Ctx => ({
  messaging: [{ sender: { id: "999" }, message: { mid: "m1", text: "x", quick_reply: { payload } } }],
});
const mgPostback = (payload: string): Ctx => ({
  messaging: [{ sender: { id: "999" }, postback: { mid: "m2", payload } }],
});
const mgText = (text: string): Ctx => ({
  messaging: [{ sender: { id: "999" }, message: { mid: "m3", text } }],
});

const inbound = (over: Partial<Ctx> = {}): Ctx => ({
  ok: true,
  conversation_id: "c1",
  duplicate: false,
  bot_active: true,
  is_ongoing_conversation: true,
  is_filler: false,
  ...over,
});

describe("Ruteo de clics de botones/listas", () => {
  it("WhatsApp: las 5 opciones del menú caen en el flujo de menú", () => {
    for (const id of ["INFO_REQUISITOS", "INFO_TASA", "INFO_SOLICITAR", "INFO_UBICACION", "INFO_TABLA"]) {
      expect(routeClick(extract("wa", waList(id)))).toBe("menu_info");
    }
  });

  it("WhatsApp: botones viejos (button_reply) siguen funcionando", () => {
    expect(routeClick(extract("wa", waButton("INFO_TASA")))).toBe("menu_info");
  });

  it("WhatsApp: TIPO_ y CANCEL_ no se confunden con el menú", () => {
    expect(routeClick(extract("wa", waButton("TIPO_PERSONAL")))).toBe("tipo_prestamo");
    // Regresión: CANCEL_ lo interceptaba "Es Clic Tipo Préstamo"
    expect(routeClick(extract("wa", waButton("CANCEL_SI")))).toBe("cancelar");
    expect(routeClick(extract("wa", waButton("CANCEL_NO")))).toBe("cancelar");
  });

  it("Messenger: quick replies y postbacks caen en el flujo de menú", () => {
    expect(routeClick(extract("mg", mgQuick("INFO_UBICACION")))).toBe("menu_info");
    expect(routeClick(extract("mg", mgQuick("INFO_TABLA")))).toBe("menu_info");
    expect(routeClick(extract("mg", mgPostback("INFO_TASA")))).toBe("menu_info");
  });

  it("Messenger: TIPO_ y CANCEL_ no se confunden con el menú", () => {
    expect(routeClick(extract("mg", mgPostback("TIPO_NEGOCIO")))).toBe("tipo_prestamo");
    expect(routeClick(extract("mg", mgPostback("CANCEL_SI")))).toBe("cancelar");
  });

  it("El texto libre nunca se trata como clic", () => {
    expect(routeClick(extract("wa", waText("cuál es la tasa")))).toBe("inbound");
    expect(routeClick(extract("mg", mgText("quiero un préstamo")))).toBe("inbound");
  });
});

describe("Destino de cada opción del menú", () => {
  const esperadoWA: Record<string, string> = {
    INFO_REQUISITOS: "Set - Respuesta Requisitos Whatsapp",
    INFO_TASA: "Set - Respuesta Tasa (Menú WA)",
    INFO_SOLICITAR: "HTTP Request - Enviar Cómo Solicitar WA",
    INFO_UBICACION: "Set - Respuesta Ubicación Whatsapp",
    INFO_TABLA: "WhatsApp - Enviar Tabla Micronegocio",
  };
  const esperadoMG: Record<string, string> = {
    INFO_REQUISITOS: "Set - Respuesta Requisitos Messenger",
    INFO_TASA: "Set - Respuesta Tasa (Menú Messenger)",
    INFO_SOLICITAR: "HTTP Request - Enviar Cómo Solicitar Messenger",
    INFO_UBICACION: "Set - Ubicación",
    INFO_TABLA: "HTTP Request - Enviar Texto Tabla Micronegocio Messenger",
  };

  it("WhatsApp: cada opción llega a su nodo", () => {
    for (const [id, destino] of Object.entries(esperadoWA)) {
      expect(menuDestination(extract("wa", waList(id)), "wa"), id).toBe(destino);
    }
  });

  it("Messenger: cada opción llega a su nodo", () => {
    for (const [id, destino] of Object.entries(esperadoMG)) {
      expect(menuDestination(extract("mg", mgQuick(id)), "mg"), id).toBe(destino);
    }
  });

  it("Una opción desconocida reenvía el menú en vez de quedarse callado", () => {
    expect(menuDestination(extract("wa", waList("INFO_LOQUESEA")), "wa")).toBe(
      "HTTP Request - Enviar Menú Info WA",
    );
    expect(menuDestination(extract("mg", mgQuick("INFO_LOQUESEA")), "mg")).toBe(
      "HTTP Request - Enviar Menú Info Messenger",
    );
  });
});

describe("Filtro de mensajes de relleno (antes del clasificador)", () => {
  it("no se contesta emoji suelto, ánimo ni risas", () => {
    for (const texto of ["👍", "🫶🏻", "Animo", "Animoooo", "jajaja", "jsjs", "Éxito"]) {
      expect(isFillerMessage(texto), texto).toBe(true);
      const d = extract("wa", waText(texto));
      expect(routeAfterInbound(inbound({ is_filler: true }), d)).toBe("sin_respuesta");
    }
  });

  it("sí se contesta lo que sí aporta", () => {
    for (const texto of ["Hola", "gracias", "sí", "vamos", "cuál es la tasa"]) {
      expect(isFillerMessage(texto), texto).toBe(false);
      const d = extract("wa", waText(texto));
      expect(routeAfterInbound(inbound({ is_filler: false }), d)).toBe("clasificador");
    }
  });

  it("con el bot pausado no contesta", () => {
    const d = extract("wa", waText("Hola"));
    expect(routeAfterInbound(inbound({ bot_active: false }), d)).toBe("bot_pausado");
  });

  it("los adjuntos no pasan por el filtro de texto", () => {
    const d = extract("wa", {
      messages: [{ from: "5216624335276", id: "w9", type: "image", image: { id: "i1", mime_type: "image/jpeg" } }],
      contacts: [{ profile: { name: "Uma" } }],
    });
    expect(routeAfterInbound(inbound(), d)).toBe("media");
  });
});

describe("Destino según la clasificación de la IA", () => {
  it("un saludo de inicio SIEMPRE manda el menú", () => {
    // Regresión: un guardia de "conversación en curso" dejaba el saludo sin menú
    expect(accionDestination({ accion: "saludo", saludo_tipo: "inicio" })).toBe(
      "HTTP Request - Enviar Menú Info WA",
    );
  });

  it("un saludo de cierre responde breve, sin menú", () => {
    expect(accionDestination({ accion: "saludo", saludo_tipo: "cierre" })).toBe(
      "Set - Respuesta FAQ Whatsapp",
    );
  });

  it("cada acción llega a su rama", () => {
    expect(accionDestination({ accion: "faq" })).toBe("IF - Es Requisitos WA");
    expect(accionDestination({ accion: "humano" })).toBe("If - Motivo Humano WA");
    expect(accionDestination({ accion: "fuera_tema" })).toBe("If - ¿Es Personal? (WA)");
    expect(accionDestination({ accion: "ubicacion" })).toBe("Set - Respuesta Ubicación Whatsapp");
    expect(accionDestination({ accion: "formulario" })).toBe("HTTP Request - Upload Link WA");
  });

  it("una acción inesperada deriva a humano, nunca al silencio", () => {
    expect(accionDestination({ accion: "algo_raro" })).toBe("If - Motivo Humano WA");
    expect(accionDestination({ accion: null })).toBe("If - Motivo Humano WA");
  });
});

describe("Extracción de datos del webhook", () => {
  it("WhatsApp normaliza el 521 de México", () => {
    expect(extract("wa", waText("hola")).senderId).toBe("526624335276");
  });

  it("WhatsApp lee tanto button_reply como list_reply", () => {
    expect(extract("wa", waButton("INFO_TASA")).interactiveButtonId).toBe("INFO_TASA");
    expect(extract("wa", waList("INFO_TABLA")).interactiveButtonId).toBe("INFO_TABLA");
  });

  it("Messenger trata la quick reply como postback", () => {
    const d = extract("mg", mgQuick("INFO_UBICACION"));
    expect(d.messageType).toBe("postback");
    expect(d.postbackPayload).toBe("INFO_UBICACION");
  });

  it("Messenger sigue leyendo postbacks y adjuntos", () => {
    expect(extract("mg", mgPostback("TIPO_NEGOCIO")).postbackPayload).toBe("TIPO_NEGOCIO");
    const img = extract("mg", {
      messaging: [{ sender: { id: "9" }, message: { mid: "m", attachments: [{ type: "image", payload: { url: "u" } }] } }],
    });
    expect(img.messageType).toBe("image");
  });
});
