# Integración n8n ↔ CRM

n8n (en el VPS de Hetzner) sigue siendo la pasarela de canales y el cerebro de
FAQs con OpenAI. El CRM es dueño de todo el estado. n8n **no** tiene credenciales
de Supabase: solo llama rutas del CRM con el header `x-crm-secret`.

Todas las rutas responden JSON y regresan `401` si falta o no coincide el secreto.

```
Base: https://<tu-dominio-vercel>   (dev: http://localhost:3000)
Header requerido: x-crm-secret: <N8N_WEBHOOK_SECRET>
Content-Type: application/json
```

## Flujo en n8n (cambios mínimos al workflow existente)

```
Webhook Meta (WhatsApp / Messenger)
  │
  ├─► [HTTP] POST /api/n8n/inbound        ← SIEMPRE, por cada mensaje entrante
  │        │
  │        ├─ bot_active = false → FIN (un humano atiende; no contestar)
  │        └─ bot_active = true  → continúa el flujo actual de OpenAI
  │                                   │
  │                ┌──────────────────┤
  │                │ respuesta FAQ    │ fuera de alcance
  │                ▼                  ▼
  │   enviar respuesta por Meta   [HTTP] POST /api/n8n/handoff
  │                │              enviar contacto de la asesora
  │                ▼              (template WA / texto Messenger)
  │   [HTTP] POST /api/n8n/bot-reply
  │
  └─► (webhook de estatus de Meta) → [HTTP] POST /api/n8n/status
```

Para la rama "el cliente quiere iniciar su trámite": llamar
`POST /api/n8n/upload-link` y enviar la URL que regresa.

## Endpoints

### 1. `POST /api/n8n/inbound` — mensaje entrante

```json
{
  "channel": "whatsapp",                    // o "messenger"
  "external_thread_id": "5216621234567",    // wa_id o PSID
  "external_message_id": "wamid.HBgM...",   // id del mensaje de Meta
  "contact": { "name": "Juan Pérez", "phone": "+5216621234567" },
  "message": {
    "type": "text",                         // text|image|audio|video|document|location|sticker|other
    "text": "¿Cuánto me prestan?",
    "media_url": null,
    "timestamp": "2026-08-10T18:22:31Z"
  }
}
```

Respuesta:

```json
{ "ok": true, "conversation_id": "…", "duplicate": false, "bot_active": true }
```

- **`bot_active` es el semáforo del bot.** `false` → no contestar nada.
- Es idempotente por `external_message_id` (Meta reintenta webhooks);
  `duplicate: true` indica que ya se había recibido.
- La reanudación automática también vive aquí: si el humano llevaba >4 h sin
  actividad, la conversación regresa a `bot` y responde `bot_active: true`.

### 2. `POST /api/n8n/bot-reply` — registrar lo que contestó el bot

```json
{
  "channel": "whatsapp",
  "external_thread_id": "5216621234567",
  "external_message_id": "wamid.XYZ...",    // opcional
  "text": "La tasa es de 1.97% semanal.",
  "timestamp": "2026-08-10T18:22:35Z"       // opcional
}
```

Sin esto, la asesora no ve en la bandeja lo que el bot ya respondió.

### 3. `POST /api/n8n/handoff` — escalar a humano

```json
{
  "channel": "whatsapp",
  "external_thread_id": "5216621234567",
  "reason": "out_of_scope"                  // out_of_scope | client_requested | other
}
```

Efecto: la conversación pasa a `human`, el bot se pausa 4 h (configurable en
`app_settings.handoff_pause_hours`) y resalta como no leída en la bandeja.
n8n debe además mandar el mensaje de "te contactará una asesora" + tarjeta de
contacto (template en WhatsApp, texto en Messenger). El bot se reactiva cuando la
asesora pulsa **"Devolver al bot"** o al expirar la pausa.

### 4. `POST /api/n8n/status` — estatus de entrega (opcional, fase de pulido)

```json
{ "external_message_id": "wamid.XYZ...", "status": "delivered" }
```

`status`: `sent | delivered | read | failed` (con `error_detail` opcional).
Alimenta las palomitas del inbox. Nunca degrada un estatus (read > delivered).

### 5. `POST /api/n8n/upload-link` — liga del portal de documentos

```json
{ "channel": "whatsapp", "external_thread_id": "5216621234567" }
```

Respuesta:

```json
{ "ok": true, "application_id": "…", "url": "https://…/subir/Drk2AcXQ…" }
```

Busca la solicitud abierta del contacto (o crea una en `docs_pending`), genera un
token de 7 días y regresa la URL lista para enviarse al cliente. Requiere que el
contacto ya exista (es decir, que ya haya pasado por `/inbound`).

## Notas de operación

- **Ventana de 24 h**: los envíos salientes del CRM van directo a Meta; si la
  ventana venció, el composer lo detecta y avisa (WhatsApp: solo plantillas).
- **Reintentos**: si el CRM no responde (deploy, timeout), n8n puede reintentar
  el `/inbound` sin miedo — es idempotente.
- **Logs**: cada payload crudo queda en la tabla `webhook_events` para depurar.
- El workflow de n8n conviene exportarlo a JSON y versionarlo en este repo
  (`docs/n8n-workflow.json`) como respaldo del VPS.
