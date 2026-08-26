# Parche Bocchi Media

## Incluye
- Boton Bocchi para musica: quieta cuando esta apagada y GIF animado cuando esta reproduciendo.
- Fondo amarillo retirado del GIF del boton musical.
- 10 canciones aleatorias en `web/public/audio/bgm/`.
- Volumen predeterminado: 10%.
- Al terminar una cancion, se elige automaticamente otra al azar evitando repetir inmediatamente la misma.
- Segundo clic sobre Bocchi detiene la musica y vuelve a la imagen quieta.
- GIF de panico para recomendaciones criticas.
- GIF decorativo y 6 imagenes Bocchi reducidas en la barra lateral.
- Las decoraciones desaparecen en pantallas angostas para no quitar espacio a los cursos.

## Como aplicar
1. Deten Vite con `Ctrl+C` si esta ejecutandose.
2. Extrae este ZIP directamente sobre `C:\Proyectos\uni-bocchi-monitor`.
3. Cuando Windows pregunte, elige **Reemplazar los archivos en el destino**.
4. Abre VS Code en `C:\Proyectos\uni-bocchi-monitor`.
5. Terminal:
   ```powershell
   cd web
   npm run dev
   ```
6. Abre `http://localhost:5173/` y haz `Ctrl+F5` si el navegador conserva la version anterior.

No es necesario recargar la extension porque este parche solo cambia la web y sus assets.

## Musica
Los navegadores bloquean la reproduccion automatica con audio. Por eso la musica comienza unicamente cuando haces clic en la Bocchi musical.
