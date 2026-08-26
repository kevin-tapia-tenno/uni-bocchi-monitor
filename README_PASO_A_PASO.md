# Cómo aplicar el parche v1.4

1. Abre tu proyecto del monitor.
2. Copia `web/src/App.jsx` y reemplaza el archivo actual.
3. Copia `web/src/lib/vacancy.js` y reemplaza el archivo actual.
4. Copia `web/src/styles.css` y reemplaza el archivo actual.
5. Copia la carpeta `web/public/assets/bocchi/status/` dentro de tu proyecto.
6. Guarda todo.
7. Ejecuta el proyecto:

```bash
npm install
npm run dev
```

Si ya tenías dependencias instaladas, normalmente basta con:

```bash
npm run dev
```

## Qué debes verificar

- Que ya **no aparezca** el botón `Actualizar`.
- Que el monitor siga refrescando solo.
- Que la tarjeta `Bocchi recomienda` cambie de imagen según el estado.
- Que las Bocchis decorativas salgan como fondo tenue.
- Que en móvil no tapen la información.
