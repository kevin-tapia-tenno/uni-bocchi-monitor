# Parche v1.3 — Sonidos aleatorios Bocchi

Se añadieron siete audios a `web/public/audio/ui/`.

La función `playRandomUiSound()` selecciona un clip aleatorio sin repetir inmediatamente el último. Se usa en:

- Botón **Actualizar**.
- Bocchi principal del título/lateral superior izquierdo.

La opción **Efectos** controla estos sonidos. El volumen comparte el valor configurado en Preferencias Bocchi.

Para evitar solapamientos, cada nuevo clic detiene el clip de interfaz anterior. Además se aplica un máximo de 4.5 s por reproducción, ya que uno de los archivos originales dura aproximadamente 30.8 s.
