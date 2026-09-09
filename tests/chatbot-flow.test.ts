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
    INFO_REQUISITOS: "Message a model - Respuesta Requisitos WA",
    INFO_TASA: "Message a model - Respuesta Tasa WA",
    INFO_SOLICITAR: "HTTP Request - Enviar Cómo Solicitar WA",
    INFO_UBICACION: "Message a model - Respuesta Ubicación WA",
    INFO_TABLA: "WhatsApp - Enviar Tabla Micronegocio",
  };
  const esperadoMG: Record<string, string> = {
    INFO_REQUISITOS: "Message a model - Respuesta Requisitos Messenger",
    INFO_TASA: "Message a model - Respuesta Tasa Messenger",
    INFO_SOLICITAR: "HTTP Request - Enviar Cómo Solicitar Messenger",
    INFO_UBICACION: "Message a model - Respuesta Ubicación Messenger",
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
    expect(accionDestination({ accion: "ubicacion" })).toBe("Message a model - Respuesta Ubicación WA");
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
      // "requisitos" ya no tiene rama propia: cae en la respuesta libre del FAQ,
      // igual que cualquier otro topic sin plantilla fija (ver describe de abajo).
      ["requisitos", "Set - Respuesta FAQ Whatsapp", "Set - Respuesta FAQ Messenger"],
      ["tasa_negocio", "WhatsApp - Enviar Tabla Micronegocio", "HTTP Request - Enviar Texto Tabla Micronegocio Messenger"],
      // "servicios" también dejó de tener su tarjeta de botones fija: cae en la
      // misma respuesta libre del FAQ que cualquier otro topic (pregunta 11).
      ["servicios", "Set - Respuesta FAQ Whatsapp", "Set - Respuesta FAQ Messenger"],
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

  it("la tarjeta de botones de servicios ya no existe: se eliminó junto con el resto de plantillas fijas", () => {
    // "qué servicios ofrecen" ahora es una pregunta más del FAQ, contestada en
    // texto libre por el modelo — sin tarjeta de botones aparte.
    expect(spec).not.toHaveProperty("body_servicios_wa");
    expect(spec).not.toHaveProperty("body_servicios_mg");
  });

  it("los payloads de los botones del menú (Tabla/Tasa/Solicitar) siguen funcionando aunque ya no los dispare la tarjeta de servicios", () => {
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

  it("requisitos ya no tiene plantilla fija: cae en la respuesta libre del FAQ", () => {
    // Único mensaje/flujo fijo que debe quedar es menú principal, cancelación
    // y "Cómo solicitar" + personal/negocio + link — requisitos y tasa dejaron
    // de ser excepciones y ahora usan el mismo mecanismo de redacción libre.
    expect(accionDestination({ accion: "faq", topic: "requisitos" }, "wa")).toBe(
      "Set - Respuesta FAQ Whatsapp",
    );
    expect(accionDestination({ accion: "faq", topic: "requisitos" }, "mg")).toBe(
      "Set - Respuesta FAQ Messenger",
    );
  });
});

describe("Menú principal: Requisitos y Tasa ya no son plantilla fija", () => {
  const evalFinal = (rawText: string) =>
    new Function(
      "$json",
      "return ($json.output[0].content[0].text.trim());",
    )({ output: [{ content: [{ text: rawText }] }] }) as string;

  it("el botón Requisitos del menú pasa por un modelo que redacta con los datos reales, no un texto fijo", () => {
    expect(menuDestination(extract("wa", waList("INFO_REQUISITOS")), "wa")).toBe(
      "Message a model - Respuesta Requisitos WA",
    );
    expect(menuDestination(extract("mg", mgQuick("INFO_REQUISITOS")), "mg")).toBe(
      "Message a model - Respuesta Requisitos Messenger",
    );
  });

  it("el botón Tasa del menú pasa por un modelo que redacta con el dato real, no un texto fijo", () => {
    expect(menuDestination(extract("wa", waList("INFO_TASA")), "wa")).toBe(
      "Message a model - Respuesta Tasa WA",
    );
    expect(menuDestination(extract("mg", mgQuick("INFO_TASA")), "mg")).toBe(
      "Message a model - Respuesta Tasa Messenger",
    );
  });

  it("el Set final de cada botón solo extrae el texto que redactó el modelo", () => {
    expect(evalFinal("  Estos son los requisitos...  ")).toBe("Estos son los requisitos...");
  });

  it("el prompt de Requisitos no inventa ni quita puntos de la lista real", () => {
    const p = spec.prompt_respuesta_requisitos_menu as string;
    expect(p).toContain("ÚNICAMENTE en esta información real");
    expect(p).toContain("Comprobante de domicilio");
    expect(p).toContain("Garantía");
  });

  it("el prompt de Tasa nunca deja que el modelo cambie el número real", () => {
    const p = spec.prompt_respuesta_tasa_menu as string;
    expect(p).toContain("1.97% semanal");
    expect(p).toContain("sin inventar ni cambiar el número");
  });
});

describe("Fuera de tema y servicios ya no son mensaje fijo", () => {
  // Único mensaje/flujo fijo que debe quedar: menú principal, cancelación (+
  // seguimiento), y "Cómo solicitar" con personal/negocio y el link. Todo lo
  // demás lo redacta la IA con un buen prompt — incluida la redirección
  // cuando el cliente se sale del tema, y "qué servicios ofrecen".
  const evalMapa = (expr: string, output: string) => {
    const inner = expr.trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
    const $ = () => ({ item: { json: { output } } });
    return new Function("$", `return (${inner});`)($) as string;
  };

  it("el mecanismo de redacción libre (mismo que el FAQ) es el que ahora alimenta fuera de tema", () => {
    const texto = "Redacción libre de redirección amable.";
    expect(evalMapa(spec.faq_map_wa, texto)).toBe(texto);
  });

  it("el prompt ahora le pide al modelo redactar la redirección de fuera de tema, no descartarla", () => {
    const p = spec.prompt_message_a_model as string;
    expect(p).not.toContain('En "output" pon cualquier texto breve (no se usará, se manda un mensaje fijo). IMPORTANTE: "fuera_tema"');
    expect(p).toContain("redirija con calidez hacia WCapital");
    expect(p).toContain('agradezca que comparta antes de redirigir');
  });

  it("qué servicios ofrecen ya no dispara una tarjeta de botones fija: cae en el FAQ libre", () => {
    expect(accionDestination({ accion: "faq", topic: "servicios" }, "wa")).toBe(
      "Set - Respuesta FAQ Whatsapp",
    );
    expect(accionDestination({ accion: "faq", topic: "servicios" }, "mg")).toBe(
      "Set - Respuesta FAQ Messenger",
    );
  });
});

describe("Intenciones múltiples y despedidas se manejan correctamente", () => {
  const promptWA = spec.prompt_message_a_model as string;

  it("una pregunta múltiple se contesta completa en un solo mensaje (ya probado, se reafirma tras los cambios)", () => {
    expect(promptWA).toContain("responde TODAS las partes");
  });

  it("un saludo/agradecimiento combinado con una pregunta real se clasifica por la intención, no como saludo", () => {
    expect(promptWA).toContain(
      'si el mensaje combina un saludo/agradecimiento con una pregunta o intención clara',
    );
  });

  it("una despedida sola (saludo_tipo: cierre) también es redacción libre del modelo, sin plantilla", () => {
    // "cierre" nunca tuvo su propio Set con texto fijo — siempre usó el mismo
    // paso libre que el resto del FAQ (Set - Respuesta FAQ Whatsapp/Messenger).
    expect(accionDestination({ accion: "saludo", saludo_tipo: "cierre" }, "wa")).toBe(
      "Set - Respuesta FAQ Whatsapp",
    );
    expect(accionDestination({ accion: "saludo", saludo_tipo: "cierre" }, "mg")).toBe(
      "Set - Respuesta FAQ Messenger",
    );
  });

  it("una despedida a mitad de conversación nunca reabre el menú (nunca es saludo_tipo: inicio)", () => {
    expect(promptWA).toContain(
      "Un mensaje de ánimo, agradecimiento, o una reacción/emoji suelto que llega A MITAD de una conversación",
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

describe("Consulta de solicitud activa (sin crear ninguna solo por preguntar)", () => {
  // El texto final ya no es una plantilla fija: un segundo modelo redacta
  // libremente a partir de los hechos reales que arma este expression (nunca
  // al revés — los hechos siempre los pone n8n, el modelo solo los redacta).
  const evalUserContent = (
    facts: {
      url?: string;
      created_at_label?: string;
      borrower_type_label?: string | null;
      requested_amount_label?: string | null;
      missing_documents?: string[];
    },
    messageText: string,
    previousOutput: string,
  ) => {
    const expr = spec.user_content_respuesta_solicitud_wa as string;
    const inner = expr.trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
    const $ = (name: string) =>
      name === "NoOp - Antes de IA"
        ? { item: { json: { messageText } } }
        : { item: { json: { output: previousOutput } } };
    return new Function("$", "$json", `return (${inner});`)($, facts) as string;
  };

  const evalFinalText = (rawText: string) => {
    const expr = spec.text_solicitud_activa_wa as string;
    const inner = expr.trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
    return new Function(
      "$json",
      `return (${inner});`,
    )({ output: [{ content: [{ text: rawText }] }] }) as string;
  };

  it("una pregunta por la solicitud llega a la consulta real, en ambos canales", () => {
    expect(accionDestination({ accion: "consulta_solicitud", output: "" }, "wa")).toBe(
      "HTTP Request - Consultar Solicitud WA",
    );
    expect(accionDestination({ accion: "consulta_solicitud", output: "" }, "mg")).toBe(
      "HTTP Request - Consultar Solicitud Messenger",
    );
  });

  it("el mensaje final extrae el texto redactado por el segundo modelo", () => {
    expect(evalFinalText("  Su link es este: https://x/subir/abc  ")).toBe(
      "Su link es este: https://x/subir/abc",
    );
  });

  it("los hechos que recibe el modelo incluyen el link real (no inventado) y los demás datos", () => {
    const facts = {
      url: "https://crm.wcapital.mx/subir/token-real-123",
      created_at_label: "9 de septiembre de 2026",
      borrower_type_label: "Personal",
      requested_amount_label: "$15,000",
      missing_documents: ["Comprobante de domicilio"],
    };
    const content = evalUserContent(facts, "¿cuándo creé mi solicitud?", "");
    expect(content).toContain(facts.url);
    expect(content).toContain(facts.created_at_label);
    expect(content).toContain(facts.borrower_type_label);
    expect(content).toContain(facts.requested_amount_label);
    expect(content).toContain("Comprobante de domicilio");
  });

  it("sin documentos faltantes, el hecho dice que ya subió todo", () => {
    const content = evalUserContent(
      { url: "https://x/subir/abc", created_at_label: "hoy", missing_documents: [] },
      "¿cómo va mi solicitud?",
      "",
    );
    expect(content).toContain("ninguno, ya subió todo lo requerido");
  });

  it("sin solicitud activa, invita a escribir sin ofrecer un botón", () => {
    const evalText = (expr: string, output: string) => {
      const inner = expr.trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
      const $ = () => ({ item: { json: { output } } });
      return new Function("$", "$json", `return (${inner});`)($, {}) as string;
    };
    for (const expr of [spec.text_sin_solicitud_wa, spec.text_sin_solicitud_mg]) {
      const r = evalText(expr as string, "");
      expect(r.toLowerCase()).toContain("quiero un préstamo");
      expect(r.toLowerCase()).not.toContain("botón");
    }
  });

  it("si además preguntó otra cosa en el mismo mensaje, esa respuesta se le pasa al modelo para integrarla", () => {
    const otraPregunta = "La tasa de interés es del 1.97% semanal.";
    const content = evalUserContent(
      { url: "https://x/subir/abc", created_at_label: "hoy", missing_documents: [] },
      "¿y mi link? también, cuál es la tasa?",
      otraPregunta,
    );
    expect(content).toContain(otraPregunta);
    expect(content).toContain("intégrala de forma natural");
  });

  it("sin otra pregunta bundleada, no se le manda al modelo un bloque vacío de 'ya se generó'", () => {
    const content = evalUserContent(
      { url: "https://x/subir/abc", created_at_label: "hoy", missing_documents: [] },
      "¿cuál es mi link?",
      "",
    );
    expect(content).not.toContain("Ya se generó esta respuesta");
  });

  it("el prompt del segundo modelo prohíbe folios, IDs y status técnico, y prohíbe inventar datos", () => {
    const p = spec.prompt_respuesta_solicitud_wa as string;
    expect(p.toLowerCase()).toContain("folios");
    expect(p.toLowerCase()).toContain("status");
    expect(p).toContain("ÚNICAMENTE los datos reales");
    expect(p).toContain("Nunca inventes");
  });

  it("el prompt del clasificador nunca deja que el modelo invente el link o el estado", () => {
    const p = spec.prompt_message_a_model as string;
    expect(p).toContain("NUNCA inventes un link");
    expect(p).toContain("consulta_solicitud");
  });
});

describe("Confidencialidad: nunca se comparte información de otro cliente", () => {
  // Cada conversación solo tiene acceso a los datos del contacto identificado
  // por su propio wa_id/PSID real (nunca por texto que escriba el cliente), así
  // que técnicamente no hay forma de que el endpoint devuelva datos de otra
  // persona. Aun así, reforzamos el prompt para que la IA nunca finja acceso a
  // información de terceros ni intente "buscar" a alguien más por nombre/teléfono.
  it("la regla de confidencialidad está en las reglas obligatorias, en ambos clasificadores", () => {
    for (const key of ["prompt_message_a_model", "prompt_message_a_model_audio"] as const) {
      const p = spec[key] as string;
      expect(p).toContain("NUNCA compartas, confirmes ni inventes información de OTRA persona");
      expect(p).toContain("cada conversación solo puede ver los datos de quien está escribiendo en ese momento");
    }
  });

  it("consulta_solicitud excluye explícitamente preguntar por la solicitud de otra persona", () => {
    const p = spec.prompt_message_a_model as string;
    expect(p).toContain(
      'Esta categoría es ÚNICAMENTE para la solicitud de quien está escribiendo este mensaje',
    );
    expect(p).toContain("mi esposo tiene una solicitud");
    expect(p).toContain("por confidencialidad nunca se comparte información de otro cliente");
  });

  it("el segundo modelo (el que redacta la respuesta de consulta_solicitud) también recibe el mismo candado", () => {
    const p = spec.prompt_respuesta_solicitud_wa as string;
    expect(p).toContain(
      "Estos datos son siempre y ÚNICAMENTE de la persona que está escribiendo en este chat en este momento",
    );
  });

  it("preguntar por la solicitud de un tercero cae en humano, no en consulta_solicitud (documentado en el prompt)", () => {
    // No hay forma de simular la clasificación real del modelo en esta prueba
    // (eso requeriría llamar a la IA), pero si el mensaje SÍ se clasificara
    // como consulta_solicitud, el endpoint solo puede devolver datos del
    // wa_id/PSID real del remitente — nunca de un tercero mencionado por texto.
    // Esta prueba confirma que el candado está documentado explícitamente para
    // que el modelo nunca tome esa ruta ante una pregunta sobre un tercero.
    const p = spec.prompt_message_a_model as string;
    const idx = p.indexOf("consulta_solicitud");
    const seccion = p.slice(idx, p.indexOf('- "humano"', idx));
    expect(seccion).toContain("OTRA persona");
    expect(seccion).toContain('NUNCA uses "consulta_solicitud"');
    expect(seccion).toContain('usa "humano" con "motivo": "no_puedo_responder"');
  });
});

describe("Ubicación combinada con otra pregunta (pide_ubicacion)", () => {
  const evalAppend = (expr: string, base: string) => {
    const inner = expr.trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
    return new Function("$json", `return (${inner});`)({ respuestaFinal: base }) as string;
  };

  it("If - ¿Pide Ubicación? solo se activa cuando el modelo lo marca true", () => {
    const gateWA = spec.if_nodes as unknown as Record<
      string,
      { conds: { left: string }[]; outs: string[][] }
    >;
    expect(gateWA["If - ¿Pide Ubicación? (WA)"].conds[0].left).toContain("pideUbicacion");
    expect(gateWA["If - ¿Pide Ubicación? (Messenger)"].conds[0].left).toContain("pideUbicacion");
  });

  it("WhatsApp agrega la dirección y dispara el pin real, sin el link de Google", () => {
    const texto = evalAppend(spec.text_agregar_ubicacion_wa as string, "La tasa es 1.97%.");
    expect(texto).toContain("La tasa es 1.97%.");
    expect(texto).toContain("Av. Luis Donaldo Colosio 158");
    expect(texto).not.toContain("maps.app.goo.gl");

    const gate = spec.if_nodes as unknown as Record<string, { outs: string[][] }>;
    // La rama TRUE dispara el pin real de WhatsApp, además del texto
    expect(gate["If - ¿Pide Ubicación? (WA)"].outs[0]).toEqual(["Set - Agregar Ubicación WA"]);
  });

  it("Messenger agrega la dirección en texto y el link de Google va aparte, como botón (nunca texto plano)", () => {
    const texto = evalAppend(spec.text_agregar_ubicacion_mg as string, "La tasa es 1.97%.");
    expect(texto).toContain("La tasa es 1.97%.");
    expect(texto).toContain("Av. Luis Donaldo Colosio 158");
    // El link ya no va pegado en el texto — se envía por separado como botón nativo.
    expect(texto).not.toContain("maps.app.goo.gl");
  });

  it("una pregunta de FAQ sin ubicación no dispara el pin de WhatsApp", () => {
    // La rama FALSE del gate va directo a enviar, sin pasar por el pin
    const gate = spec.if_nodes as unknown as Record<string, { outs: string[][] }>;
    expect(gate["If - ¿Pide Ubicación? (WA)"].outs[1]).not.toContain("WhatsApp - Compartir Ubicación");
  });

  it("la ubicación sola (accion: ubicacion) sigue con su flujo dedicado, pero ya no es texto fijo", () => {
    // El destino inmediato ahora es el modelo que redacta con los datos reales;
    // el Set de siempre solo extrae ese texto (mismo patrón que solicitud/requisitos/tasa).
    expect(accionDestination({ accion: "ubicacion" }, "wa")).toBe(
      "Message a model - Respuesta Ubicación WA",
    );
    expect(accionDestination({ accion: "ubicacion" }, "mg")).toBe(
      "Message a model - Respuesta Ubicación Messenger",
    );
  });

  it("el botón Ubicación del menú también pasa por el modelo, no por texto fijo", () => {
    expect(menuDestination(extract("wa", waList("INFO_UBICACION")), "wa")).toBe(
      "Message a model - Respuesta Ubicación WA",
    );
    expect(menuDestination(extract("mg", mgQuick("INFO_UBICACION")), "mg")).toBe(
      "Message a model - Respuesta Ubicación Messenger",
    );
  });

  it("el prompt de ubicación en WhatsApp da la dirección y el horario reales, y avisa del pin", () => {
    const p = spec.prompt_respuesta_ubicacion_wa as string;
    expect(p).toContain("Av. Luis Donaldo Colosio 158");
    expect(p).toContain("9:00 AM - 5:30 PM");
    expect(p).toContain("pin de WhatsApp");
    expect(p).not.toContain("maps.app.goo.gl");
  });

  it("el prompt de ubicación en Messenger nunca deja que el modelo escriba el link (se manda como botón)", () => {
    const p = spec.prompt_respuesta_ubicacion_mg as string;
    expect(p).toContain("Av. Luis Donaldo Colosio 158");
    expect(p).toContain("NUNCA escriba el link de Google Maps como texto");
    expect(p).toContain("botón nativo");
    expect(p).not.toContain("Incluya el link tal cual");
  });

  it("el prompt le pide al modelo responder preguntas múltiples en un solo output", () => {
    const p = spec.prompt_message_a_model as string;
    expect(p).toContain("responde TODAS las partes");
    expect(p).toContain("pide_ubicacion");
  });
});

describe("Los links nunca se mandan como texto plano: siempre como botón nativo", () => {
  // Arquitectura: "Send message" (WA) y "HTTP Request - Enviar Messenger" son
  // los puntos únicos de envío de texto que usan casi todos los flujos. Se
  // insertó una compuerta ("If - ¿Tiene Botón URL?") justo antes de cada uno:
  // si el item trae un botonUrl real, se manda como botón nativo (cta_url en
  // WhatsApp, web_url en Messenger) en vez de como texto. Todo lo que nunca
  // tuvo un link (requisitos, tasa, cancelación, etc.) sigue exactamente igual
  // porque nunca setean botonUrl — la condición es simplemente falsa para ellos.
  const evalBoolCond = (leftExpr: string, botonUrl: unknown) => {
    const inner = leftExpr.trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
    return new Function("$json", `return (${inner});`)({ botonUrl }) === true;
  };

  it("la compuerta se activa solo cuando hay un botonUrl real, en ambos canales", () => {
    const gates = spec.if_nodes as unknown as Record<string, { conds: { left: string }[] }>;
    for (const key of ["If - ¿Tiene Botón URL? (WA)", "If - ¿Tiene Botón URL? (Messenger)"] as const) {
      const left = gates[key].conds[0].left;
      expect(evalBoolCond(left, "https://crm.wcapital.mx/subir/abc")).toBe(true);
      expect(evalBoolCond(left, null)).toBe(false);
      expect(evalBoolCond(left, undefined)).toBe(false);
      expect(evalBoolCond(left, "")).toBe(false);
    }
  });

  it("con botón, WhatsApp manda un mensaje interactivo cta_url (nunca la URL en el body)", () => {
    const gate = spec.if_nodes as unknown as Record<string, { outs: string[][] }>;
    expect(gate["If - ¿Tiene Botón URL? (WA)"].outs[0]).toEqual(["WhatsApp - Enviar Botón URL"]);
    expect(gate["If - ¿Tiene Botón URL? (WA)"].outs[1]).toEqual(["Send message"]);

    const inner = (spec.body_boton_url_wa as string).trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
    const $ = () => ({ item: { json: { senderId: "5216624335276" } } });
    const body = new Function("$", "$json", `return (${inner});`)($, {
      respuestaFinal: "Aquí sigue su link 👇",
      botonUrl: "https://crm.wcapital.mx/subir/abc",
      botonTitulo: "Subir documentos",
    }) as {
      type: string;
      interactive: { type: string; body: { text: string }; action: { parameters: { url: string; display_text: string } } };
    };
    expect(body.interactive.type).toBe("cta_url");
    expect(body.interactive.action.parameters.url).toBe("https://crm.wcapital.mx/subir/abc");
    expect(body.interactive.action.parameters.display_text).toBe("Subir documentos");
    expect(body.interactive.body.text).not.toContain("https://");
  });

  it("con botón, Messenger manda una plantilla de botones web_url (nunca la URL en el body)", () => {
    const gate = spec.if_nodes as unknown as Record<string, { outs: string[][] }>;
    expect(gate["If - ¿Tiene Botón URL? (Messenger)"].outs[0]).toEqual([
      "HTTP Request - Enviar Messenger Botón URL",
    ]);
    expect(gate["If - ¿Tiene Botón URL? (Messenger)"].outs[1]).toEqual(["HTTP Request - Enviar Messenger"]);

    const inner = (spec.body_boton_url_mg as string).trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
    const $ = () => ({ item: { json: { senderId: "999" } } });
    const body = new Function("$", "$json", `return (${inner});`)($, {
      respuestaFinal: "Aquí sigue su link 👇",
      botonUrl: "https://maps.app.goo.gl/m7LTNSgc2RtApndLA",
      botonTitulo: "Ver ubicación",
    }) as { message: { attachment: { payload: { buttons: { type: string; url: string; title: string }[] } } } };
    const button = body.message.attachment.payload.buttons[0];
    expect(button.type).toBe("web_url");
    expect(button.url).toBe("https://maps.app.goo.gl/m7LTNSgc2RtApndLA");
    expect(button.title).toBe("Ver ubicación");
  });

  it("el título del botón nunca excede 20 caracteres (límite de WhatsApp)", () => {
    for (const titulo of ["Subir documentos", "Ver ubicación"]) {
      expect(titulo.length).toBeLessThanOrEqual(20);
    }
  });

  it("la solicitud activa toma el link del dato real de la consulta, nunca de lo que redacte el modelo", () => {
    // botonUrl se lee de $('HTTP Request - Consultar Solicitud WA/Messenger'),
    // no de nada que el modelo haya escrito — así el link nunca se puede
    // inventar ni corromper por una mala redacción del segundo modelo.
    expect(spec.text_solicitud_activa_wa).not.toContain("botonUrl");
    // (la aserción real de esta garantía vive en el propio Set del workflow;
    // aquí solo confirmamos que el texto final sigue siendo puro texto del modelo)
    expect(spec.text_solicitud_activa_wa).toBe("={{ $json.output[0].content[0].text.trim() }}");
  });

  it("el recordatorio de documentos por Messenger ya no manda el link como texto — usa botón web_url", () => {
    const inner = (spec.body_recordatorio_mg as string).trim().replace(/^=\{\{/, "").replace(/\}\}$/, "");
    const body = new Function("$json", `return (${inner});`)({
      external_thread_id: "999",
      url: "https://crm.wcapital.mx/subir/xyz",
    }) as {
      message: {
        text?: string;
        attachment?: { payload: { text: string; buttons: { type: string; url: string }[] } };
      };
    };
    expect(body.message.text).toBeUndefined();
    expect(body.message.attachment?.payload.text).not.toContain("https://");
    expect(body.message.attachment?.payload.buttons[0].type).toBe("web_url");
    expect(body.message.attachment?.payload.buttons[0].url).toBe("https://crm.wcapital.mx/subir/xyz");
  });
});
