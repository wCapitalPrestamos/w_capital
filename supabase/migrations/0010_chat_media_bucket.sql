-- ---------------------------------------------------------------------------
-- Storage: bucket privado para adjuntos de chat (fotos/audio/video/docs de
-- WhatsApp y Messenger), re-alojados desde n8n vía /api/n8n/media-upload.
-- Mismo patrón que el bucket "documents": privado, sin RLS en storage.objects
-- (todo el acceso pasa por el service role en el servidor).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media', 'chat-media', false,
  15728640, -- 15 MB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr',
    'video/mp4', 'video/3gpp',
    'application/pdf'
  ]
)
on conflict (id) do nothing;
