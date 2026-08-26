# Parche v1.5

## Cambios principales

### 1. Sin tarjeta “Actualización”
El HUD queda con:
- Estado
- Cursos aperturados
- Datos

El refresco interno sigue funcionando silenciosamente.

### 2. Bocchis de fondo más visibles
La opacidad pasa a ser mayor en escritorio. Siguen detrás de las tarjetas y no bloquean clics.

### 3. Recomendación aleatoria al cargar
En cada carga completa/F5, Bocchi elige al azar:
- un curso completo, o
- una sección de un curso.

Ese objetivo se mantiene durante las actualizaciones automáticas de esa sesión de página.

### 4. Botón Bocchi por curso y sección
- Botón en la cabecera del curso: analiza el curso completo.
- Botón dentro de cada sección: analiza esa sección.
- El objetivo activo queda resaltado.

### 5. Estados de recomendación
La imagen y texto cambian entre:
- Todo chill
- Va por la mitad
- Se está moviendo
- A punto de llenarse
- Ya se llenó F

### 6. Ajuste técnico adicional
Se corrigió el arranque del puente para evitar que un cambio de datos vuelva a disparar una sincronización inmediata fuera del temporizador normal.
