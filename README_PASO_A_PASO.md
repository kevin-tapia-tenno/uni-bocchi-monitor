# UNI Bocchi Monitor — PARCHE v1.9

## Objetivo
Corrige la vista **Todos los cursos** y cambia por completo la política de actualización.

### Comportamiento nuevo
1. Al entrar a **Todos los cursos**, se hace **una sola carga inicial** de los cursos aperturados.
2. La actualización automática siempre inicia **DESACTIVADA** cada vez que se entra a esta vista.
3. Botón **Actualizar ahora**: fuerza una consulta manual de los cursos visibles según los filtros actuales.
4. Botón **Auto desactivado / Auto · 10 min**: permite activar o desactivar la actualización automática.
5. Cuando el Auto está activado, consulta cada **10 minutos**.
6. Una actualización manual reinicia el plazo del Auto; así no se hacen dos consultas casi seguidas.
7. Si sales de **Todos los cursos**, esta vista deja de programar nuevas consultas.

## Corrección importante: falsos “Lleno”
En v1.8, una sección todavía no consultada usaba `null` para matriculados/vacantes. JavaScript convierte `Number(null)` en `0`, por lo que podía verse algo como:

- `0/32 matriculados`
- `Lleno`

sin que realmente existiera una consulta válida.

v1.9 ya no interpreta `null` como cero. Mientras falta respuesta muestra:

- `—/32`
- `esperando consulta`
- `Sin dato`

Además, si la API devuelve una combinación incoherente, por ejemplo aforo 32 + matriculados 0 + libres 0, la vista calcula las libres como `32 - 0 = 32` para no mostrar un falso lleno.

## Protección por límite de consultas UNI
Si la UNI responde HTTP 429 o quedan muy pocas consultas:
- el proceso hace una pausa corta;
- conserva los datos ya obtenidos;
- reintenta los cursos pendientes hasta 2 veces;
- no borra datos anteriores por un fallo temporal.

## Archivos a reemplazar
Copiar el contenido de `web/` sobre la carpeta `web/` del proyecto:

- `web/src/components/AllCoursesView.jsx`
- `web/src/styles.css`

No es necesario modificar ni recargar la extensión para este parche.

## Instalación
1. Cierra `npm run dev` si está ejecutándose.
2. Haz una copia de seguridad de tu proyecto.
3. Copia la carpeta `web` de este parche sobre:
   `C:\Proyectos\uni-bocchi-monitor\web`
4. Acepta **Reemplazar los archivos en el destino**.
5. En VS Code:

```powershell
cd C:\Proyectos\uni-bocchi-monitor\web
npm run dev
```

6. Abre la web local y usa `Ctrl + F5`.

## Prueba recomendada
1. Entra a Monitor y confirma que no se consulta "Todos los cursos".
2. Entra a **Todos los cursos**.
3. Verifica que aparezcan los botones:
   - `Actualizar ahora`
   - `Auto desactivado`
4. Deja terminar la carga inicial.
5. Pulsa `Actualizar ahora`: debe consultar de nuevo inmediatamente.
6. Pulsa `Auto desactivado`: debe cambiar a `Auto · 10 min`.
7. Pulsa otra vez: debe volver a `Auto desactivado`.
8. Sal de **Todos los cursos** y vuelve a entrar: Auto debe aparecer nuevamente desactivado.
9. Busca una sección que antes mostraba `0/32` + `Lleno` sin datos. Ahora debe mostrar datos reales o `Sin dato`, nunca un falso lleno por `null`.

## Publicar en Vercel
Desde la raíz del proyecto:

```powershell
cd C:\Proyectos\uni-bocchi-monitor
git add .
git commit -m "Fix refresh controls and vacancy states v1.9"
git push
```

Vercel desplegará el cambio si el repositorio continúa conectado.
