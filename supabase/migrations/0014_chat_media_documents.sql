-- ---------------------------------------------------------------------------
-- El bucket chat-media solo aceptaba application/pdf como documento. Para que
-- el equipo pueda enviar documentos de Office desde el CRM (no solo recibir
-- PDFs de WhatsApp/Messenger), se amplía el allow-list.
-- ---------------------------------------------------------------------------

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr',
  'video/mp4', 'video/3gpp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain'
]
where id = 'chat-media';
