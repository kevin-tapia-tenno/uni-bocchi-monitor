# UNI Bocchi Monitor · v1.10

## Qué cambia

### 1. Actualización manual más clara
El botón principal ahora tiene un acabado rosado oscuro, icono separado y una pequeña indicación de que es una actualización manual de la vista filtrada.

### 2. Reintento individual
Cuando un curso queda como **Pendiente de consulta**, **Reintento pendiente** o **Sin dato**, aparece un pequeño botón **↻** en el encabezado del curso.

Al pulsarlo:
- se consulta únicamente ese código de curso;
- no se vuelven a consultar los otros 138 cursos;
- el icono gira mientras trabaja;
- si la UNI devuelve secciones/vacantes, el dato se actualiza y el botón desaparece;
- si sigue sin responder, el botón queda disponible para otro reintento.

## Instalación

1. Cierra el servidor local si lo tienes ejecutándose (Ctrl+C en la terminal).
2. Copia `web/` de este parche sobre `C:\Proyectos\uni-bocchi-monitor\web\`.
3. Windows preguntará si deseas reemplazar archivos: elige **Reemplazar los archivos en el destino**.
4. Este parche no modifica `extension/`; no hace falta recargar UNI Bocchi Bridge.
5. En VS Code:

```powershell
cd C:\Proyectos\uni-bocchi-monitor\web
npm run dev
```

6. Abre tu localhost y presiona **Ctrl+F5**.
7. Entra a **Todos los cursos**.
8. Busca un curso que muestre `Reintento pendiente` y pulsa solamente su botón ↻.
9. Confirma que el mensaje superior indique `Reintentando solo CODIGO…` y que no se inicie una consulta global.

## Publicar

```powershell
cd C:\Proyectos\uni-bocchi-monitor
git add .
git commit -m "Refresh individual por curso v1.10"
git push
```

Vercel debería desplegar el cambio automáticamente.


## Estado más claro
Al terminar una ronda, el monitor ahora distingue **intentados**, **con datos** y **pendientes**. Así un `139/139 intentados` no se confunde con que los 139 hayan devuelto vacantes.
