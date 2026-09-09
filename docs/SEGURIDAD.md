# Seguridad — decisiones y por qué

Registro de las decisiones de seguridad tomadas a medida que se
construye la plataforma, y la razón detrás de cada una. Pensado para
quedar como respaldo de que esto se hizo con criterio, no
improvisado.

## Principios que se siguen desde la Fase 1

- **Nunca se guardan datos de tarjetas.** Los pagos los procesa Stripe
  directamente; nuestro servidor nunca ve ni almacena el número de
  tarjeta completo (así se evita tener que cumplir PCI-DSS nosotros
  mismos — lo cumple Stripe).
- **Ningún secreto vive en el código.** Llaves de API (Stripe, el
  proveedor de datos, Vimeo) se guardan como variables de entorno, nunca
  escritas directamente en los archivos del proyecto. Ver `.env.example`
  para la lista de qué variables va a necesitar el proyecto — ese
  archivo no lleva valores reales, solo los nombres.
- **HTTPS en todo momento.** El dominio se sirve siempre bajo HTTPS
  (esto es automático en el hosting recomendado y reforzado si el DNS
  pasa por Cloudflare).
- **El servidor decide quién ve qué, no el navegador.** El acceso al
  universo S&P 500/Nasdaq y a las clases se revisa en el servidor contra
  el estado real de la suscripción en cada solicitud — nunca basta con
  que el navegador "diga" que el usuario pagó.
- **Autenticación con proveedor especializado.** En vez de programar
  desde cero el guardado de contraseñas, se va a usar un proveedor de
  autenticación ya probado (a definir en la Fase 1 avanzada — candidatos:
  Auth.js/NextAuth o Clerk) para reducir el riesgo de errores en algo tan
  sensible como el manejo de credenciales.

## Pendiente de definir junto con el usuario

- Política de retención de datos (cuánto tiempo se guarda el historial
  de un usuario que cancela).
- Si se necesita 2FA para las cuentas de administrador de la plataforma.
- Responsable(s) que van a tener acceso al panel de Stripe y al
  proveedor de datos.
