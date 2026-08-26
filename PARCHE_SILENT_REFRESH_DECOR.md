# UNI Bocchi Monitor · parche v1.2

## Qué corrige

La versión anterior podía volver a programar una sincronización casi inmediata cuando `data` cambiaba. Eso hacía que el botón y el estado mostraran repetidamente **Actualizando…** y podía terminar en respuestas **HTTP 429**.

En esta versión hay una sola cadena de temporización:

1. se consulta la UNI;
2. llegan los resultados;
3. se calcula el intervalo seguro;
4. se programa el siguiente barrido;
5. los barridos posteriores son silenciosos.

El estado visible se establece en la carga de la página y no va cambiando durante cada actualización automática.

## Decoraciones

Las imágenes con fondo blanco suministradas fueron convertidas a PNG con transparencia y reducidas para usarse como stickers. Se distribuyen alternando izquierda/derecha a diferentes alturas de la página. No reciben clics ni bloquean la interfaz.

En pantallas menores a 980 px se ocultan automáticamente para mantener la legibilidad.
