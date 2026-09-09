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

type IfNode = { conds: Cond[]; comb: string; outs: string[][] };

/**
 * Recorre el grafo REAL a partir de un nodo: mientras caiga en un nodo If,
 * evalúa su condición y sigue la salida que corresponda. Así la prueba
 * depende del cableado publicado y no de un orden que asumamos aquí.
 */
function walkIfChain(start: string, $json: Ctx): string {
  const ifs = spec.if_nodes as unknown as Record<string, IfNode>;
  let current = start;
  for (let i = 0; i < 20; i++) {
    const node = ifs[current];
    if (!node) return current;
    const branch = evalIf(node, $json) ? node.outs[0] : node.outs[1];
    if (!branch || branch.length === 0) return `${current} (rama sin conectar)`;
    current = branch[0];
  }
  throw new Error(`Ciclo al recorrer desde ${start}`);
}

/** Salida del Switch de acción -> nodo destino real, siguiendo el cableado */
function accionDestination(parsed: Ctx, channel: "wa" | "mg" = "wa"): string {
  const sw = channel === "wa" ? spec.sw_accion_wa : spec.sw_accion_mg;
  const conns = channel === "wa" ? spec.conn_accion_wa : spec.conn_accion_mg;
  const idx = sw.rules.findIndex((r) => r.right === parsed.accion);
  // fallbackOutput "1" => rama de humano
  const out = idx === -1 ? Number(sw.fallback) : idx;
  return walkIfChain(conns[out][0], parsed);
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

  it("Un postback ajeno cae en el menú, no en tipo de préstamo", () => {
    // El botón "Get Started" de la página quedó configurado por HubSpot, que
    // el proyecto ya descartó. Antes caía en el flujo de tipo de préstamo
    // porque la regla era "cualquier postback que no sea INFO_ ni CANCEL_".
    expect(routeClick(extract("mg", mgPostback("HUBSPOT_FBM_GET_STARTED")))).toBe("menu_info");
    // Y cualquier integración futura con su propio payload hace lo mismo
    expect(routeClick(extract("mg", mgPostback("ALGUNA_OTRA_APP_XYZ")))).toBe("menu_info");
  });

  it("Un postback ajeno termina reenviando el menú de bienvenida", () => {
    const d = extract("mg", mgPostback("HUBSPOT_FBM_GET_STARTED"));
    expect(menuDestination(d, "mg")).toBe("HTTP Request - Enviar Menú Info Messenger");
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
    for (const texto of ["👍", "🫶🏻", "Animo", "Animoooo", "jajaja", "jsjs", "Éxito", "vamos", "lol", "mmm"]) {
      expect(isFillerMessage(texto), texto).toBe(true);
      const d = extract("wa", waText(texto));
      expect(routeAfterInbound(inbound({ is_filler: true }), d)).toBe("sin_respuesta");
    }
  });

  it("sí se contesta lo que sí aporta", () => {
    for (const texto of ["Hola", "gracias", "sí", "dale", "cuál es la tasa"]) {
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

  it("cada acción llega hasta su nodo final", () => {
    expect(accionDestination({ accion: "ubicacion" })).toBe("Set - Respuesta Ubicación Whatsapp");
    expect(accionDestination({ accion: "formulario" })).toBe("HTTP Request - Upload Link WA");
    expect(accionDestination({ accion: "fuera_tema" })).toBe("Set - Respuesta Fuera de tema Whatsapp");
    expect(accionDestination({ accion: "fuera_tema", fuera_tema_tipo: "personal" })).toBe(
      "Set - Respuesta Fuera de tema Personal Whatsapp",
    );
  });

  it("cada motivo de handoff llega a su nodo", () => {
    expect(accionDestination({ accion: "humano", motivoHumano: "explicita" })).toBe(
      "HTTP Request - Handoff WA Explicita",
    );
    // "declina" nunca cancela solo: manda el botón de confirmación al cliente
    expect(accionDestination({ accion: "humano", motivoHumano: "declina" })).toBe(
      "HTTP Request - Enviar Botón Cancelar WA",
    );
    expect(accionDestination({ accion: "humano" })).toBe("HTTP Request - Handoff WA No Puedo");
  });

  it("cada topic del FAQ llega a su rama, en ambos canales", () => {
    const casos: [string, string, string][] = [
      // topic          WhatsApp                                   Messenger
      ["requisitos", "Set - Respuesta Requisitos Whatsapp", "Set - Respuesta Requisitos Messenger"],
      ["tasa_negocio", "WhatsApp - Enviar Tabla Micronegocio", "HTTP Request - Enviar Texto Tabla Micronegocio Messenger"],
      ["servicios", "HTTP Request - Enviar Servicios WA", "HTTP Request - Enviar Servicios Messenger"],
      ["otro", "Set - Respuesta FAQ Whatsapp", "Set - Respuesta FAQ Messenger"],
    ];
    for (const [topic, destinoWA, destinoMG] of casos) {
      expect(accionDestination({ accion: "faq", topic }, "wa"), topic).toBe(destinoWA);
      expect(accionDestination({ accion: "faq", topic }, "mg"), topic).toBe(destinoMG);
    }
  });

  it("un topic inesperado cae en la respuesta genérica, no en el vacío", () => {
    expect(accionDestination({ accion: "faq", topic: "algo_nuevo" })).toBe(
      "Set - Respuesta FAQ Whatsapp",
    );
    expect(accionDestination({ accion: "faq", topic: null })).toBe("Set - Respuesta FAQ Whatsapp");
  });

  it("los botones de servicios respetan los límites de Meta y reusan los payloads del menú", () => {
    const evalBody = (expr: string, output: string) => {
      const inner = expr.trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
      const $ = () => ({ item: { json: { senderId: "521662" } } });
      return new Function("$", "$json", `return (${inner});`)($, { output });
    };
    const wa = evalBody(spec.body_servicios_wa, "texto de servicios") as never;
    const botonesWA = (wa as { interactive: { action: { buttons: { reply: { id: string; title: string } }[] } } })
      .interactive.action.buttons;
    expect(botonesWA).toHaveLength(3); // WhatsApp no admite más de 3
    expect(botonesWA.map((b) => b.reply.id)).toEqual(["INFO_TABLA", "INFO_TASA", "INFO_SOLICITAR"]);
    for (const b of botonesWA) expect(b.reply.title.length).toBeLessThanOrEqual(20);

    const mg = evalBody(spec.body_servicios_mg, "texto de servicios") as never;
    const botonesMG = (mg as { message: { attachment: { payload: { buttons: { title: string; payload: string }[] } } } })
      .message.attachment.payload.buttons;
    expect(botonesMG).toHaveLength(3);
    expect(botonesMG.map((b) => b.payload)).toEqual(["INFO_TABLA", "INFO_TASA", "INFO_SOLICITAR"]);
    for (const b of botonesMG) expect(b.title.length).toBeLessThanOrEqual(20);
  });

  it("la respuesta de servicios cierra invitando a elegir, en ambos canales", () => {
    const evalBody = (expr: string, output: string) => {
      const inner = expr.trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
      const $ = () => ({ item: { json: { senderId: "521662", output } } });
      return new Function("$", "$json", `return (${inner});`)($, { output });
    };
    const texto = "W Capital es una empresa sonorense...";
    const wa = evalBody(spec.body_servicios_wa, texto) as {
      interactive: { body: { text: string } };
    };
    const mg = evalBody(spec.body_servicios_mg, texto) as {
      message: { attachment: { payload: { text: string } } };
    };
    for (const cuerpo of [wa.interactive.body.text, mg.message.attachment.payload.text]) {
      expect(cuerpo).toContain(texto);
      expect(cuerpo.endsWith("¿Sobre qué le gustaría saber?")).toBe(true);
    }
    // Límites de Meta para el cuerpo del mensaje con botones
    expect(wa.interactive.body.text.length).toBeLessThanOrEqual(1024);
    expect(mg.message.attachment.payload.text.length).toBeLessThanOrEqual(640);
  });

  it("los payloads de esos botones son los mismos que ya rutea el menú", () => {
    // Al hacer clic reusan el flujo existente: sin ruteo nuevo que mantener
    expect(menuDestination(extract("wa", waButton("INFO_TABLA")), "wa")).toBe(
      "WhatsApp - Enviar Tabla Micronegocio",
    );
    expect(menuDestination(extract("mg", mgPostback("INFO_SOLICITAR")), "mg")).toBe(
      "HTTP Request - Enviar Cómo Solicitar Messenger",
    );
  });

  it("una acción inesperada deriva a un humano, nunca al silencio", () => {
    expect(accionDestination({ accion: "algo_raro" })).toBe("HTTP Request - Handoff WA No Puedo");
    expect(accionDestination({ accion: null })).toBe("HTTP Request - Handoff WA No Puedo");
  });
});

describe("Respuestas del FAQ: redacción libre del modelo (decisión explícita del usuario)", () => {
  // El modelo llegó a contestar lo contrario del FAQ (dijo que NO se puede
  // ayudar con un auto en empeño, cuando el FAQ dice que sí) y a caer en
  // "no puedo responder" ante preguntas legítimas de fraseo distinto
  // ("¿en dónde los subo?", "¿cómo que en línea?"). Probamos plantillas fijas
  // por topic; el usuario decidió, ya al tanto de ese riesgo, aceptar
  // redacción libre para ganar flexibilidad de lenguaje natural — con el
  // ejemplo adversarial del empeño y la auto-verificación de polaridad
  // agregados al prompt como mitigación (no elimina el riesgo, lo reduce).
  const evalMapa = (expr: string, output: string) => {
    const inner = expr.trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
    const $ = () => ({ item: { json: { output } } });
    return new Function("$", `return (${inner});`)($) as string;
  };

  it("el texto que redacta el modelo se manda tal cual, en ambos canales", () => {
    const texto = "Cualquier texto que redacte el modelo para esta pregunta.";
    expect(evalMapa(spec.faq_map_wa, texto)).toBe(texto);
    expect(evalMapa(spec.faq_map_mg, texto)).toBe(texto);
  });

  it("no depende de accion/topic: siempre es el output del modelo", () => {
    // A diferencia del mapa anterior, ya no hay bifurcación por topic — esto
    // evita que un topic no reconocido produzca una respuesta vacía.
    const texto = "Respuesta libre";
    expect(spec.faq_map_wa).not.toContain("tasa:");
    expect(spec.faq_map_wa).toContain("output");
    expect(evalMapa(spec.faq_map_wa, texto)).toBe(texto);
  });

  it("requisitos sigue con su plantilla fija de siempre (fuera del revert)", () => {
    // Nunca ha fallado y tiene un formato con lista numerada que se perdería
    // si pasara a redacción libre — se deja explícitamente fuera del cambio.
    expect(accionDestination({ accion: "faq", topic: "requisitos" }, "wa")).toBe(
      "Set - Respuesta Requisitos Whatsapp",
    );
    expect(accionDestination({ accion: "faq", topic: "requisitos" }, "mg")).toBe(
      "Set - Respuesta Requisitos Messenger",
    );
  });
});

describe("Guardarraíles del prompt para la redacción libre del FAQ", () => {
  const promptWA = spec.prompt_message_a_model as string;
  const promptAudio = spec.prompt_message_a_model_audio as string;

  it("ambos clasificadores llevan el ejemplo adversarial del empeño", () => {
    for (const p of [promptWA, promptAudio]) {
      expect(p).toContain("NUNCA debes hacer");
      expect(p).toContain("auto o casa en empeño");
      expect(p.toLowerCase()).toContain("no usamos refrendo");
    }
  });

  it("ambos clasificadores llevan la auto-verificación de polaridad", () => {
    for (const p of [promptWA, promptAudio]) {
      expect(p).toContain("conserve el MISMO sentido afirmativo o negativo");
    }
  });

  it("la regla de cobertura sigue diciendo que derive a humano fuera del FAQ", () => {
    for (const p of [promptWA, promptAudio]) {
      expect(p).toContain("NO redactes una respuesta con conocimiento propio");
      expect(p).toContain("no_puedo_responder");
    }
  });

  it("las reglas de nunca prometer cifras/aprobación siguen intactas", () => {
    for (const p of [promptWA, promptAudio]) {
      expect(p).toContain("NUNCA prometas aprobación de crédito");
      expect(p).toContain("NUNCA digas cuánto se va a prestar");
    }
  });

  it("los dos clasificadores comparten exactamente el mismo prompt", () => {
    expect(promptWA).toBe(promptAudio);
  });
});

describe("Una pregunta fuera del FAQ deriva a humano, nunca inventa (sin auto-pausar el bot)", () => {
  it("no_puedo_responder sigue llegando al handoff que ya no pausa el bot solo", () => {
    expect(accionDestination({ accion: "humano", motivoHumano: "no_puedo_responder" }, "wa")).toBe(
      "HTTP Request - Handoff WA No Puedo",
    );
    expect(
      accionDestination({ accion: "humano", motivoHumano: "no_puedo_responder" }, "mg"),
    ).toBe("HTTP Request - Handoff Messenger No Puedo");
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
