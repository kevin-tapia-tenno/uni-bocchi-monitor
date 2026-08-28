# PARCHE v1.6.2 · quitar Bocchi de fondo en "Todo chill"

## Qué corrige
- Se eliminó la Bocchi decorativa de fondo dentro de la tarjeta **"Todo chill"**.
- Se mantiene intacta la Bocchi principal de la recomendación.
- No se cambió ninguna otra funcionalidad del monitor.

## Archivo modificado
- `web/src/App.jsx`

## Cambio aplicado
Se quitó este bloque de la sección de recomendación:

```jsx
<div className="bocchi-tip-bg" aria-hidden="true">
  <img src="/assets/bocchi/floating/float-11.png" alt="" />
</div>
```

## Cómo aplicar
1. Abre tu proyecto base.
2. Reemplaza `web/src/App.jsx` por el de este parche.
3. Guarda los cambios.
4. Si usas Vercel, sube/deploya nuevamente.
5. Recarga la web con `Ctrl + F5`.
