# Finanzas del Hogar

App estática para registrar movimientos del hogar con conceptos propios, carga de comprobantes, importación bancaria, exportación a Excel y sincronización con Supabase.

## Archivos

- `index.html`: app completa.
- `netlify.toml`: configuración para publicar en Netlify.
- `supabase/schema.sql`: tabla y políticas RLS para sincronizar datos por usuario.

## Supabase

1. Crear un proyecto en Supabase.
2. Ir a SQL Editor y ejecutar `supabase/schema.sql`.
3. Ir a Authentication > Providers y dejar habilitado Email.
4. Ir a Project Settings > API y copiar:
   - Project URL
   - anon public key
5. En la app, abrir `Nube`, pegar esos datos y enviar el link de acceso al email.
6. Una vez iniciada la sesión, usar `Subir a Supabase` o `Bajar de Supabase`.

## Netlify

Publicar como sitio estático. El directorio de publicación es la raíz del proyecto.

Para usar IA con OpenAI en Netlify:

1. En Netlify, ir a Site configuration > Environment variables.
2. Agregar `OPENAI_API_KEY` con tu clave de OpenAI.
3. Opcional: agregar `OPENAI_MODEL` si querés cambiar el modelo. Si no, usa `gpt-4.1-mini`.
4. Volver a desplegar el sitio.

La app llama a:

- `/.netlify/functions/analyze-receipt`
- `/.netlify/functions/analyze-bank-statement`

## GitHub

Subir estos archivos a un repositorio y conectar ese repositorio desde Netlify para despliegue automático.
