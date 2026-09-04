# UNI Bocchi Monitor · Parche v1.12

## Qué corrige
En "Todos los cursos", una sección podía mostrar solo un profesor aunque la Carga Horaria Oficial 2026-2 asignara docentes distintos a teoría, práctica o laboratorio.

Ahora cada sección muestra cada asignación docente por separado, de forma compacta:

- (T) Teoría
- (P) Práctica / PRA / PC
- (L) Laboratorio / PC-LAB

Ejemplo esperado para una sección con dos docentes:

(T) ROMERO AQUINO, JUAN CARLOS · Mar 14:00–16:00 · S4-213 · Mié 08:00–10:00 · S4-111
(L) SALCEDO TORRES, JOAQUIN MAGNOT · Lun 14:00–16:00 · LAB-FISI/S4-212

## Archivos que reemplaza
Copia la carpeta `web` del parche sobre:

`C:\Proyectos\uni-bocchi-monitor\web`

Reemplaza estos archivos:

- `web/src/components/AllCoursesView.jsx`
- `web/src/data/allCoursesCatalog.js`
- `web/src/styles.css`

## Importante
No modifica la extensión. No modifica la lógica de consultas, filtros, refresh individual ni actualización manual de "Todos los cursos".

El catálogo fue enriquecido usando la misma Carga Horaria Oficial 2026-2: ahora cada bloque horario conserva su propio profesor.

## Probar localmente
En VS Code:

```powershell
cd C:\Proyectos\uni-bocchi-monitor\web
npm run dev
```

Luego abre el monitor, haz Ctrl+F5 y revisa por ejemplo Física I / Física II. En las secciones con profesor distinto para laboratorio deberían aparecer dos filas docentes.

## Publicar
```powershell
cd C:\Proyectos\uni-bocchi-monitor
git add .
git commit -m "Mostrar multiples docentes por seccion v1.12"
git push
```
