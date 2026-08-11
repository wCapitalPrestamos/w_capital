# W Capital CRM

CRM y gestión de préstamos para W Capital (Hermosillo, Son.). Centraliza las
conversaciones de WhatsApp y Messenger (con handoff bot → humano), el pipeline de
solicitudes de crédito, el expediente digital de documentos, la cartera con su
cobranza semanal (tasa 1.97% semanal, sistema francés) y un dashboard de KPIs.

## Arquitectura

```
Cliente (WhatsApp / Messenger)
        │  webhooks de Meta
        ▼
   n8n (VPS Hetzner) ── contesta FAQs con OpenAI, SIN estado
        │  POST /api/n8n/* (header x-crm-secret)
        ▼
   CRM Next.js (Vercel) ─── envíos salientes directo a Meta Graph API
        │
        ▼
   Supabase (Postgres + Auth + Storage + Realtime)
        ▲
        │  ligas /subir/<token> (URLs firmadas, subida directa a Storage)
Portal público de documentos (celular del cliente)
```

- **n8n** solo recibe webhooks de Meta y contesta FAQs. En cada mensaje entrante
  llama a `POST /api/n8n/inbound`; la respuesta incluye `bot_active` — si es
  `false`, el bot calla (un humano tomó la conversación). Ver
  [docs/integracion-n8n.md](docs/integracion-n8n.md).
- **El CRM** es dueño de todo el estado: contactos, conversaciones, pausa del bot,
  solicitudes, documentos, préstamos y pagos. Los envíos del inbox van directo a
  la Graph API de Meta (manejo síncrono del error 131047 "fuera de ventana 24 h").
- **RLS activo en todas las tablas**; aprobar/rechazar solicitudes está limitado a
  los roles `admin`/`analyst` también a nivel de base. n8n y el portal público
  nunca tocan Supabase: pasan por rutas API con service role.

## Desarrollo local

Requisitos: Node 20+, Docker, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
supabase start        # usa puertos 553xx (ver supabase/config.toml)
supabase db reset     # aplica las 3 migraciones
npm run seed          # usuarios + datos de ejemplo
npm run dev
```

Usuarios del seed (contraseña `wcapital123`):

| Correo | Rol |
|---|---|
| `admin@wcapital.mx` | Administrador |
| `asesora@wcapital.mx` | Asesora |
| `analista@wcapital.mx` | Analista |

Tests (matemática financiera):

```bash
npm test
```

## Variables de entorno

Ver [.env.example](.env.example). Las importantes:

| Variable | Qué es |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor** (rutas n8n/portal/cron) |
| `N8N_WEBHOOK_SECRET` | Secreto compartido con n8n (`openssl rand -hex 32`) |
| `WHATSAPP_TOKEN` | Token **permanente de System User** de Meta (no el de 60 días) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de WhatsApp Business |
| `MESSENGER_PAGE_TOKEN` | Token de la página de Facebook |
| `CRON_SECRET` | Protege `/api/cron/overdue` |
| `NEXT_PUBLIC_APP_URL` | URL pública (para las ligas del portal) |

Sin tokens de Meta configurados, los envíos del inbox se **simulan** (útil en dev).

## Despliegue a producción

1. **Supabase**: crear proyecto (región us-west), `supabase link` y
   `supabase db push`. Crear los usuarios reales en Authentication (o desde
   Ajustes → Usuarios ya con un admin). Plan **Pro (~$25 USD/mes)**: el free tier
   pausa proyectos y 1 GB de Storage se agota con fotos de INE.
2. **Vercel**: importar el repo, configurar las variables de entorno y desplegar.
   El cron de mora ya está en [vercel.json](vercel.json) (13:00 UTC = 6:00
   Hermosillo). Plan **Pro (~$20 USD/mes)**: el plan Hobby no permite uso
   comercial.
3. **n8n (Hetzner, ya existente)**: agregar los nodos HTTP del contrato
   ([docs/integracion-n8n.md](docs/integracion-n8n.md)) con el mismo
   `N8N_WEBHOOK_SECRET`.
4. **Meta**: crear un **System User** en Business Manager y generar token
   permanente con permisos `whatsapp_business_messaging` y `pages_messaging`;
   registrar plantillas de utilidad (`seguimiento_solicitud`,
   `recordatorio_pago`, `documentos_pendientes`) — la aprobación tarda días;
   solicitar el tag `HUMAN_AGENT` de Messenger (app review) para responder hasta
   7 días después del último mensaje.

### Seguridad — pendientes urgentes

- ⚠️ **Rotar credenciales compartidas por WhatsApp** durante el proyecto: la API
  key de OpenAI, el client secret de Google OAuth y las contraseñas de
  Hetzner/portales que viajaron en texto plano en el chat. Generar nuevas y
  guardarlas solo en variables de entorno (Vercel/n8n).
- El bucket `documents` es privado; todo acceso es por URLs firmadas de vida
  corta. Las ligas del portal duran 7 días y se guardan hasheadas.
- Definir retención de expedientes (p. ej. purgar documentos de solicitudes
  rechazadas/canceladas después de N meses) conforme a la LFPDPPP.

## Estructura

```
supabase/migrations/     esquema completo (0001 init, 0002 RLS, 0003 vistas)
src/app/(app)/           páginas autenticadas: dashboard, inbox, leads,
                         solicitudes, prestamos, clientes, ajustes
src/app/subir/[token]/   portal público de documentos (mobile-first)
src/app/api/n8n/         contrato con n8n (inbound, bot-reply, handoff,
                         status, upload-link)
src/app/api/portal/      subida firmada del portal (upload-url, confirm)
src/app/api/cron/        mora diaria
src/actions/             server actions (única vía de mutación de la UI)
src/lib/loans/           amortización y asignación de pagos (con tests en tests/)
src/lib/meta/            envíos a la Graph API de Meta
scripts/seed-dev.ts      seed de desarrollo
```
