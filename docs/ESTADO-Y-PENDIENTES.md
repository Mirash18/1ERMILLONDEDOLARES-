# Estado del proyecto y pendientes — actualizado 21 sept. 2026

Documento de traspaso: dónde está el proyecto hoy, qué falta, y las
trampas que ya se pisaron (para no volver a pisarlas). Si estás
retomando desde otro computador o después de un tiempo, **lee esto
primero** y después `docs/ARQUITECTURA.md` para el detalle técnico de
cada decisión.

---

## 1. Qué es el proyecto

**1er Millón de Dólares** — plataforma de educación en trading: gráficos
en vivo, herramientas de análisis, y (a futuro) clases en vivo del
profesor Miguel Cortés.

| | |
|---|---|
| Repo | `github.com/Mirash18/1ERMILLONDEDOLARES-` (rama `main`) |
| Sitio en vivo | https://1-ermillondedolares-in8t.vercel.app |
| Proyecto en Vercel | `mirash18/1-ermillondedolares-in8t` (plan Hobby) |
| Dominio | `1ermillondedolares.com` — **conectado el 26 sept. 2026**. Comprado en **Cloudflare** (registrado el 8 sept. 2026, vence el **8 sept. 2027**). DNS en Cloudflare: dos CNAME (`@` y `www`) → Vercel, en **DNS only** (nube gris; con la nube naranja Cloudflare se mete en medio y choca con el certificado de Vercel). La principal es `https://www.1ermillondedolares.com`; la raíz redirige (308) a www. |
| Stack | Next.js 16 (App Router) + TypeScript + Tailwind v4 |
| Carpeta local | `C:\Users\Alejo\Desktop\cloude` |

### Fases del proyecto

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Estructura base, marca, documentación | Completa |
| 2 | Motor de gráficos en tiempo real (SPY/META/GLD) | Completa |
| 3 | Pagos + nivel $25/mes | En construcción — login con Clerk listo, falta la pasarela |
| 4 | Clases en vivo vía Vimeo | Pendiente |
| 5 | Herramientas de estudio (calculadora + indicadores) | Pendiente |
| 6 | Biblioteca de clases grabadas | Pendiente |

---

## 2. Servicios conectados

| Servicio | Para qué | Dónde viven las llaves |
|---|---|---|
| **Twelve Data** | Velas y cotizaciones | Solo en Vercel (`TWELVEDATA_API_KEY`) |
| **Upstash Redis** (`candle-cache`) | Caché de mercado + watchlist + testimonios | Solo en Vercel (`REDIS_KV_REST_API_URL` / `_TOKEN`) |
| **Vercel Blob** (`millon-blob-public`) | Imágenes/videos de testimonios | Solo en Vercel (`BLOB_PUBLIC_READ_WRITE_TOKEN`) |
| **Clerk** | Login / cuentas | En Vercel **y** en `.env.local` |

**Importante — el entorno local NO tiene** las llaves de Twelve Data,
Redis ni Blob. Es a propósito. Consecuencias al trabajar en local:

- El gráfico muestra *"Sin datos por ahora (TWELVEDATA_API_KEY no
  configurada en el servidor)"* — es lo esperado, no está roto.
- No se puede probar subir un testimonio en local. **Eso solo se puede
  verificar en producción.**
- Todo lo visual (colores, layout, logo, animaciones) sí se puede probar
  perfecto en local con `npm run dev`.

**Créditos de Twelve Data**: plan gratis, 800 créditos/día. Ya se
agotaron una vez (15 sept.) y por eso existe la caché en Redis y el
refresco cada 5 minutos en vez de cada minuto. **No hacer pruebas
repetidas recargando el gráfico** sin necesidad.

---

## 3. Cómo se trabaja en este proyecto (convenciones ya establecidas)

Esto no está en el código, pero es como se ha venido trabajando y vale
la pena mantenerlo:

