# PARCHE v1.3 · PARTICIPANTES FIIS

## Qué añade

- Nueva opción **Participantes** en el menú del monitor.
- Usa únicamente los cursos/secciones vigentes de la carga 2026-2.
- Mapa local `curso + sección -> Moodle ID` con 353/356 secciones identificadas.
- Consulta **solo manual**: no hace solicitudes hasta pulsar `Consultar participantes`.
- La extensión abre temporalmente la página oficial de participantes de UniVirtual en segundo plano, lee únicamente la lista que tu sesión puede ver y cierra esa pestaña al terminar.
- Si UniVirtual redirige a login o niega acceso al aula, el monitor muestra el estado y no intenta eludirlo.

## Archivos que debes reemplazar

Copia respetando estas rutas:

- `extension/manifest.json`
- `extension/background.js`
- `extension/web-bridge.js`
- `web/src/App.jsx`
- `web/src/lib/uniBridge.js`

## Archivos nuevos

- `extension/moodle-content.js`
- `web/src/components/ParticipantsView.jsx`
- `web/src/components/ParticipantsView.css`
- `web/src/data/currentMoodleMap.js`

No hace falta modificar `uni-content.js`, `AllCoursesView.jsx`, `allCoursesCatalog.js` ni tu CSS general.

## Instalación

1. Cierra VS Code o asegúrate de no tener cambios sin guardar.
2. Haz una copia de seguridad de tu proyecto `C:\Proyectos\uni-bocchi-monitor`.
3. Copia el contenido de este ZIP sobre la raíz del proyecto y acepta **Reemplazar** cuando Windows lo pida.
4. En la carpeta `web`, ejecuta:

   ```powershell
   npm run build
   ```

5. Si el build termina correctamente, publica el cambio en Vercel como haces normalmente.
6. La extensión cambia a versión **1.3.0**, por lo que debes recargar/reinstalar la extensión:
   - Desktop: recarga la extensión desde la página de extensiones del navegador.
   - Firefox Android firmado: necesitarás generar/subir la nueva versión firmada, porque ahora el `manifest.json` incluye permiso para `https://univirtual.uni.pe/*` y el nuevo `moodle-content.js`.
7. Inicia sesión normalmente en `https://univirtual.uni.pe/`.
8. Abre el monitor -> **Participantes** -> selecciona curso -> sección -> **Consultar participantes**.

## Comportamiento esperado

- No se ejecuta ninguna consulta al entrar a la vista.
- Cambiar carrera/malla/ciclo/curso/sección tampoco consulta UniVirtual.
- Solo el botón `Consultar participantes` dispara una consulta.
- La consulta usa el Moodle ID ya mapeado para esa sección.
- La pestaña temporal de UniVirtual se cierra automáticamente.
- Si tu cuenta no tiene acceso a la lista, verás `UniVirtual no permite ver los participantes de esta aula con tu sesión actual`.

## Secciones aún sin Moodle ID

- `SI403 · U` — Metodología de los Sistemas Blandos
- `SI602 · W` — Dinámica de Sistemas
- `TE302 · X` — Diseño Asistido por Computador

Estas secciones simplemente no aparecerán como consultables hasta que se identifique su Moodle ID.

## Validación rápida

Prueba primero con una sección que ya sabemos que tu cuenta puede abrir, por ejemplo `SI707U` si sigue siendo accesible. Debe mostrar la lista de alumnos sin exponer cookies ni credenciales a Vercel.
