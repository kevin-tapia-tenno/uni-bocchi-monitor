# PARCHE v1.4 · auto refresh + Bocchi dinámica + fondos transparentes

## Qué cambia

1. **Se elimina el botón "Actualizar"**
   - El monitor se sigue refrescando solo en segundo plano.
   - Si el usuario presiona **F5** o recarga la página, se vuelve a cargar todo normalmente.

2. **Las Bocchis decorativas ahora van como fondo**
   - Ya no quedan solo en espacios vacíos laterales.
   - Se muestran como stickers suaves detrás del contenido, sin tapar la información.
   - En móvil se ocultan para no saturar la vista.

3. **La Bocchi de recomendaciones ahora cambia según el estado**
   - `idle`: esperando cursos.
   - `good`: todo tranquilo.
   - `half`: una sección ya va por la mitad.
   - `warning`: se está moviendo.
   - `danger`: está a punto de llenarse.
   - `full`: ya se llenó, F.

4. **Mensajes de recomendación más útiles**
   - Ejemplos:
     - “X sección Y está por llenarse…”
     - “X sección Y ya se llenó. F…”
     - “X sección Y ya pasó casi la mitad…”

---

## Archivos incluidos

Reemplaza estos archivos en tu proyecto:

- `web/src/App.jsx`
- `web/src/lib/vacancy.js`
- `web/src/styles.css`

Y agrega esta carpeta nueva:

- `web/public/assets/bocchi/status/`

---

## Recomendación

Este parche está pensado para aplicarse **encima de tu versión v1.3**.
