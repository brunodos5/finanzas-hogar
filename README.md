# Finanzas del Hogar

App estatica para registrar movimientos del hogar con conceptos propios, carga de comprobantes, importacion bancaria, exportacion a Excel y sincronizacion con Supabase.

## Archivos

- `index.html`: app completa.
- `netlify.toml`: configuracion para publicar en Netlify.
- `supabase/schema.sql`: tabla y politicas RLS para sincronizar datos por usuario.

## Supabase

1. Crear un proyecto en Supabase.
2. Ir a SQL Editor y ejecutar `supabase/schema.sql`.
3. Ir a Authentication > Providers y dejar habilitado Email y GitHub.
4. Ir a Project Settings > API y copiar:
   - Project URL
   - anon public key
5. La app ya viene preconfigurada con el Project URL y la publishable key del proyecto `Brunodos7489`.
6. En la app, abrir `Nube` e iniciar sesion con GitHub o con el link por email.
7. Una vez iniciada la sesion, usar `Subir a Supabase` o `Bajar de Supabase`.

## Netlify

Publicar como sitio estatico. El directorio de publicacion es la raiz del proyecto.

Para usar IA con OpenAI en Netlify:

1. En Netlify, ir a Site configuration > Environment variables.
2. Agregar `OPENAI_API_KEY` con tu clave de OpenAI.
3. Opcional: agregar `OPENAI_MODEL` si queres cambiar el modelo. Si no, usa `gpt-4.1-mini`.
4. Volver a desplegar el sitio.

La app llama a:

- `/.netlify/functions/analyze-receipt`
- `/.netlify/functions/analyze-bank-statement`

## GitHub

Subir estos archivos a un repositorio y conectar ese repositorio desde Netlify para despliegue automatico.