1. **Antes de implementar algo grande, se acuerda el plan.** Alejo
   prefiere ir paso a paso, ver, confirmar, y después seguir.
2. **Verificar antes de decir que está listo**: `npx tsc --noEmit`,
   `npm run build`, y cuando el cambio es visual, levantar el dev server
   y mirarlo de verdad en el navegador.
3. **Revertir los artefactos de build antes de comitear**:
   `git checkout -- next-env.d.ts tsconfig.tsbuildinfo`
4. **Mensajes de commit largos y explicativos**, en español, contando el
   *porqué* y no solo el *qué* — sobre todo cuando se arregla un bug
   real, explicando la causa raíz.
5. **`docs/ARQUITECTURA.md` se actualiza en cada tanda**, con una sección
   fechada. Es el registro vivo del proyecto y la razón por la que se
   puede retomar meses después sin perderse.
6. **Después de cada push, revisar que Vercel haya desplegado** (ver
   trampa #1 más abajo).
7. **No inventar datos.** Si no hay testimonios reales, la sección no se
   muestra — no se rellena con ejemplos falsos. Mismo criterio que se usó
   con los fondos por día en el gráfico.

### Cómo se hace push

El repo usa un helper de credenciales:
```powershell
$env:GIT_ASKPASS = "C:\Users\Alejo\.claude-git-askpass.bat"; git push origin main
```
(El `.bat` lee el token desde `C:\Users\Alejo\.gh_pat.txt`.) Al hacer
push aparece un mensaje `fatal: Cannot prompt because user interactivity
has been disabled` **pero el push sí funciona** — verificar siempre la
línea de abajo que dice `main -> main`.

---

## 4. Lo que se hizo en la última tanda (19–21 sept. 2026)

### Sala de Trading — herramientas de dibujo
- **Tendencia, Regla y Regresión** pasaron a usar *posición lógica*
  (índice de barra) en vez de tiempo absoluto. Esto es lo que permite
  colocar un dibujo en el espacio en blanco después de la última vela —
  antes era imposible por un límite de `lightweight-charts`.
- Las líneas ya trazadas se pueden **volver a agarrar de sus puntas y
  mover** (antes había que borrarlas y repetir).
- **Regla**: flechita central que indica sube/baja, y verde/rojo un poco
  más oscuros.
- **Cuadro de texto libre**: se coloca con un clic, se mueve, se
  redimensiona, se escribe dentro, se centra el texto y se agranda o
  achica la letra. Es un `<div>` superpuesto, no canvas (hace falta
  contenido editable de verdad).

### Homepage — arranque del rediseño visual
- **Logo real** (oso + toro dorado) en el header. Los archivos son
  `public/logo.png` (completo) y `public/logo-icon.png` (solo el
  emblema, recortado por código).
- **Fondo nuevo del hero**: degradado azul marino → verde oliva con
  puntos sutiles. Vive en la clase `.hero-brand-bg` de `globals.css`,
  **separada de los tokens `--bg`/`--gold`** para no tocar la Sala de
  Trading ni el resto del sitio.
- **Botón CTA** "Empezar en la academia" → `/introduccion`.
- Decisión de color: Alejo eligió **azul + verde oliva** a propósito,
  aunque el logo es dorado — el logo queda como pieza dorada destacada
  sobre un fondo que no comparte sus colores.

### Repositorio de testimonios (funcionando, verificado en producción)
- `/admin/testimonios` — página protegida donde se sube imagen o video +
  nombre + testimonio corto.
- Carrusel en el homepage: dos filas que se deslizan en direcciones
  opuestas, tarjetas color crema, se pausa al pasar el mouse. Si no hay
  testimonios, la sección no aparece.
- Los archivos van a Vercel Blob; el texto va a Redis.
- **Confirmado funcionando de punta a punta el 21 de sept.**

---

## 5. Pendientes — en orden de prioridad

### A. Rápido, pendiente de Alejo (no requiere programar)
1. **Borrar el Blob store viejo y privado.** Quedó sin uso y vacío (0
   bytes). Vercel → Storage → `1-ermillondedolares-in8t-blob` → Settings
   → Delete Store. Hay que escribir el nombre del store y el texto
   `delete my blob` para confirmar. *(Claude no puede hacerlo: el
   clasificador de permisos bloquea borrados de almacenamiento en la
   nube.)*

### B. Seguir el rediseño visual del homepage (es donde íbamos)
Inspirado en el video de referencia del seminario "Creando Riqueza" que
mandó Alejo. Faltan estas secciones:
2. **"Con tu inscripción recibirás"** — lista con iconitos (acceso a
   transmisiones en vivo, acceso a grabaciones, etc.). En la referencia
   iba sobre un fondo verde degradado con el patrón de red.
3. **"¿Qué aprenderás?"** — foto o video a un lado, texto al otro, sobre
   fondo claro.
4. **"Ganancias semanales de nuestros alumnos"** — carrusel similar al de
   testimonios. Alejo dijo que le gustó mucho ese efecto en la
   referencia. Mismo criterio: vacío hasta tener datos reales.
5. Revisar el header en pantallas angostas — los enlaces de navegación se
   amontonan en móvil (problema que ya existía antes, no urgente).

### C. Funcionalidad de la Sala de Trading
6. **Duda sin resolver sobre la Regla**: Alejo preguntó si debería
   funcionar con clic-mantener-arrastrar (como está ahora) o
   clic → mover → clic (dos clics separados, sin mantener presionado).
   Quedó en mandar un video de ejemplo y nunca llegó. **Preguntarle
   antes de cambiar nada.**
7. **Alertas de precio** y **órdenes simuladas de compra/venta** —
   estaban en la lista original de comparación con TradingView, Alejo
   acordó dejarlas para una conversación aparte. Siguen pendientes.

### D. Cosas del negocio / infraestructura
8. ~~Clerk con llaves de desarrollo~~ — **hecho el 26 sept. 2026**:
   instancia de producción clonada de desarrollo, dominio
   `1ermillondedolares.com` verificado (5 CNAME de Clerk en Cloudflare,
   DNS only, agregados con "Configure automatically"), Google con
   credenciales propias (proyecto "1er Millon de Dolares" en Google Cloud,
   app **publicada "En producción"**, sin logo para no disparar revisión;
   exige la política en `/privacidad`), llaves `pk_live_`/`sk_live_` en
   Vercel y `ADMIN_EMAILS = alejo012g@gmail.com,micorte8@gmail.com`. Las
   cuentas de desarrollo NO pasaron a producción: todos se registran de
   nuevo y los accesos manuales hay que volver a darlos.
   Correo de contacto: `contacto@1ermillondedolares.com` → Gmail de Alejo
   (Cloudflare Email Routing, gratis; solo recibe).
   Texto viejo del pendiente, para contexto: **Clerk sigue con llaves de desarrollo en producción.** La consola del
   navegador muestra: *"Clerk has been loaded with development keys.
   Development instances have strict usage limits and should not be used
   when deploying your application to production."* Hay que crear una
   instancia de producción en Clerk antes de abrirle el sitio a gente
   real.
9. ~~Conectar el dominio `1ermillondedolares.com`~~ — **hecho el 26 sept.
   2026** (ver la tabla de arriba).
10. **Pasarela de pago** (Fase 3). En `ARQUITECTURA.md` quedó documentado
    que se descartó Stripe y se eligió MercadoPago, pero el paquete de
    Stripe sigue instalado y hay rutas de Stripe en el código
    (`/api/checkout`, `/api/webhooks/stripe`). **Hay que decidir y
    limpiar.**
11. Decisiones de fondo que siguen abiertas (ver "Decisiones pendientes"
    en `ARQUITECTURA.md`): proveedor definitivo de datos de mercado, plan
    de Vimeo, y si se suma un método de pago local (PSE/Nequi).

---

## 6. Trampas conocidas (ya se pisaron, no repetir)

**1. Vercel a veces no detecta el push.** Pasó dos veces. Si el
despliegue no aparece solo, existe un Deploy Hook guardado:
```powershell
Invoke-RestMethod -Method POST -Uri "https://api.vercel.com/v1/integrations/deploy/prj_0isZfwtp5K63BflkhcBL9kqdRVcB/FXKw0f5JSS"
```
Ojo: un despliegue creado por Deploy Hook puede quedar como **"Staged"**
en vez de producción — hay que entrar al despliegue y darle "···" →
**Promote** a mano.

**2. Las Serverless Functions de Vercel rechazan peticiones de más de
~4.5 MB.** Es un límite de la plataforma, no de configuración. Por eso
los archivos de testimonios se suben **directo del navegador a Blob**
sin pasar por el servidor. Si alguna vez hay que subir archivos en otra
parte del sitio, usar el mismo patrón.

**3. Los Blob stores se crean en modo "Private" por defecto** (Vercel lo
marca como "Recommended") y **ese modo no se puede cambiar después**. Un
store privado nunca sirve archivos públicos, sin importar lo que pida el
código — falla con un error de CORS confuso. El store actual
(`millon-blob-public`) sí está en modo Public. **Revisar la opción de
Access con cuidado al crear cualquier recurso nuevo de Storage.**

**4. Una página que lee datos del servidor puede quedarse estática para
siempre.** El homepage lee los testimonios desde Redis; como no depende
de cookies ni headers, Next.js la dejaba prerenderizada en el build y un
testimonio nuevo nunca habría aparecido sin un redeploy. Se arregló con
`export const revalidate = 60;` en `page.tsx`. Si se agrega otra página
que lea datos que cambian, **acordarse de esto**.

**5. `ffmpeg` no está instalado** en el PC. Para analizar los videos que
manda Alejo se usa Python con OpenCV (`cv2.VideoCapture`), extrayendo
fotogramas cada X segundos a una carpeta temporal. Funciona bien.

**7. Llaves de Clerk a medias = "inicio sesión pero la página no me
reconoce".** El 26 sept. 2026 se cambió `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
a `pk_live_` pero `CLERK_SECRET_KEY` seguía `sk_test_` (al buscar "SECRET"
en Vercel, la llave se pegó por error en `STRIPE_WEBHOOK_SECRET`). Síntoma:
arriba sale el avatar (el navegador sí inició sesión) pero el servidor te
trata como visitante y /admin no deja entrar. Diagnóstico seguro: F12 →
Network → la primera petición → Response Headers → `x-clerk-auth-reason:
jwk-kid-mismatch`. Arreglo: poner la `sk_live_` en `CLERK_SECRET_KEY`
(revisar que la fila diga "Updated" hoy) y Redeploy.

**6. El input de archivo no se puede llenar por automatización.** Si hay
que probar una subida, Alejo tiene que seleccionar el archivo a mano —
el selector del sistema operativo está fuera del alcance del navegador
automatizado.

---

## 7. Archivos clave

| Archivo | Qué tiene |
|---|---|
| `docs/ARQUITECTURA.md` | **El registro vivo completo.** Cada decisión, cada bug real, fechados. Es largo pero es la memoria del proyecto. |
| `src/components/CandleChart.tsx` | El gráfico entero y todas las herramientas de dibujo. Es el archivo más grande del proyecto. |
| `src/app/page.tsx` | Homepage (hero + tickers + gráfico + testimonios + "Lo que viene"). |
| `src/app/globals.css` | Tokens de color de marca + `.hero-brand-bg` + animaciones del carrusel. |
| `src/lib/testimonials.ts` | Guardado de testimonios en Redis. |
| `src/app/api/admin/testimonials/upload/route.ts` | Subida directa a Blob (con el comentario que explica el porqué). |
| `src/lib/admin.ts` | Quién es admin (`ADMIN_EMAILS`). |
