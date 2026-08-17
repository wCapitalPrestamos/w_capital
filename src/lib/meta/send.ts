import "server-only";

// Envío saliente directo a Meta Graph API (WhatsApp Cloud API + Messenger).
// Si los tokens no están configurados (dev local), se simula el envío.

const GRAPH = "https://graph.facebook.com/v21.0";

export class MetaSendError extends Error {
  constructor(
    message: string,
    public code: number,
    public isOutside24hWindow: boolean,
  ) {
    super(message);
    this.name = "MetaSendError";
  }
}

export interface SendResult {
  externalMessageId: string;
  simulated: boolean;
}

function simulatedResult(): SendResult {
  return { externalMessageId: `local.${crypto.randomUUID()}`, simulated: true };
}

async function graphRequest(url: string, body: object, token: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = json?.error ?? {};
    const code: number = err.code ?? res.status;
    // 131047: fuera de la ventana de 24 h (WhatsApp) · 10: policy (Messenger)
    const outside = code === 131047 || code === 10;
    throw new MetaSendError(
      err.message ?? `Meta API error ${res.status}`,
      code,
      outside,
    );
  }

  return json;
}

export async function sendWhatsAppText(
  waId: string,
  text: string,
): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return simulatedResult();

  const json = await graphRequest(
    `${GRAPH}/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to: waId,
      type: "text",
      text: { body: text },
    },
    token,
  );

  return {
    externalMessageId: json?.messages?.[0]?.id ?? `wa.${crypto.randomUUID()}`,
    simulated: false,
  };
}

export async function sendWhatsAppTemplate(
  waId: string,
  templateName: string,
  languageCode = "es_MX",
  components?: object[],
): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return simulatedResult();

  const json = await graphRequest(
    `${GRAPH}/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to: waId,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    },
    token,
  );

  return {
    externalMessageId: json?.messages?.[0]?.id ?? `wa.${crypto.randomUUID()}`,
    simulated: false,
  };
}

// El webhook de Messenger no manda el nombre del cliente (a diferencia de
// WhatsApp) — hay que pedirlo aparte con el token de la página.
export async function getMessengerProfileName(
  psid: string,
): Promise<string | null> {
  const token = process.env.MESSENGER_PAGE_TOKEN;
  if (!token) {
    console.error("[getMessengerProfileName] MESSENGER_PAGE_TOKEN no está definido en este proceso");
    return null;
  }

  try {
    const res = await fetch(
      `${GRAPH}/${psid}?fields=first_name,last_name&access_token=${token}`,
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[getMessengerProfileName] Graph API error", res.status, json);
      return null;
    }
    const name = [json.first_name, json.last_name].filter(Boolean).join(" ");
    return name || null;
  } catch (e) {
    console.error("[getMessengerProfileName] fetch failed", e);
    return null;
  }
}

export async function sendMessengerText(
  psid: string,
  text: string,
): Promise<SendResult> {
  const token = process.env.MESSENGER_PAGE_TOKEN;
  if (!token) return simulatedResult();

  const json = await graphRequest(
    `${GRAPH}/me/messages`,
    {
      recipient: { id: psid },
      messaging_type: "RESPONSE",
      message: { text },
    },
    token,
  );

  return {
    externalMessageId: json?.message_id ?? `msg.${crypto.randomUUID()}`,
    simulated: false,
  };
}
