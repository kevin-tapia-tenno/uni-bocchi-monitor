# PARCHE v1.6.3 · quitar Bocchi flotante izquierda en “Todo chill”

## Qué corrige
- Se elimina **solo** la Bocchi flotante decorativa que aparece por la **izquierda** y que se mete detrás de la franja **“Todo chill”**.
- Se **conserva** la Bocchi decorativa de la **derecha** dentro de la tarjeta.
- Se mantiene intacta la Bocchi principal de la recomendación.

## Archivo modificado
- `web/src/styles.css`

## Cambio aplicado
Se añadió este override:

```css
.bocchi-float-2 {
  display: none !important;
}
```

## Cómo aplicar
1. Abre tu proyecto.
2. Reemplaza `web/src/styles.css` por el de este parche.
3. Guarda los cambios.
4. Vuelve a desplegar si usas Vercel.
5. Recarga con `Ctrl + F5`.
