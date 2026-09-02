# UNI Bocchi Monitor — Hotfix v1.11.2

## Qué corrige

La extensión solo aceptaba códigos con el formato `AA999` (por ejemplo `SI505`) y, tras el hotfix anterior, `AA-999` (por ejemplo `SW-603`).

La Carga Horaria Oficial 2026-2 también contiene cursos base con formato `AAA99`, por ejemplo:

- `BEF01`
- `BEG01`
- `BFI01`
- `BIC01`
- `BMA01`
- `BMA02`
- `BMA03`
- `BQU01`
- `BRC01`
- `BRN01`

Esos códigos eran descartados **antes de hacer el fetch**, por lo que la web mostraba `Sin dato` / `Reintento pendiente` aunque el botón ↻ se pulsara varias veces.

v1.11.2 permite los tres formatos reales encontrados:

- `AA999`
- `AAA99`
- `AA-999` (se normaliza a `AA999` solo al consultar la API)

## Instalación

1. Cierra o deja abierta la web; no importa.
2. Copia `extension/uni-content.js` de este parche.
3. Reemplaza:

   `C:\Proyectos\uni-bocchi-monitor\extension\uni-content.js`

4. En Brave abre `brave://extensions/`.
5. Busca **UNI Bocchi Bridge** y pulsa **Recargar**.
6. Refresca la pestaña de Matrícula UNI con `Ctrl + F5`.
7. Refresca UNI Bocchi Monitor con `Ctrl + F5`.
8. En `Todos los cursos`, filtra el ciclo deseado y pulsa ↻ en `BRN01` o `BRC01`.

No es necesario desplegar Vercel para probar este hotfix porque cambia únicamente la extensión local.
