# UNI Bocchi Monitor — Hotfix v1.11.3

## Qué corrige

El hotfix v1.11.2 corrigió la validación dentro de `uni-content.js`, pero quedaba una segunda validación en `background.js`.

Esa validación todavía aceptaba únicamente códigos con 2 letras + 3 dígitos, por ejemplo:

- HU501
- SI505
- SW503
- SW-603

Por eso códigos base FIIS de 3 letras + 2 dígitos eran descartados antes de llegar a `uni-content.js`, por ejemplo:

- BEG01
- BRN01
- BEF01
- BRC01
- BMA01

Ahora `background.js` acepta ambos formatos:

- `AA999` / `AA-999`
- `AAA99`

## Archivo a reemplazar

Copia:

`extension/background.js`

sobre:

`C:\Proyectos\uni-bocchi-monitor\extension\background.js`

## Después de copiar

1. Abre `brave://extensions/`.
2. Busca **UNI Bocchi Bridge**.
3. Pulsa **Recargar**.
4. Recarga con `Ctrl + F5` la página de Matrícula UNI.
5. Recarga con `Ctrl + F5` UNI Bocchi Monitor.
6. Ve a **Todos los cursos**.
7. Filtra de nuevo y pulsa `Actualizar filtrados`, o usa `↻` únicamente en BEG01 o BRN01.

## Resultado esperado

Los códigos `BEG01` y `BRN01` ya no deben ser eliminados por el background de la extensión y deben llegar a la petición `/api/matricula/cursos/{codigo}/horarios`.

No es necesario modificar Vercel: este hotfix solo cambia la extensión local.
