# UNI Bocchi Monitor — v1.12.1

Este hotfix se aplica encima de **v1.12**.

## Qué corrige

- Los chips ahora dicen `T`, `P` o `L`, sin paréntesis.
- La interfaz no supone que todos los cursos tengan la misma estructura.
- Cada sección muestra únicamente los tipos de clase que realmente aparecen en la carga horaria oficial 2026-2.

Normalización usada:

- `T`, `TEO`, `TEORÍA` → **T**
- `P`, `PRA`, `PC`, `PRÁCTICA` → **P**
- `LAB`, `LABORATORIO`, `PC / LAB` → **L**

Por eso son válidas, entre otras, secciones con:

- solo `P`
- solo `T`
- `T + P`
- `T + L`
- `T + P + L`

No se crea una fila T/P/L si ese tipo no existe para la sección.

## Instalación

Copia la carpeta `web` sobre:

`C:\Proyectos\uni-bocchi-monitor\web`

y acepta reemplazar los archivos.

Después:

```powershell
cd C:\Proyectos\uni-bocchi-monitor\web
npm run dev
```

Haz `Ctrl + F5` en el navegador.

## Archivos modificados

- `web/src/components/AllCoursesView.jsx`
- `web/src/styles.css`
