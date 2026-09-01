# UNI Bocchi Monitor — Parche v1.8

Este parche es acumulativo sobre v1.7 y actualiza la vista **Todos los cursos**.

## Cambios

- Filtro **Malla**.
  - Sistemas: **Antigua 2018-II** y **Nueva 2026-II**.
  - Industrial: **Antigua 2018** y **Nueva 2026**.
  - Software: malla suministrada.
  - Inteligencia Artificial: plan 2025-II suministrado.
- Los ciclos y categorías se obtienen de las mallas suministradas.
- El catálogo visible sigue saliendo **únicamente** de la Carga Horaria Oficial 2026-2; una malla nunca agrega un curso que no esté aperturado.
- Actualización automática: **cada 5 minutos**.
- Botón **Actualizar ahora**: fuerza la actualización manual de los cursos que estén visibles con los filtros actuales.
- Se separan en el filtro: **Electivos** y **Complementarios / extracurriculares**.
- La vista sigue sin vigilancia, recomendaciones, sonidos ni intentos de matrícula.

## Aplicación

1. Cierra el servidor local de Vite si está abierto.
2. Haz una copia de seguridad de `C:\Proyectos\uni-bocchi-monitor`.
3. Copia la carpeta `web` de este parche sobre `C:\Proyectos\uni-bocchi-monitor\web` y acepta reemplazar.
4. Copia la carpeta `extension` sobre `C:\Proyectos\uni-bocchi-monitor\extension` y acepta reemplazar. La extensión no cambia funcionalmente respecto de v1.7, pero se incluye para que el parche sea acumulativo.
5. En `brave://extensions/`, `chrome://extensions/`, `edge://extensions/` u `opera://extensions/`, pulsa **Recargar** en UNI Bocchi Bridge.
6. Abre Matrícula UNI en `/cursos-disponibles` e inicia sesión.
7. Ejecuta la web:

```powershell
cd C:\Proyectos\uni-bocchi-monitor\web
npm run dev
```

8. Haz `Ctrl + F5` y abre **Todos los cursos**.

## Prueba recomendada

- Carrera: Ingeniería de Sistemas.
- Cambia entre `Malla antigua · 2018-II` y `Malla nueva · 2026-II`; deben cambiar los ciclos/cursos según la malla.
- Haz la misma prueba en Ingeniería Industrial.
- Pulsa **Actualizar ahora** y confirma que aparece el progreso.
- Espera 5 minutos y comprueba que vuelve a ejecutarse la actualización automática.
- Verifica que no aparezca ningún curso que no exista en el catálogo oficial 2026-2 incluido en `allCoursesCatalog.js`.

## Git / Vercel

```powershell
cd C:\Proyectos\uni-bocchi-monitor
git add .
git commit -m "Todos los cursos: filtro de malla y refresco manual v1.8"
git push
```

Si Vercel está conectado al repositorio, desplegará el commit automáticamente.
