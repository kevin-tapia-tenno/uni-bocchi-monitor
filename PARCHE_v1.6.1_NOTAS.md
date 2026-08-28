# PARCHE v1.6.1 · Bocchi de fondo movida a la derecha

## Qué corrige
- Quita la Bocchi decorativa que estaba interfiriendo visualmente con la franja **"Todo chill"**.
- Añade una **Bocchi de fondo interna** en la tarjeta de recomendación, ubicada al **lado derecho**.
- Mueve una de las Bocchis flotantes globales hacia la derecha para que no vuelva a chocar con esa zona.
- Mantiene intacta la recomendación dinámica, el estado visual y el resto del monitor.

## Archivos incluidos
- `web/src/App.jsx`
- `web/src/styles.css`

## Cómo aplicar
Reemplaza esos 2 archivos en tu proyecto actual por los de este parche.

## Resultado esperado
- La sección **Todo chill** queda limpia a la izquierda.
- La decoración Bocchi sigue existiendo, pero ahora acompaña desde la **parte derecha** sin tapar texto.
- En móvil, la decoración interna se oculta para no recargar la UI.
