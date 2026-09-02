# UNI Bocchi Monitor — Hotfix v1.11.1

## Qué corrige
En la Carga Horaria 2026-2 hay exactamente tres códigos de Software con guion:
- SW-603
- SW-608
- SW-609

La UI debe seguir mostrándolos con guion, pero la consulta de vacantes se envía al endpoint usando el código canónico sin guion:
- SW603
- SW608
- SW609

Esto evita que esos tres cursos queden permanentemente como "Sin dato / Reintento pendiente" mientras cursos como SW605 sí cargan normalmente.

## Cómo aplicar
1. Cierra o deja abierto VS Code; no importa.
2. Copia `extension/uni-content.js` de este parche.
3. Pégalo en `C:\Proyectos\uni-bocchi-monitor\extension\uni-content.js`.
4. Acepta reemplazar el archivo.
5. En Brave abre `brave://extensions/`.
6. Busca **UNI Bocchi Bridge** y pulsa **Recargar**.
7. Recarga también la pestaña de Matrícula UNI con Ctrl+F5.
8. Recarga UNI Bocchi Monitor con Ctrl+F5.
9. En `Todos los cursos`, filtra Software / Ciclo 6 y pulsa ↻ en SW-603, SW-608 y SW-609.

No hace falta desplegar Vercel porque este hotfix está en la extensión local. Si distribuyes la extensión a tus compañeros, sí debes incluir este `uni-content.js` en el paquete que les entregues.
