# UNI Bocchi Monitor v1.7 — Todos los cursos

## 1. Haz una copia de seguridad
Copia tu carpeta actual:

`C:\Proyectos\uni-bocchi-monitor`

y guárdala, por ejemplo, como:

`C:\Proyectos\uni-bocchi-monitor-backup-v1.6.4`

## 2. Descomprime el ZIP
Dentro encontrarás dos carpetas: `web` y `extension`.

## 3. Actualiza la web
Copia el contenido de la carpeta `web` del parche sobre:

`C:\Proyectos\uni-bocchi-monitor\web`

Windows preguntará si deseas reemplazar archivos. Elige **Reemplazar los archivos en el destino**.

Se añaden dos archivos nuevos:
- `web\src\components\AllCoursesView.jsx`
- `web\src\data\allCoursesCatalog.js`

Y se reemplazan:
- `web\src\App.jsx`
- `web\src\styles.css`
- `web\src\lib\uniBridge.js`

No borres `web\public\assets`.

## 4. Actualiza UNI Bocchi Bridge
Copia los cuatro archivos de `extension` del parche sobre:

`C:\Proyectos\uni-bocchi-monitor\extension`

Reemplaza:
- `background.js`
- `uni-content.js`
- `web-bridge.js`
- `manifest.json`

No borres la carpeta `extension\icons`.

## 5. Recarga la extensión
### Brave
Abre `brave://extensions/`

### Chrome
Abre `chrome://extensions/`

### Edge
Abre `edge://extensions/`

### Opera / Opera GX
Abre `opera://extensions/`

Busca **UNI Bocchi Bridge** y pulsa **Recargar**. La versión del manifiesto debe indicar `1.2.0`.

## 6. Recarga Matrícula UNI
Si tienes una pestaña de Matrícula UNI abierta, pulsa `Ctrl + F5`.

Mantén tu sesión iniciada normalmente. No copies tokens ni credenciales al monitor.

## 7. Prueba localmente
En VS Code abre una terminal y ejecuta:

```powershell
cd C:\Proyectos\uni-bocchi-monitor\web
npm run dev
```

Abre la dirección que muestre Vite, normalmente `http://localhost:5173/`.

Pulsa `Ctrl + F5`.

En el menú lateral debe aparecer:

**Todos los cursos**

## 8. Qué esperar la primera vez
La lista de cursos aparece inmediatamente usando el catálogo oficial. Las vacantes se van completando de manera escalonada.

No se consultan los ~139 cursos al mismo tiempo. La extensión procesa pequeños lotes y guarda cada resultado en el navegador.

La primera carga completa puede tardar unos minutos. Después, los valores guardados aparecen instantáneamente incluso al hacer F5, y solo se renuevan cuando tienen aproximadamente 5 minutos de antigüedad.

## 9. Filtros
En **Todos los cursos** puedes seleccionar:
- carrera;
- ciclo 1–10;
- Electivos / complementarios;
- búsqueda por código, nombre o profesor.

Si eliges una carrera concreta, los ciclos se ordenan según la clasificación curricular de esa carrera.

## 10. Protección contra saturación
La vista usa:
- caché por curso de 5 minutos;
- lotes de 10 códigos;
- espera aproximada de 1.35 segundos entre consultas;
- pausa automática ante `HTTP 429`;
- un único tab trabajador de Matrícula UNI;
- pausa del auto-refresco del monitor personal mientras estás en “Todos los cursos”.

## 11. Sube a GitHub / Vercel
Cuando la prueba local esté correcta:

```powershell
cd C:\Proyectos\uni-bocchi-monitor
git add .
git commit -m "Agregar vista de todos los cursos FIIS"
git push
```

Si Vercel ya está conectado a ese repositorio, se desplegará automáticamente. No tienes que crear otro proyecto.

## 12. Si algún curso aparece sin datos
El catálogo seguirá mostrando curso, sección, profesor y horario de la carga oficial. La zona de vacantes mostrará `—` hasta que la API responda.

Si la UNI limita temporalmente consultas, el monitor conserva el último dato válido y vuelve a intentarlo después.
