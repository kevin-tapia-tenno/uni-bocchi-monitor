# UNI Bocchi Monitor v1.6 — Turno + Plan de matrícula

## Mejoras incluidas

### 1. Mi turno de matrícula
La extensión abre/lee localmente la página oficial `/matricula` y trata de detectar automáticamente:

- código del grupo (ej. `8091`),
- nombre del grupo (ej. `GRUPO 5`),
- inicio del turno,
- fin del turno.

La web muestra una cuenta regresiva sin realizar consultas repetidas al servidor.

### 2. Alertas del turno
Con **Activar alertas**:

- aviso aproximadamente 10 minutos antes,
- sonido/notificación cuando inicia el turno,
- el título de la pestaña cambia cuando el turno ya empezó.

Las alertas dependen de que la web permanezca abierta; el navegador puede limitar temporizadores si suspende completamente la pestaña/equipo.

### 3. Botón “Abrir Matrícula”
Abre exclusivamente la página oficial de matrícula. No envía ninguna solicitud para matricular cursos y no intenta evitar restricciones del servidor.

### 4. Plan de matrícula
Se añadió **Vigilar** a:

- un curso completo, o
- una sección específica.

Los objetivos quedan guardados en `localStorage`, por lo que permanecen después de F5.

### 5. Alertas de vacantes prioritarias
Para objetivos vigilados:

- avisa si una sección llena vuelve a tener una vacante,
- avisa si baja a 5 vacantes o menos,
- avisa si se llena.

También se conserva un pequeño historial en pantalla durante la sesión.

### 6. Recomendación Bocchi
Se mantiene toda la lógica v1.5:

- recomendación aleatoria al hacer F5,
- análisis manual de curso/sección,
- estados Todo chill / mitad / movido / peligro / lleno.

## Extensión v1.1.0
Este parche actualiza `UNI Bocchi Bridge` porque ahora necesita leer también el horario del turno.

No se solicitan credenciales nuevas ni se envían tokens a Vercel. La lectura sigue realizándose dentro del navegador del alumno.

## Si el turno no se detecta
1. Abre `https://matricula-alumno.uni.edu.pe/matricula`.
2. Confirma que se vea “Grupo de matrícula”.
3. Recarga esa pestaña.
4. Regresa al monitor y pulsa **Releer turno**.

Si todavía falla, envía una captura de esa pantalla y se ajusta el parser a la estructura exacta que esté usando la UNI.
