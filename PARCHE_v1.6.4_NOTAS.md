# PARCHE v1.6.4 · evitar pestañas UNI repetidas

Este parche corrige la creación repetida de pestañas de Matrícula UNI.

## Cambios

- **El monitor ya no abre automáticamente `/matricula` para leer tu turno.**
- Si ya tienes `/matricula` abierta, la reutiliza.
- Si el turno ya fue leído previamente, reutiliza la caché local.
- Si no existe pestaña ni caché, simplemente te indica que abras Matrícula UNI una vez; **no crea ninguna pestaña por su cuenta**.
- La pestaña de trabajo de `Cursos disponibles` ahora tiene un **lock de creación** y un ID persistente, evitando que dos sincronizaciones creen varias pestañas a la vez.
- Si esa pestaña de trabajo es redirigida por una sesión vencida, el puente **no sigue creando nuevas pestañas en cada refresco**.
- Los botones `Abrir Matrícula` / `Ir a Matrícula` siguen funcionando porque allí la apertura sí es un clic explícito del usuario.

## Instalación

Reemplaza la carpeta `extension` de tu proyecto por la de este parche (conserva tus iconos si tu carpeta local ya los tiene).

Luego ve a:

- Brave: `brave://extensions/`
- Chrome: `chrome://extensions/`
- Edge: `edge://extensions/`
- Opera: `opera://extensions/`

Busca **UNI Bocchi Bridge** y pulsa **Recargar**.

Después recarga tu monitor con `Ctrl + F5`.

## Versión de la extensión

`1.1.1`
