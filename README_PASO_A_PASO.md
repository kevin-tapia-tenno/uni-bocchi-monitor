# UNI Bocchi Monitor · parche v1.11

Este parche modifica únicamente la vista **Todos los cursos**.

## Objetivo

Reducir al mínimo las consultas contra Matrícula UNI:

1. Abrir **Todos los cursos** no realiza ninguna solicitud.
2. Primero eliges filtros (carrera/malla/ciclo) o escribes una búsqueda.
3. La pantalla muestra únicamente el catálogo que coincide con esos filtros.
4. Las vacantes se consultan solamente cuando pulsas **Actualizar filtrados**.
5. No existe actualización automática, ni cada 5 min, ni cada 10 min.
6. Cada tarjeta tiene un botón **↻** que actualiza exclusivamente ese curso.

## Instalación

Copia la carpeta `web` del parche sobre:

`C:\Proyectos\uni-bocchi-monitor\web`

Acepta reemplazar archivos. No borres `web\public` ni tus recursos Bocchi.

La extensión no cambia, por lo que no hace falta reemplazar `extension` ni recargarla.

Después ejecuta:

```powershell
cd C:\Proyectos\uni-bocchi-monitor\web
npm run dev
```

Abre la URL de Vite y pulsa `Ctrl + F5`.

## Prueba recomendada

1. Entra a **Todos los cursos**.
   - Debe indicar que selecciones un filtro.
   - No debe comenzar una consulta global.
2. Elige, por ejemplo:
   - Carrera: Ingeniería de Software
   - Ciclo: 6
3. Deben aparecer únicamente los cursos correspondientes.
4. Todavía no debe comenzar ninguna consulta por sí sola.
5. Pulsa **Actualizar filtrados**.
   - Solo esos cursos deben consultarse.
6. Pulsa **↻** en `SW-603` (o cualquier otro curso visible).
   - Solo ese curso debe volver a consultarse.
7. Espera varios minutos sin tocar nada.
   - No debe aparecer una nueva actualización automática.

## Publicar en Vercel

Cuando confirmes el funcionamiento:

```powershell
cd C:\Proyectos\uni-bocchi-monitor
git add .
git commit -m "Todos los cursos manual y filtrado v1.11"
git push
```

Vercel debería desplegar el commit automáticamente si el repositorio continúa conectado.
