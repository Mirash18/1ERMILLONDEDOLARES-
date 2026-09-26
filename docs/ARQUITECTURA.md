# Arquitectura — 1er Millón de Dólares

Registro técnico vivo de cómo funciona la plataforma por dentro: qué se
construyó, por qué se tomó cada decisión, y qué depende de qué. Se
actualiza en cada fase — no es un documento que se escribe una vez y se
olvida.

> **¿Retomando el proyecto?** Empieza por
> [`ESTADO-Y-PENDIENTES.md`](./ESTADO-Y-PENDIENTES.md): resume dónde está
> todo hoy, qué falta, y las trampas ya conocidas. Este documento es el
> detalle técnico de fondo.

## Estado actual

**Dominio:** `1ermillondedolares.com` (comprado).

**Fase 2 — Motor de gráficos en tiempo real.** Completa y desplegada.

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Estructura base, marca, documentación | Completa |
| 2 | Motor de gráficos en tiempo real (SPY/META/GLD) | Completa |
| 3 | Pagos (Stripe) + nivel $25/mes | En construcción — login con Clerk listo, falta Stripe |
| 4 | Clases en vivo vía Vimeo | Pendiente |
| 5 | Herramientas de estudio (calculadora + indicadores) | Pendiente |
| 6 | Biblioteca de clases grabadas | Pendiente |

## Stack elegido y por qué

- **Next.js (App Router) + TypeScript.** Permite renderizar el sitio
  público (rápido, bueno para SEO) y además correr lógica de servidor
  (rutas `/api/...`) en el mismo proyecto — ahí van a vivir los webhooks
  de Stripe y las verificaciones de acceso, sin exponer llaves secretas
  al navegador.
- **Tailwind CSS v4** para estilos, usando los tokens de marca definidos
  en `src/app/globals.css` (dorado/negro, con variante clara).
- **Tipografías:** Fraunces (títulos), IBM Plex Sans (texto), IBM Plex
  Mono (tickers, cifras, etiquetas técnicas) — cargadas vía
  `next/font/google`, auto-hospedadas por Next.js (no dependen de un
  CDN externo en producción).

## Marca y tokens

Los colores viven como variables CSS en `src/app/globals.css`, no
repartidos como valores sueltos por el código. Vienen del organigrama
de ideas que ya habíamos definido:

- Fondo `#0B0E14`, panel `#131722`, borde `#2A2E39`
- Dorado `#D4AF37` (acento principal), texto `#E0E0E0`
- Verde `#089981` / rojo `#F23645` (para señales alcistas/bajistas)

Hay una variante clara equivalente para quien prefiera tema claro en su
navegador — mismo criterio de contraste, ver el bloque
`@media (prefers-color-scheme: light)`.

## Cómo va a fluir el acceso pagado (Fase 3, en construcción)

**Decisión de septiembre de 2026: sin base de datos propia.** Se evaluó
montar Postgres para guardar usuarios y estado de suscripción, y se
descartó: es la pieza más lenta de montar, hay que mantenerla, respaldarla
y es un servicio más que se puede caer. En su lugar:

- **Clerk** guarda *quién eres* — registro, login, contraseña, entrar con
  Google, recuperación. Su plan gratuito cubre 50.000 usuarios activos al
  mes, muy por encima de los ~1.000 de la comunidad.
- **Stripe** guarda *si estás al día* — cobros, renovaciones, bajas, y el
  historial completo.
- El estado de suscripción vive en los **metadatos del usuario de Clerk**,
  que hacen de base de datos mínima sin serlo.

El flujo queda así:

1. El usuario se registra con Clerk y se suscribe → Stripe cobra los $25/mes.
2. Stripe notifica al servidor por webhook (`/api/webhooks/stripe`) cuando el
   pago se confirma, falla o se cancela.
3. Ese webhook escribe `suscripcion: "activa"` (o la quita) en los metadatos
   del usuario en Clerk.
4. Cada vez que el navegador pide algo de pago, el servidor revisa ese estado
   **antes** de servir el dato — nunca se confía en lo que diga el navegador
   sobre si el usuario pagó o no.
5. El mismo estado se usa para dar o quitar acceso a las clases en Vimeo
   (Fase 4).

Toda esa decisión está centralizada en `src/lib/subscription.ts`. Es la única
pieza que dice si alguien puede pasar, y **falla hacia el lado seguro**: si
las llaves no están configuradas, o desaparecen, o se escriben mal, responde
`sin-configurar` y no deja entrar a nadie, en vez de abrirse por defecto.

La página de la membresía está en `/suscripcion`. Mientras no haya llaves, el
botón sale desactivado. A propósito, esa página separa **"Disponible ahora"**
de **"En camino"** con las fases escritas: no se le cobra a nadie por algo que
todavía no puede usar.

**Llaves que hay que poner en Vercel** (las pega Alejo, nunca viajan por el
chat): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_ID`.
El código de Clerk **no se integra hasta que estén puestas**: si se sube
antes, la compilación falla y se cae el sitio que ya está en producción.

## Herramientas de dibujo (decisión de septiembre de 2026)

Alejo pidió las herramientas de dibujo que tiene en ProRealTime — líneas de
tendencia, horizontales, canales, texto, rectángulos, flechas.
`lightweight-charts` **no las trae y no se le pueden añadir**: es la versión
ligera de TradingView, pensada solo para pintar series. Construirlas a mano
sería semanas de trabajo y quedarían peor.

La vía elegida es **TradingView Advanced Charts**: trae 80+ herramientas de
dibujo y 100+ indicadores, y se conecta a nuestra API de velas mediante un
adaptador UDF. Como regalo, resuelve de paso que la comunidad vea la misma
interfaz que ya conoce. Se solicitó a `platforms@tradingview.com`.

**Corrección (15 sept. 2026):** no es gratuita para este caso. TradingView
respondió (Alvaro M. Roo, Customer Success Manager) que, al ser un uso con
**suscripción de pago**, se necesita **licencia comercial** — la variante
gratuita (con su logo visible) es solo para uso no comercial. Antes de
hablar de precio piden firmar un **MNDA** (acuerdo de confidencialidad) con
los datos de la empresa: nombre legal, dirección, sitio web, correo de
notificaciones, y nombre + cargo de quien firma. Pendiente de que Alejo
confirme si hay una entidad legal constituida para el proyecto — sin eso no
se puede firmar el MNDA ni seguir con la cotización de la licencia.

**Respuesta de TradingView (17 sept. 2026, Álvaro M. Roo):** confirmado —
necesitan *"a valid registered company name (not individual nor
sole-founder ventures)"* antes de seguir con el MNDA. Y la estructura
comercial es una **tarifa fija anual**, sin importar número de usuarios ni
uso — no hay un plan que escale con el tamaño del proyecto. Con esto:

- **Queda en pausa** hasta que exista una empresa constituida — no es algo
  que se pueda resolver solo con más conversación con TradingView.
- No se sabe todavía el monto de esa tarifa anual — si en algún momento
  interesa saberlo (para decidir si vale la pena incorporar una empresa),
  hay que volver a escribirles.
- **Mientras tanto, `lightweight-charts` (lo que ya está construido) sigue
  siendo la solución** — ya tiene velas, PM 20/40/100/200, Bollinger,
  volumen, zoom inteligente, pantalla completa y watchlist. El proyecto no
  se queda sin gráfico por esto, solo sin las herramientas de dibujo
  (líneas de tendencia, canales, etc.) que solo trae TradingView.

## Datos de mercado (Fase 2 — completa)

- **Proveedor elegido: Twelve Data.** Por ahora se está usando una
  clave del plan gratuito, solo para desarrollar y probar.
- **Importante — licencia:** Twelve Data marca su plan gratuito como
  *"internal non-display usage"*: sirve para programar y probar, pero
  su licencia no autoriza mostrar esos datos a visitantes reales de la
  página. Antes de lanzar al público hay que subir a un plan de pago
  que sí incluya derecho de uso público/redistribución — confirmar el
  plan exacto con Twelve Data antes de anunciar la página públicamente.
- Implementado: `src/lib/marketData.ts` (llama a la API de Twelve Data
  desde el servidor, la llave nunca llega al navegador),
  `src/app/api/quotes/route.ts` (cotizaciones de SPY/META/GLD para la
  tira de precios) y `src/app/api/candles/route.ts` (velas diarias +
  medias móviles para el gráfico). Las cotizaciones se cachean 30
  segundos y las velas 5 minutos en servidor, para no agotar el límite
  del plan gratuito (8 créditos/minuto, 800/día).
- El universo pagado (S&P 500, Nasdaq) se conecta de la misma forma en
  la Fase 3, protegido por la verificación de suscripción.
- **Gráfico de velas en vivo:** construido con `lightweight-charts`
  (la librería open-source de TradingView) en `src/components/CandleChart.tsx`.
  Muestra velas japonesas reales con selector de símbolo (SPY/META/GLD)
  y las cuatro medias móviles simples que se usan en la comunidad — MA20
  (amarilla), MA40 (roja), MA100 (verde), MA200 (morada) — calculadas en
  servidor en `simpleMovingAverage()` dentro de `marketData.ts`.
  Desplegado y verificado en producción con datos reales.
- **Personalización del gráfico (pulido de Fase 2, sept. 2026):**
  - Selector de marco temporal: Hora / Día / Semana / Mes, mapeado a los
    intervalos de Twelve Data (`1h`, `1day`, `1week`, `1month`) —
    validado en `src/app/api/candles/route.ts` contra una lista blanca.
  - Sin líneas de cuadrícula — solo las velas, más limpio.
  - Marca de agua transparente con el símbolo activo (usa el `watermark`
    nativo de `lightweight-charts`), para que siempre sea obvio qué
    acción se está mirando aunque no se vea la barra de símbolos.
  - Volumen (histograma) con botón para mostrarlo u ocultarlo, en el
    mismo panel debajo de las velas.
  - Bandas de Bollinger (20 periodos, 2 desviaciones estándar) con
    botón para mostrarlas u ocultarlas — cálculo de referencia en
    `bollingerBands()` dentro de `marketData.ts`, pendiente de revisar
    contra el código que va a compartir Alejo/Miguel Cortés para
    confirmar que coincide con el que usan en la comunidad.
  - Tema del gráfico (fondo claro/oscuro) independiente del tema del
    sitio — el usuario lo cambia con un botón y queda solo en ese
    componente, sin afectar el resto de la página.
  - Las horas de las velas intradía ahora viajan como timestamp Unix en
    UTC (`toUnixSeconds()` en `marketData.ts`, pidiendo `timezone=UTC` a
    Twelve Data) — antes solo se guardaba la fecha, lo que habría
    mezclado todas las velas de un mismo día en el marco "Hora".
- **Segundo pulido del gráfico (sept. 2026):**
  - Los botones sueltos de símbolo, marco temporal e indicadores se
    reemplazaron por menús desplegables (`SelectDropdown` para símbolo
    y marco temporal, `IndicatorsDropdown` para volumen/Bollinger) en
    `CandleChart.tsx` — mismo comportamiento, barra de herramientas más
    ordenada.
  - Insignia "Próxima vela en…": cuenta regresiva en vivo hasta que
    cierra la vela actual y abre la siguiente, calculada en
    `nextCandleBoundary()` según el marco temporal elegido. El reloj se
    arranca en un `useEffect` (nunca con `useState(() => Date.now())`
    directo) para no romper la hidratación de React.
  - Eje de tiempo con la hora de cada vela intradía visible debajo del
    gráfico (`timeVisible: true` en `lightweight-charts`) y fecha+hora
    completa al pasar el cursor por una vela, igual que en ProRealTime.
  - **Insignia pegada al precio actual:** la insignia de "Próxima vela
    en…" ya no queda fija en una esquina — se posiciona justo debajo de
    la etiqueta nativa de precio y sube o baja con ella. Se calcula con
    `series.priceToCoordinate()` sobre el último cierre
    (`updatePriceY()` en `CandleChart.tsx`), y se recalcula al llegar
    datos nuevos, al cambiar el tamaño del panel, al hacer zoom o
    desplazarse por el histórico, y al mostrar/ocultar las Bandas de
    Bollinger (porque ensanchan o angostan la escala de precio). La
    posición se limita (`clampBadgeTop()`) para que la insignia nunca
    se salga del panel por arriba o por abajo, y se mueve con una
    transición suave en vez de saltar de golpe.
- **Marco "Hora" alineado al reloj y horas en zona local (sept. 2026):**
  - Twelve Data ancla la vela horaria a la apertura del mercado: entrega
    9:30, 10:30, 11:30… ProRealTime, Investing y TradingView la anclan al
    reloj — una vela parcial de apertura (9:30–10:00) y de ahí en adelante
    10:00, 11:00, 12:00… Para igualarlas, `getCandles()` pide ahora velas de
    `30min` cuando el marco es `1h` y las agrupa por hora de reloj en
    `aggregateToClockHour()` (`marketData.ts`). La marca de tiempo de cada
    grupo es la de su primera vela, así que la de apertura queda rotulada
    9:30 y no 9:00, igual que en ProRealTime.
  - No cuesta créditos extra: Twelve Data cobra por llamada, no por vela, y
    el caché de 5 minutos sigue igual.
  - Las medias móviles y las Bandas de Bollinger se calculan **después** de
    agrupar, para que coincidan con las velas que se ven en pantalla.
  - Efecto secundario: la cuenta regresiva "Próxima vela en…" ahora sí es
    correcta en el marco horario. Antes contaba hasta la hora en punto
    mientras las velas cerraban a y media.
  - El eje de tiempo se rotulaba en UTC (13:30 para la apertura). Ahora
    `formatTickMark()` y `formatCrosshairTime()` (`CandleChart.tsx`) lo
    muestran en la hora local del visitante — 8:30 desde Colombia — como
    hacen ProRealTime e Investing. Las velas de día, semana y mes vienen
    marcadas a las 00:00 UTC, así que esas se siguen leyendo en UTC: pasarlas
    a hora local las correría al día anterior.
  - Los formateadores se vuelven a aplicar con `applyOptions()` en cada
    cambio de marco. Hace falta pasarle funciones nuevas porque
    lightweight-charts cachea las etiquetas ya calculadas — si no, quedaban
    velas sueltas rotuladas con la hora UTC entre las demás.
- **Pre-mercado / after-hours (sept. 2026):** insignia al estilo del
  "Pre-market" de TradingView que muestra hacia dónde viene abriendo el
  mercado. Vive en `getExtendedQuote()` (`marketData.ts`) y en la ruta
  `/api/premarket`.
  - `nyMarketSession()` decide en qué tramo de la jornada de Nueva York
    estamos — pre 04:00–09:30, regular 09:30–16:00, post 16:00–20:00, y
    cerrado el resto — calculado con la zona horaria real de la bolsa, así
    que el horario de verano se maneja solo. Probado contra 14 casos,
    incluidos EDT, EST y fines de semana.
  - Se refresca **una vez por hora** (caché de 3600 s en servidor y un
    intervalo de una hora en el cliente) porque lo pidió Alejo para no
    quemar créditos. Durante la sesión regular ni siquiera se llama a la
    API: no hay nada extendido que mostrar y así el gasto es cero.
  - **Requiere plan Pro (individual) o Venture (business):** el parámetro
    `prepost` de Twelve Data no existe en el plan gratuito. Mientras tanto
    la función responde sin precio y la insignia simplemente no aparece —
    el resto del gráfico sigue funcionando igual. El día que se suba de
    plan, se enciende sola sin tocar código.
- **Vela de apertura marcada e inversión del gráfico (sept. 2026):**
  - La vela de media hora con la que abre la sesión (8:30 en Colombia) ya
    existía como vela propia, pero no se distinguía de las demás. Ahora la del
    **día en curso** lleva un punto debajo —verde si abrió al alza, rojo si
    abrió a la baja— y la palabra "apertura". Se dibuja con `setMarkers()` y
    solo en el marco "Hora".
  - Al principio se marcaban todas las aperturas del histórico y el gráfico
    quedaba lleno de puntos. El tamaño del marcador tiene un mínimo en
    lightweight-charts (`size` por debajo de 0.3 ya no se ve más pequeño), así
    que la solución fue dejar un solo marcador en vez de achicarlos.
  - `isSessionOpen()` en `marketData.ts` obliga a que la vela de las 9:30 de
    Nueva York abra siempre balde propio en la agrupación horaria. Sin esto,
    el día que se activen los datos de pre-mercado la vela de las 9:00 y la de
    apertura caerían en la misma hora de UTC (la 13) y se fusionarían,
    borrando justo la vela que se quiere mirar.
  - Casilla **"Invertir gráfico"** en el menú de Indicadores, equivalente al
    "Invert scale" de TradingView (`rightPriceScale.invertScale`). Al
    invertir, los marcadores se pasan arriba de la vela y se omite el texto
    "apertura", que quedaría ilegible debajo de las velas volteadas; el punto
    de color se mantiene. La insignia de precio se recoloca sola.
- **Refresco en vivo del gráfico (sept. 2026):** el gráfico pedía las velas
  una sola vez, al cargar o al cambiar de símbolo o marco — la vela nueva de
  cada hora no aparecía hasta recargar la página. Ahora:
  - Mientras se mira el marco "Hora" se refresca en segundo plano cada minuto,
    sin parpadeo (`loadCandles()` no toca el estado de "Cargando…").
  - Justo al cruzar el cambio de hora se pide la vela nueva con `fresh=1`, que
    hace que el servidor salte su caché, más dos reintentos a los 10 y 30
    segundos porque el proveedor tarda unos segundos en publicarla. Cuesta
    unos 3 créditos por cambio de hora.
  - El caché del servidor baja a 60 s para el marco intradía **solo mientras
    la sesión de Nueva York está abierta** (`nyMarketSession()`); fuera de
    sesión, y en día/semana/mes, se queda en 5 minutos. Así el gráfico va en
    vivo cuando importa sin quemar créditos de noche.
  - `requestIdRef` descarta respuestas que lleguen fuera de orden, por si se
    cambia de símbolo con una petición todavía en vuelo.
- La plataforma es de **análisis y señales**. La ejecución de la orden
  ocurre en el bróker del propio usuario — la web no ejecuta operaciones
  ni custodia fondos.

## Login con Clerk (sept. 2026 — primera mitad de Fase 3)

Se integró Clerk de verdad: hasta ahora `getAccess()` en `src/lib/subscription.ts`
tenía el plan escrito en un comentario pero devolvía siempre `"sin-cuenta"`.
Ya llama a `auth()` y `currentUser()` (`@clerk/nextjs/server`) y revisa
`publicMetadata.suscripcion === "activa"` — eso lo escribirá el webhook de
Stripe cuando exista, todavía pendiente.

- `src/proxy.ts` (antes `middleware.ts`, renombrado por el cambio de
  convención de Next.js 16) monta `clerkMiddleware()` — pero solo si
  `CLERK_SECRET_KEY` y la llave pública están puestas; si no, deja pasar la
  petición sin más, mismo criterio de "fallar en silencio" que el resto del
  proyecto.
- `src/app/layout.tsx` envuelve el sitio en `<ClerkProvider>` (con los
  colores de marca en `appearance`), y también condicionado a
  `accountsConfigured()`.
- `src/components/AuthStatus.tsx` son los botones de "Iniciar sesión" /
  "Crear cuenta" (modal) o el avatar (`<UserButton>`) si ya hay sesión. Usa
  `<Show when="signed-in|signed-out">` — en Clerk Core 3 (la versión
  instalada, `@clerk/nextjs@7`) reemplazó a `<SignedIn>`/`<SignedOut>`.
  Aparece en el header de `/` y de `/suscripcion`.
- `/sign-in` y `/sign-up` (rutas con catch-all `[[...sign-in]]` /
  `[[...sign-up]]`, como pide Clerk) por si alguien llega directo a esas
  URLs en vez de abrir el modal.
- **Separación entre login y cobro:** se agregó `paymentsConfigured()` junto
  a `accountsConfigured()`. Son interruptores independientes a propósito —
  Clerk ya puede estar listo (la gente crea cuenta e inicia sesión) mientras
  Stripe sigue pendiente. `/suscripcion` ahora refleja el estado real: sin
  cuenta muestra "Crear cuenta" / "Ya tengo cuenta"; con cuenta pero sin
  Stripe muestra el botón desactivado con "Estamos terminando de conectar el
  sistema de pagos" en vez de fingir que ya se puede pagar.

Pendiente de Fase 3: el webhook `/api/webhooks/stripe` y las llaves de
Stripe — cuando estén, `paymentsConfigured()` se enciende solo.

## Universo pagado y marco "Hora" por defecto (sept. 2026)

- **Marco "Hora" por defecto:** `CandleChart` arrancaba en "Día". Ahora
  arranca en "Hora" (es el marco que la comunidad mira día a día) y además,
  en ese marco, el gráfico ya no hace `fitContent()` sobre los 180 días de
  historia que se piden de fondo para las medias móviles — se calcula el
  rango de la sesión más reciente (mismo criterio que ya usaba el marcador
  de "apertura") y se centra ahí con `setVisibleRange()`. Así siempre abre
  mostrando el día en curso (o el último día hábil si el mercado está
  cerrado), no seis meses de velas horarias amontonadas.
- **Universo pagado (S&P 500 + Nasdaq-100):** `src/lib/universe.ts` trae la
  lista de símbolos — es una foto amplia pero **no exhaustiva ni oficial**
  de esos dos índices (ver el comentario en el archivo); sirve para cubrir
  la gran mayoría de lo que alguien va a buscar, pendiente de reemplazarla
  algún día por una fuente que se actualice sola.
- `/api/universe` le dice al navegador qué símbolos puede pedir — el
  gratuito siempre, el pagado solo si `getAccess()` (Clerk) confirma
  suscripción activa. `/api/candles` vuelve a comprobar lo mismo del lado
  del servidor antes de servir cualquier símbolo pagado — el navegador
  nunca decide su propio acceso, ni siquiera si alguien edita el estado de
  React a mano.
- El selector de símbolo en `CandleChart` ahora es dinámico (ya no una
  lista fija de 3) y `SelectDropdown` aprendió a mostrar un buscador cuando
  hay más de 12 opciones — con 300+ símbolos un menú plano sería inusable.
- `TickerStrip` deja de mostrar "Con suscripción" fijo en S&P 500 / Nasdaq:
  si `/api/quotes` dice `allowed: true` (misma verificación de Clerk),
  cambia a "Desbloqueado".

## Pendiente — herramientas de dibujo detrás de suscripción

Cuando TradingView apruebe el acceso a Advanced Charts (solicitado a
`platforms@tradingview.com`, ver más arriba), las herramientas de dibujo
(líneas de tendencia, canales, texto, etc.) deben quedar **detrás de la
misma verificación de suscripción** que ya protege el universo pagado —
no basta con que el widget esté disponible técnicamente, hay que
condicionar su acceso a `getAccess().allowed` igual que en `/api/candles`.
Todavía no hay nada que integrar (no ha llegado la aprobación), esto es
solo la nota para cuando llegue.

## Pendiente — más de un nivel de suscripción

Alejo planea más de un plan de pago, no uno solo:

- Un plan que da acceso a **todos los gráficos** (el universo pagado de
  arriba) y a las **clases de Miguel Cortés** (Fase 4).
- Un plan aparte, de otro valor, específico para algo tipo "inicio de
  clases" — todavía sin nombre ni precio definitivo. Va a ir trayendo los
  repositorios/recursos correspondientes para revisar más adelante.

Hoy `subscription.ts` solo maneja un booleano (`activa` / no activa). Antes
de construir esto hay que decidir cómo se modela más de un nivel — lo más
simple sería guardar en los metadatos de Clerk no un booleano sino el
nombre del plan (`plan: "completo" | "clases" | null`) y que `getAccess()`
devuelva cuál es, en vez de solo si hay acceso o no. Pendiente de diseño,
no implementado todavía.

## Incidente — se agotó el crédito diario de Twelve Data (15 sept. 2026)

El sitio dejó de traer velas y cotizaciones (`Twelve Data respondió 429` en
todas partes). No fue un bug: Twelve Data devolvió *"You have run out of
API credits for the day. 978 API credits were used, with the current limit
being 800."* — el plan gratuito.

Causa: el refresco automático del lado del navegador era demasiado
agresivo para 800 créditos/día. Con una sola pestaña abierta:

- `TickerStrip` pedía 3 símbolos cada 30s → ~360 créditos/hora ella sola.
- `CandleChart` en marco "Hora" refrescaba cada 60s → ~60 créditos/hora más.

Eso agota el límite diario en menos de dos horas con un solo visitante — con
varias personas probando el sitio a la vez (como pasó) se va en minutos.

**Mitigación aplicada:** se bajó la frecuencia a 5 minutos en ambos
(`TickerStrip.tsx`, `CandleChart.tsx`) — baja el gasto a ~48 créditos/hora
por pestaña, unas 8 veces menos. Sigue sin ser una solución definitiva: con
varias pestañas o visitantes reales el límite se puede volver a agotar.

**Solución real, ya documentada más arriba en "Datos de mercado":** subir a
un plan de pago de Twelve Data. Su propio mensaje de error lo dice: *"consider
switching to a paid plan that will remove daily limits"* — un plan pago no
solo habilita el uso público (licencia "display", ya lo sabíamos), sino que
además quita el límite de 800/día por completo. Mientras siga en el plan
gratuito, el límite se puede volver a agotar con facilidad durante pruebas.

## Caché persistente de datos de mercado — Redis/Upstash (15 sept. 2026)

A raíz del incidente de arriba, se agregó una caché de verdad — no solo la
caché de `fetch` de Next.js, que no estaba evitando los pedidos repetidos.

- **Dónde vive:** Upstash for Redis, instalado como integración de Vercel
  (Storage → `candle-cache`), conectado al proyecto en Production, Preview
  y Development. Las llaves (`REDIS_KV_REST_API_URL`,
  `REDIS_KV_REST_API_TOKEN`) las crea la propia integración — no hay que
  copiarlas a mano.
- **Cómo funciona** (`src/lib/marketCache.ts`): `getCandles()` y
  `getQuotes()` (`src/lib/marketData.ts`) primero miran si ya hay algo
  guardado y qué tan viejo es. Si el mercado está en sesión regular, el
  dato vale 5 minutos (igual al refresco del navegador, ver el incidente de
  arriba). **Fuera de sesión regular, vale 12 horas** — el precio de cierre
  no cambia hasta que abre de nuevo, así que servirlo desde la caché es
  exactamente lo mismo que pedirlo de nuevo, pero gratis. Esto es lo que
  permite ver las velas del día después del cierre sin gastar más créditos.
- Sin las llaves de Redis puestas, se comporta como si no hubiera caché
  (siempre pide a Twelve Data) — mismo criterio de fallar en silencio del
  resto del proyecto, nunca romper el sitio por esto.
- No es historial permanente/indefinido: cada símbolo+marco guarda solo su
  último resultado (se sobrescribe), con un TTL máximo de 12h. Si algún día
  se quiere guardar histórico completo (para backtesting, por ejemplo) hay
  que pasar a algo con más estructura (Postgres) — ver "Decisiones
  pendientes".
- Plan gratuito de Upstash: 500.000 comandos/mes, más que suficiente para
  esta escala.

## Pasarela de pago: Stripe descartado, se elige MercadoPago (15 sept. 2026)

Se intentó arrancar con Stripe (ya estaba en el plan original) y se
construyó el flujo completo (`src/lib/stripe.ts`, `/api/checkout`,
`/api/webhooks/stripe`) — pero **Stripe no opera con vendedores en
Colombia**. Se investigaron las alternativas:

- **PayU**: su API de suscripciones/cobro recurrente está **descontinuada**
  — ya no se ofrece a comercios nuevos. Solo queda su API de tokenización,
  que obligaría a construir el cobro mensual a mano (cron propio,
  reintentos, manejo de pagos fallidos).
- **Wompi** (Bancolombia) y **Bold** (la plataforma que ya usa Alejo para
  cobrar manualmente a la comunidad): mismo problema — tokenización sí,
  pero el débito automático mensual necesita convenios aparte o
  construirse a mano.
- **MercadoPago**: tiene una API de suscripciones vigente y activa
  ("Preapproval"), con documentación específica para Colombia
  (mercadopago.com.co/developers). Maneja el ciclo completo: cobra el
  primer pago, y de ahí en adelante cobra solo cada mes sin que el
  proyecto tenga que hacer nada — mismo nivel de automatización que se
  buscaba con Stripe.

**Se elige MercadoPago.** El código de Stripe se queda en el repo tal cual
— sin las llaves puestas, simplemente no hace nada (falla en silencio,
mismo criterio de siempre) — por si algún día se constituye una empresa en
un país donde Stripe sí opere. La integración de MercadoPago está
pendiente de que Alejo cree la cuenta de developer y comparta las
credenciales de prueba.

PayU sí acepta personas naturales sin NIT (cédula + comprobante de
domicilio + extractos bancarios, 2-5 días hábiles) — el problema no fue el
registro, fue que el producto de suscripciones ya no existe. Falta
confirmar si MercadoPago pide NIT para pasar de credenciales de prueba a
producción real; se sabrá cuando Alejo intente ese paso.

## Página "Introducción al trading" (15 sept. 2026)

Nueva ruta `/introduccion`, protegida solo por tener cuenta (no por
suscripción activa — es de bienvenida para cualquiera que se registre, no
solo para quien paga). Redirige a `/sign-in` si no hay sesión.

- Después de crear una cuenta, Clerk manda directo aquí
  (`NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/introduccion`, en vez
  de la portada).
- Muestra 5 módulos de un programa de estudio (qué es el trading, leer
  velas, medias móviles, Bollinger/volumen, gestión de riesgo) — son solo
  los **títulos**, marcados "Próximamente": el contenido real (video,
  texto) lo tiene que traer Miguel Cortés, no se inventó aquí.
- Debajo, el mismo `CandleChart` de la portada, para practicar de una vez.
- Desde el header (`AuthStatus`), cualquiera con sesión puede volver a
  entrar por el link "Introducción".

## Datos de mercado: servir el último precio conocido si Twelve Data falla
(15 sept. 2026)

Antes, si Twelve Data fallaba (429, caído, lo que sea) el sitio mostraba
"sin datos" así hubiera un precio guardado en la caché de Redis de hace
apenas un rato. Ahora `getCandles()` y `getQuotes()` (`marketData.ts`)
caen al último valor guardado (aunque ya esté vencido) antes de rendirse —
un precio de hace 20 minutos sirve mucho más que una pantalla vacía. Solo
si nunca hubo nada guardado se muestra el error tal cual.

## Bug real: buscar una acción del universo pagado tumbaba la página (15 sept. 2026)

Alejo reportó que al buscar otra acción (probó con Apple/Netflix) en el
gráfico, la página se rompía con un mensaje de "no se pudo cargar". Se
reprodujo y encontró la causa real:

- `/api/premarket` se quedó con la lista vieja de solo 3 símbolos
  (`FREE_SYMBOLS`) de cuando no existía el universo pagado — nunca se
  actualizó cuando se agregó S&P 500/Nasdaq-100 (`/api/candles` sí se
  actualizó, este endpoint se quedó atrás). Al elegir AAPL o NFLX,
  devolvía 403 en vez de la cotización extendida.
- `CandleChart.tsx` recibía ese error y hacía
  `extended.price.toFixed(2)` protegido solo por
  `extended.price !== null` — pero un error trae `price` en `undefined`,
  no en `null`, y `undefined !== null` dio `true`. `undefined.toFixed()`
  tira una excepción sin capturar que tumba TODO el árbol de React (no
  solo el gráfico) — de ahí el "esta página no se pudo cargar".

**Corregido:** `/api/premarket` ahora usa el mismo criterio de acceso que
`/api/candles` (`isFreeSymbol`/`isPaidSymbol` + `getAccess()`, ver
`src/lib/universe.ts`). Y la comparación en `CandleChart.tsx` pasó a
`typeof extended.price === "number"` — así, si algún día otro endpoint
vuelve a fallar de forma parecida, se deja de mostrar la insignia de
pre-mercado en silencio en vez de tumbar la página entera.

## Aviso de earnings próximos (15 sept. 2026)

Alejo pidió avisar cuando se acerca la fecha de earnings (reporte
trimestral) de la acción que se está mirando — como hace TradingView, pero
sin el ícono sobre la vela: una nota aparte, para que quede claro que es
una estimación.

- Twelve Data tiene un calendario de earnings futuro real
  (`/earnings_calendar`), pero requiere plan Grow/Pro/Ultra/Venture/
  Enterprise — con el plan gratuito devuelve 403.
- La idea era estimarlo desde el histórico (`/earnings`) en su lugar — una
  prueba inicial con AAPL respondió 200 con datos reales, pero al probar
  con más símbolos (META, MSFT, GOOGL, JPM...) todos devolvieron el mismo
  403: *"available exclusively with grow or pro or ultra or venture or
  enterprise plans"*. Ese primer éxito con AAPL parece haber sido un caso
  aislado (¿caché del lado de Twelve Data?) — en la práctica, **`/earnings`
  también está bloqueado en el plan gratuito**, no solo
  `/earnings_calendar`.
- **Estado real:** `src/lib/earnings.ts` queda construido y listo (calcula
  la estimación promediando el intervalo entre los últimos reportes), pero
  mientras el plan siga siendo gratuito no hay de dónde sacar ni el
  histórico — la insignia simplemente no va a aparecer nunca (falla en
  silencio, no rompe nada). El día que se suba de plan, esto se enciende
  solo sin tocar código — es una razón más (junto con la licencia "display"
  y el límite de 800 créditos/día) para subir de plan antes de lanzar en
  serio.
- El día que se suba de plan de Twelve Data, cambiar esta función para
  llamar `/earnings_calendar` es lo único que hay que tocar — la ruta
  (`/api/earnings`), la caché y el badge en `CandleChart.tsx` quedan
  iguales.
- Solo aparece si el earning estimado cae dentro de los próximos 21 días
  (`EARNINGS_WARNING_DAYS`) — con meses de anticipación no aporta nada.
- Se cachea 24h (Redis) por símbolo: la fecha no cambia varias veces al
  día, así que no hay razón para pedirla seguido.
- No aplica a ETFs (SPY, GLD): no reportan earnings, así que ahí
  simplemente no aparece nada — no es un error.

## Sala de Trading — gráfico a pantalla completa (15 sept. 2026)

Como en TradingView, ThinkOrSwim o TC2000: una vista sin nada alrededor,
solo el gráfico ocupando toda la pantalla. Nueva ruta `/sala-de-trading`,
pública (mismo criterio que el gráfico de la portada — no pide cuenta ni
suscripción, mismo universo de símbolos según quien esté mirando).

- `CandleChart` aprendió un modo `fillHeight`: en vez del alto fijo de
  420px, el panel ocupa el alto real de su contenedor (el `ResizeObserver`
  que ya existía para el ancho ahora también mide el alto cuando
  `fillHeight` está activo). `clampBadgeTop()` recibe ese alto como
  parámetro en vez de asumir el fijo de siempre — si no, la insignia de
  "próxima vela" se hubiera podido salir del panel en pantallas grandes.
- El uso normal (portada, `/introduccion`) sigue igual, con el alto fijo de
  antes — `fillHeight` es opcional y por defecto `false`.
- Enlace "Sala de Trading" en el header de la portada y de
  `/introduccion`, al lado de los demás links.

## Lista de seguimiento (watchlist) en la Sala de Trading (15 sept. 2026)

Como el panel "Populares" de ProRealTime, armado con un buscador por
categorías como el "Agregar símbolo" de TradingView. Solo vive en la Sala
de Trading — la portada y `/introduccion` quedan igual que antes.

- **Decisión temporal de acceso (Alejo, 15 sept. 2026):** mientras se
  prueba, basta con **tener cuenta** — no hace falta pagar. A futuro esto
  se vuelve parte del plan de $25/mes, junto con las clases de Miguel
  Cortés. Por eso se separó en dos funciones en `subscription.ts`:
  `isRegistered()` (solo sesión) y `hasSymbolAccess(scope)`, que usa
  `isRegistered()` cuando `scope === "sala"` y `getAccess().allowed` (la de
  siempre) en cualquier otro caso. El día que se decida cobrarlo, es un
  único cambio en `hasSymbolAccess()` — nada más que tocar.
- Todas las rutas de datos (`/api/candles`, `/api/premarket`,
  `/api/earnings`, `/api/universe`, `/api/quotes`) aceptan `scope=sala` y
  aplican esa regla relajada — `CandleChart` lo manda solo cuando
  `fillHeight` está activo (o sea, solo en la Sala de Trading).
- `src/lib/universe.ts` ganó `SECTORS`: la misma lista de acciones agrupada
  por sector (Tecnología, Financieras, Salud, etc.) para las categorías del
  buscador. Solo acciones de EE.UU. — Forex y Cripto quedan pendientes de
  una fuente de datos aparte.
- **Guardado:** `src/lib/watchlist.ts`, en el mismo Redis de la caché de
  mercado pero SIN vencimiento (`getRedisClient()`, expuesto por
  `marketCache.ts` para esto). Máximo 30 símbolos por persona, y se filtra
  cualquier símbolo que no exista en el proyecto antes de guardar.
  **Ojo:** esa base tiene "eviction" activado (pensada para la caché, que sí
  se puede volver a pedir) — con el proyecto todavía chico el riesgo de que
  eso bote una watchlist real es bajísimo, pero si esto crece en serio hay
  que separarla a su propio almacenamiento. Ver "Decisiones pendientes".
- **Cotizaciones más eficientes:** de paso, `getQuotes()` (`marketData.ts`)
  pasó de cachear por la combinación completa de símbolos pedidos a
  cachear cada símbolo por separado — antes, dos listas de seguimiento
  distintas que compartieran una acción no se beneficiaban la una de la
  caché de la otra.
- Si no hay cuenta, el panel muestra un aviso con botones de crear
  cuenta/iniciar sesión en vez del buscador — nunca deja ver ni intentar
  nada del universo pagado sin sesión.
- **Desplegable (sept. 2026):** el panel no está siempre visible — un botón
  "★ Favoritas" en la barra del gráfico lo despliega y lo vuelve a esconder
  (`showWatchlist` en `CandleChart.tsx`), para no restarle espacio al
  gráfico cuando nadie lo está usando.

## Bug real: la PM/MA de 200 nunca se dibujaba (17 sept. 2026)

`/api/candles` pedía solo 180 velas (`outputsize`), pero una media móvil de
200 períodos necesita 200 cierres solo para calcular su primer punto — con
180 velas, `sma200` quedaba siempre lleno de `null` y la línea morada nunca
aparecía en el gráfico. Nadie lo había notado porque las otras tres (20, 40,
100) sí tenían de sobra.

**Corregido:** `outputsize` subió a 300 (`src/app/api/candles/route.ts`,
default en `getCandles()`) — sin costo extra de créditos, Twelve Data cobra
por llamada, no por vela. Con 300 velas, la PM 200 tiene unas 100 de
holgura para dibujarse.

**Ojo:** como la caché de Redis no distingue por `outputsize`, un
símbolo/marco que ya estuviera cacheado de antes de este cambio (con solo
180 velas) puede tardar hasta que venza su caché (5 min en sesión regular,
hasta 12h con el mercado cerrado) en mostrar la PM 200 — no hace falta
hacer nada, se resuelve solo.

También se renombraron las etiquetas de "MA" a **"PM"** (Promedio Móvil,
que es como se le dice en español) en el gráfico y en `/introduccion` — el
código interno (`sma20`, `sma40`, etc.) se quedó igual, solo cambió lo que
se ve.

## El gráfico abre centrado en lo reciente, no en todo el historial (17 sept. 2026)

En Día/Semana/Mes, el gráfico abría con `fitContent()` — las 300 velas
completas apretadas en el panel. Para ver el precio actual había que hacer
zoom y arrastrarse hasta la derecha cada vez que se cambiaba de acción o de
marco. Alejo lo pidió explícitamente pensando en gente mayor a la que le
cuesta desplazarse por el gráfico.

**Corregido:** ahora se muestra solo la mitad más reciente de lo cargado
(150 de las 300 velas), con un margen del 5% a la derecha — las velas
quedan al doble de grandes y el gráfico ya arranca centrado en el valor de
hoy, sin que nadie tenga que moverse para llegar ahí. El marco "Hora" ya
hacía algo parecido (centrado en la sesión del día) y se quedó igual.

## Marco "Hora": alejar el zoom para ver más contexto (17 sept. 2026)

El marco "Hora" mostraba SOLO el día en curso — con el mercado recién
abierto eso eran apenas 6-7 velas, demasiado apretado. Alejo pidió alejar
el zoom para ver más historia sin llegar a las 300 velas completas.

**Corregido:** ahora se muestran los últimos **3 días hábiles** completos
en vez de uno solo (`DIAS_VISIBLES_HORA` en `CandleChart.tsx`) — bastantes
más velas visibles, sigue siendo un tramo corto y legible. El marcador de
"apertura" se sigue calculando solo sobre el día actual, eso no cambió.

## Plan de Twelve Data: investigado a fondo (17 sept. 2026)

Alejo preguntó si "con la suscripción" (de pago) esto de los errores por
créditos se acaba. Se investigaron los planes reales de Twelve Data:

| Plan | Precio | Quita el límite de 800/día | Permite mostrar datos al público |
|---|---|---|---|
| Basic (actual) | Gratis | No | No — "uso interno" |
| Grow | $29/mes | Sí | **No** — sigue siendo "uso interno" |
| Pro | $99/mes | Sí | **No** — sigue siendo "uso interno" |
| **Venture** (negocio) | **$499/mes** ($4,990/año) | Sí | **Sí** — "external display data access" |

Ningún plan individual (Basic/Grow/Pro/Ultra) da permiso de mostrarle datos
reales a visitantes del público — sus términos lo prohíben explícitamente
("do not permit commercial display of data to third parties"). Ese permiso
solo lo da el plan de **negocio Venture, $499/mes**. Fuente: soporte de
Twelve Data ("Commercial and personal usage") y `twelvedata.com/pricing-business`.

**Decisión de Alejo:** esperar a Venture cuando el proyecto esté listo para
lanzar en serio con suscriptores pagando de verdad — no subir a Grow/Pro
mientras tanto (esos planes cuestan dinero y técnicamente seguirían sin dar
el permiso que hace falta). Mientras tanto, el proyecto sigue en el plan
gratuito, con el paliativo de abajo para el universo gratuito.

## Cron diario: calentar la caché antes de que abra el mercado (17 sept. 2026)

Alejo notó que a primera hora de la mañana la página tarda en cargar — la
primera visita del día es la que, sin saberlo, dispara el pedido "en frío"
a Twelve Data. Propuso traer y guardar todos los indicadores de todas las
acciones cada mañana antes de las 7:30 — buena idea, pero **inviable para
las 500+ acciones del universo pagado** con el límite de 800 créditos/día:
ese solo trabajo gastaría casi el día completo de un jalón.

**Lo que sí se hizo:** `src/app/api/cron/warm-free-symbols` — un cron de
Vercel (`vercel.json`) que cada día hábil calienta la caché de Redis del
**universo gratuito únicamente** (SPY/META/GLD: cotizaciones + velas en
Hora/Día/Semana/Mes). Corre a las 6am Colombia (11:00 UTC) entre semana —
con margen de sobra para terminar antes de las 7:30 que pidió Alejo, dado
que en el plan Hobby de Vercel un cron diario se dispara en algún punto de
la hora indicada, no al minuto exacto.

Protegido con `CRON_SECRET` (Vercel lo manda solo como
`Authorization: Bearer <valor>` en cada invocación programada) para que
nadie más pueda llamar la ruta y gastar créditos a propósito.

**El universo pagado se queda sin calentar** hasta que se suba a un plan
que lo permita económicamente — es la misma limitación de arriba.

## Panel de administración y acceso manual (17 sept. 2026)

Con el cobro automático todavía sin terminar (ver MercadoPago arriba) y las
clases de Miguel Cortés como prioridad inmediata, Alejo pidió poder dar
acceso a mano — sin esperar a que exista el checkout. Herramientas de
dibujo (líneas, flechas movibles, texto, stickers) quedaron anotadas para
una conversación aparte más adelante, esto no las incluye.

- **`accesoManualHasta`** (metadatos públicos de Clerk, fecha ISO): nueva
  forma de darle a alguien acceso — junto a la de siempre (`suscripcion:
  "activa"`, que pondría el webhook de un cobro real). `getAccess()`
  (`subscription.ts`) ahora acepta cualquiera de las dos — pasada la fecha,
  vuelve a comportarse como si nunca se hubiera dado, sin que nadie tenga
  que acordarse de quitarlo a mano.
- **`/admin`** (protegido por `isAdmin()` — la lista de correos vive en
  `ADMIN_EMAILS`, separados por coma; hoy solo `alejo012g@gmail.com`):
  lista de todo el que se ha registrado (vía la API de Clerk), buscador por
  correo, casillas de selección múltiple, y tres botones para dar acceso
  (1 semana / 2 semanas / 1 mes) o quitarlo — a los seleccionados, de una
  sola vez.
- Todavía no hay una página real de "clases de Miguel Cortés" que usar como
  destino — esta pieza queda lista para conectarse ahí el día que exista
  (Fase 4, Vimeo). Por ahora, lo que da (`accesoManualHasta`) ya es
  reconocido en todas partes donde se usa `getAccess()`/`hasSymbolAccess()`.

## Bug real: texto casi invisible en los modales de Clerk (17 sept. 2026)

Alejo reportó que el modal "Manage account" (y el menú del avatar) se veían
"como si el ojo humano no pudiera verlos" — texto prácticamente invisible.
Se reprodujo: el título "Profile details" se pintaba en `rgb(33,33,38)`
(casi negro) sobre nuestro fondo oscuro (`#131722`).

Causa: nunca se le dijo a Clerk que partiera de su **tema oscuro base**. El
`appearance` solo pisaba un puñado de `variables` (colorPrimary,
colorBackground, colorText...) — el resto de los estilos internos de Clerk
(títulos de sección, etiquetas, etc.) seguían con los valores por defecto
pensados para fondo blanco, con texto oscuro que sobre nuestro fondo oscuro
queda casi invisible. Por eso "Update profile" y "+ Add email address" (que
sí usan `colorPrimary`, dorado) se veían bien, y todo lo demás no.

**Primer intento (insuficiente):** se agregó `baseTheme: dark` (paquete
`@clerk/themes`) — ayuda para lo que no se pisa a mano, pero no resolvió el
problema real: se probó en producción y el título seguía en `rgb(33,33,38)`.

**Causa real:** Clerk Core 3 renombró las variables de texto —
`colorText` → **`colorForeground`**, `colorTextSecondary` →
**`colorMutedForeground`**, `colorInputText` → **`colorInputForeground`**,
`colorInputBackground` → **`colorInput`**. Su documentación dice que los
nombres viejos siguen funcionando como alias, pero en la práctica no se
estaban aplicando — `--clerk-color-foreground` (la variable CSS real que
lee `cl-headerTitle`) se quedaba vacía y caía a su valor por defecto
`light-dark(#212126, white)`, que en un documento sin `color-scheme: dark`
declarado resuelve al primer valor (`#212126`, para fondo blanco).

**Corregido de verdad:** se cambiaron las `variables` a los nombres nuevos
(`colorForeground`, `colorMutedForeground`, `colorInputForeground`,
`colorInput`, más `colorPrimaryForeground` para el texto sobre los botones
dorados) — verificado con el DOM real: el título pasó de `rgb(33,33,38)` a
`rgb(224,224,224)` (nuestro `#E0E0E0`). `baseTheme: dark` se dejó puesto,
sigue siendo útil para todo lo que no se pisa a mano (colorDanger,
colorSuccess, etc.).

## "Introducción" pasa a requerir aprobación (17 sept. 2026)

Decisión de Alejo: "Introducción" deja de ser abierta a cualquiera que se
registre — ahora hace falta que él dé acceso a mano desde `/admin` (o, más
adelante, una suscripción pagada). Antes usaba solo `isRegistered()`; ahora
usa `getAccess().allowed` (que ya reconoce tanto `accesoManualHasta` como
una suscripción real, ver la sección de arriba) — quien no tiene acceso ve
un aviso claro en la misma página en vez de que la página simplemente no
cargue nada.

Como consecuencia, el redirect después de registrarse
(`NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`) volvió a apuntar a `/`
en vez de `/introduccion` — no tenía sentido mandar a alguien recién
registrado directo a una pared bloqueada.

También se mejoró `/admin`: antes, si alguien sin permiso entraba (por
ejemplo, Alejo conectado con su cuenta de pruebas en vez de la admin), la
página mandaba de vuelta a la portada **en silencio** — parecía que no
pasaba nada. Ahora explica con qué correo está conectado y qué hacer.

La Sala de Trading (`scope=sala`, solo pide estar registrado) **no
cambió acá** — sigue siendo la decisión de prueba de Fase 3 documentada
arriba, aparte de esto. (Sí cambió más tarde el mismo día — ver la
siguiente sección.)

## Acceso por sección, no todo junto (17 sept. 2026)

Decisión de Alejo: quiere decidir, **correo por correo**, quién entra a
Introducción y quién a la Sala de Trading — no las dos con un solo
interruptor. Hasta ahora `/admin` solo tenía un botón de "dar acceso" que
abría las dos a la vez (porque Introducción usaba `getAccess()` y Sala
usaba `isRegistered()`, mecanismos distintos que igual terminaban dejando
pasar a cualquiera registrado en Sala).

Cambios:

- `publicMetadata.acceso` reemplaza a `publicMetadata.accesoManualHasta`:
  ahora es un objeto `{ introduccion?: fecha, sala?: fecha }` en vez de una
  sola fecha. Clerk no hace merge profundo de metadatos anidados, así que
  `/api/admin/access` lee el usuario primero, cambia solo la sección
  pedida y manda el objeto completo de vuelta — si no, dar acceso a Sala
  borraría sin querer el de Introducción (o viceversa).
- `getAccess(scope)` en `subscription.ts` ahora recibe la sección
  (`"introduccion" | "sala"`). Sin sección (como en `/suscripcion`), solo
  cuenta la suscripción paga real — un acceso manual dado para una sección
  puntual no debe hacer parecer que la membresía completa de $25/mes está
  activa.
- La Sala de Trading deja de estar abierta a cualquier registrado: ahora
  usa `getAccess("sala")`, igual que Introducción usa
  `getAccess("introduccion")`. `isRegistered()` (la función que daba ese
  paso libre) se eliminó por no tener más usos.
- `/admin` (`AdminUserTable.tsx`) muestra una columna de estado por
  sección y un selector de "Sección: Introducción / Sala de Trading" — los
  botones de dar/quitar acceso aplican solo a la sección elegida.
- La Sala de Trading (`Watchlist.tsx`) ahora distingue, al no tener
  acceso, entre "no tiene cuenta" (invita a registrarse) y "tiene cuenta
  pero no se le ha dado acceso" (mensaje de "escríbenos"), en vez de
  mostrarle a alguien ya registrado un botón de "crear cuenta" que no
  tenía sentido para su caso.

Primer correo con acceso a ambas secciones: `alejo012g@gmail.com` (cuenta
de pruebas de Alejo), dado a mano vía la API de Clerk para no depender de
que el panel ya estuviera desplegado. Los siguientes correos (los
estudiantes de Miguel Cortés) se agregan uno por uno desde `/admin` ya con
esto en producción.

## Bug real: ADMIN_EMAILS vacía en producción (17 sept. 2026)

Alejo no veía la tabla de usuarios en `/admin` con ninguna de sus dos
cuentas. La variable `ADMIN_EMAILS` en Vercel (Producción) estaba guardada
como tipo "Secret" — cosa que la vuelve invisible incluso para editarla
desde el dashboard ("Separate Production Secret Values") — y en algún
punto quedó vacía, probablemente desde que se creó por primera vez. Con
`ADMIN_EMAILS` vacío, `isAdmin()` responde `false` para cualquier correo,
así que ni Alejo podía entrar.

Arreglado: se volvió a guardar con `alejo012g@gmail.com` y se redesplegó
(las variables de entorno no se actualizan solas — hace falta un nuevo
deploy para que una función ya construida las vuelva a leer). Queda
pendiente considerar guardar variables así (que no son secretas, solo
listas de configuración) como tipo "Config" en vez de "Secret", para poder
verificarlas sin tener que adivinar por qué algo no funciona.

## Banear cuentas (17 sept. 2026)

Decisión de Alejo: algunas cuentas retransmiten o comparten el contenido
pagado con gente que no pagó. Además de poder quitarles el acceso a una
sección puntual, quiere poder bloquearles la cuenta por completo.

`/api/admin/ban` usa el bloqueo nativo de Clerk (`banUser`/`unbanUser`):
una cuenta baneada no puede volver a iniciar sesión con ese correo bajo
ningún concepto (Clerk le cierra las sesiones activas y rechaza cualquier
intento de entrar) — para volver a usar el sitio necesitaría registrarse
con un correo distinto. Es más fuerte que "quitar acceso" (que solo cierra
una sección, la cuenta sigue sirviendo para entrar) y por eso vive como un
botón aparte en `/admin`, con confirmación antes de aplicarse. Un admin no
se puede banear a sí mismo por accidente (se quedaría sin forma de entrar
a deshacerlo).

## Bug real: "Eliminar acceso" no bloqueaba a alguien con suscripción falsa (17 sept. 2026)

Alejo probó "Eliminar acceso" con la cuenta `alejo30g@gmail.com` y,
después de eliminarlo, esa cuenta seguía entrando a Introducción y Sala
de Trading. No era un bug de código: esa cuenta tenía guardado
`publicMetadata.suscripcion = "activa"` desde alguna prueba manual de
hace tiempo (de cuando se armó el flujo de Stripe, nunca se limpió). Esa
bandera es la de "suscripción paga real" — `getAccess()` la revisa
aparte de `acceso` (el permiso manual por sección) y basta con que
cualquiera de las dos esté activa para dejar pasar. "Eliminar acceso"
solo toca `acceso`, nunca `suscripcion`, así que esa cuenta nunca perdió
el acceso real por más que se le quitara el permiso manual.

Se confirmó revisando las 4 cuentas registradas directamente contra la
API de Clerk: solo `alejo30g@gmail.com` tenía esa bandera puesta; las
otras tres estaban limpias. El webhook de Stripe (`/api/webhooks/stripe`)
no puede haberla puesto de nuevo — sin `STRIPE_SECRET_KEY` /
`STRIPE_WEBHOOK_SECRET` configuradas responde "no configurado" sin tocar
nada. Se limpió la bandera a mano; no hace falta ningún cambio de código,
solo quedó registrado acá por si vuelve a aparecer una cuenta con acceso
que no se explica por `acceso`.

## Semana gratis de la Sala de Trading al registrarse (17 sept. 2026)

Decisión de Alejo: cualquiera que se registre entra a la Sala de Trading
gratis durante **7 días** desde que crea la cuenta — pasada esa semana,
vuelve a hacer falta suscripción paga o un acceso manual desde /admin,
igual que Introducción. Reemplaza la regla vieja (registrarse = acceso
total sin límite de tiempo) que se había dejado atrás sin querer.

`pruebaGratisVigente(createdAt)` en `subscription.ts` lo calcula al vuelo
comparando la fecha de creación de la cuenta en Clerk con `Date.now()` —
no guarda nada nuevo, no hace falta webhook ni cron: el día 8 deja de
cumplirse solo. `getAccess("sala")` la suma como una tercera forma de
tener acceso (junto a la suscripción paga y el acceso manual). Aplica
igual a cuentas que ya existían antes de este cambio, contando desde su
fecha real de registro.

Como esto puede dejar entrar a alguien sin que aparezca ninguna fecha en
`acceso.sala` (igual que ya pasaba con `suscripcion: "activa"`, ver la
sección de arriba), `/admin` ahora también muestra "prueba gratis" en la
columna de Sala de Trading cuando aplica — para que nunca quede
escondido por qué alguien sigue entrando.

## Comparación con TradingView y plan de features (18 sept. 2026)

Alejo mandó un video (4:19) grabando TradingView y señalando, en orden,
cosas que quiere en la Sala de Trading: fondos de color por sesión, un
panel "árbol de objetos" (lista de indicadores/dibujos activos), líneas de
tendencia / línea horizontal / tendencia de regresión / regla de medición,
un menú clic-derecho (alerta de precio, comprar/vender simulado, agregar
orden, dibujar línea horizontal), watchlist con columnas ordenables +
bandera de color + ficha del símbolo, buscador con pestañas por categoría, y
marcos de tiempo 5m/15m/30m/65m.

De esas 15 cosas, dos (**alertas de precio** y **compra/venta simulada**)
son sistemas aparte — alertas necesita vigilar el precio aunque el usuario
no tenga el sitio abierto, compra/venta simulada necesita posiciones y
ganancias/pérdidas, básicamente un simulador de trading dentro del
simulador de trading. Alejo confirmó dejarlas para después (coincide con la
decisión de las herramientas de dibujo del 15 sept.: "esto es más largo,
debemos sentarnos un poco más") y arrancar por lo visual.

Primera tanda, ya en producción:

- **Marcos de tiempo 5m/15m/30m** (`CandleChart.tsx`, `/api/candles`): son
  intervalos nativos de Twelve Data, no necesitan el reagrupado especial de
  "1h" (`aggregateToClockHour` en `marketData.ts`). No se agregó 65m —
  Twelve Data no lo tiene como intervalo nativo y armarlo a mano no valía
  la complejidad para esta tanda. Toda la lógica que antes miraba
  `timeframe === "1h"` para decidir "¿esto es intradía?" (formato del eje,
  marcador de apertura, zoom centrado en los últimos días, refresco cada 5
  min) ahora usa un conjunto `INTRADAY_TIMEFRAMES` que incluye los cuatro
  marcos — excepto el refresco EXACTO al cruzar la hora (`fresh=1`), que
  sigue siendo solo para "1h" a propósito: en marcos de minutos esos
  cruces son mucho más frecuentes y hubiera disparado muchos más créditos
  de Twelve Data de los que vale la pena gastar en esta fase.
- **Watchlist** (`Watchlist.tsx`): encabezados "Símbolo" / "Última"
  ordenables (clic invierte la dirección), una bandera de color decorativa
  junto a cada símbolo, y una ficha del símbolo activo del gráfico debajo
  de la lista — pero SOLO con datos reales que ya se tienen (símbolo,
  sector vía `sectorOf()` en `universe.ts`, precio y % del día). A
  propósito no hay descripción de empresa ni noticias como en TradingView:
  no hay una fuente de eso todavía, y no tiene sentido fingir que sí. La
  ficha solo aparece si el símbolo activo ya está entre las favoritas —
  así no se gasta una consulta aparte a Twelve Data solo para mostrarla.
- El buscador de símbolos por categorías que ya existía en el modal de
  "Agregar símbolo" de la watchlist (por sector, ver `SECTORS` en
  `universe.ts`) ya cubre razonablemente esta idea con los datos reales
  que hay — no se agregaron pestañas de Forex/Futuros/Bonos/Opciones
  porque el universo de la plataforma no tiene ese tipo de instrumentos.

Pendiente de esta misma tanda (visual, sin alertas ni trading simulado):
fondos de color por sesión, árbol de objetos, y las herramientas de dibujo
(línea horizontal, tendencia, regla) — line horizontal es sencilla con las
"price lines" nativas de `lightweight-charts`; tendencia y regla necesitan
una capa de dibujo interactiva encima del gráfico (arrastrar, mostrar
diferencia de precio/tiempo), que no trae la librería por defecto.

## Herramientas de dibujo y árbol de objetos (18 sept. 2026, misma tanda)

Ya en producción, completando casi toda la lista de la sección anterior:

- **Árbol de objetos** (botón "Objetos" en `CandleChart.tsx`): lista todo lo
  activo en el gráfico ahora mismo — las 4 PM (siempre), Bollinger/Volumen
  (si están prendidos desde "Indicadores"), y cada dibujo hecho a mano con
  botón para borrarlo individual.
- **Línea horizontal**: ya estaba (tanda anterior), sin cambios.
- **Línea de tendencia** y **regla de medición** (nuevas): `lightweight-
  charts` v4.2.3 sí trae una capa de dibujo interactiva — la API de
  "primitives" (`ISeriesPrimitive`, `attachPrimitive`/`detachPrimitive`),
  solo que hay que escribir la clase que se dibuja a sí misma sobre el
  canvas (no viene una herramienta lista de fábrica como pensé al escribir
  la nota de arriba). `TrendLinePrimitive` y `MeasurePrimitive` en
  `CandleChart.tsx` hacen justo eso: convierten sus puntos (tiempo, precio)
  a coordenadas de pantalla con `chart.timeScale().timeToCoordinate()` /
  `series.priceToCoordinate()`, y se trazan con el `CanvasRenderingContext2D`
  normal a través de `target.useMediaCoordinateSpace()` (de la librería
  `fancy-canvas`, dependencia transitiva de lightweight-charts — se agregó
  como dependencia directa en `package.json` porque ahora se importa su tipo
  a mano). Interacción: un menú "Dibujar" elige la herramienta activa
  (ninguna es el estado normal); horizontal necesita un clic, tendencia y
  regla necesitan dos (el primero se guarda en `pendingPointRef` mientras
  se espera el segundo). Ningún dibujo se guarda en ningún lado todavía —
  cambiar de símbolo los borra todos, para no dejar, por ejemplo, una línea
  de AAPL a $150 pegada sobre un gráfico de GLD en otro rango de precio.
- **Tendencia de regresión** (canal de regresión estadística) sigue
  pendiente — necesita calcular una regresión lineal sobre el rango
  elegido y dibujar la línea central más las bandas de desviación, encima
  de la misma infraestructura de primitives ya montada; es más cálculo que
  las otras dos, no más infraestructura nueva.
- **Fondos de color por sesión** también sigue pendiente — technically
  posible con `paneViews()`/`zOrder: "bottom"` de la misma API de
  primitives (dibujar rectángulos de fondo por rango de tiempo), pero
  todavía no se ha hecho.

## Canal de regresión y fondos por día (18 sept. 2026, misma tanda)

Cierra casi toda la lista original de 15 puntos del video.

- **Canal de regresión** (`RegressionChannelPrimitive`): cuarta herramienta
  del menú "Dibujar" — dos clics eligen el rango, y a partir de ahí calcula
  una regresión lineal (mínimos cuadrados) sobre el cierre de las velas
  cargadas en ese rango, más dos bandas a ±2 desviaciones estándar de los
  residuos (el mismo concepto que Bollinger, pero contra una línea de
  tendencia en vez de una media simple). A propósito **no** guarda los
  puntos calculados sino el rango de tiempo y una función `getCandles` —
  así, si llegan velas nuevas dentro de ese rango (el marco intradía se
  actualiza cada 5 min), el canal se recalcula solo en el próximo
  repintado, en vez de quedar congelado con el cálculo del momento en que
  se dibujó.
- **Fondos por día** (`DayBandsPrimitive`, checkbox en "Indicadores"): al
  repasar el video se cayó en cuenta de que lo que parecían "fondos de
  sesión" (pre-mercado/regular/cierre) en realidad no se puede replicar
  con datos reales — el plan gratuito de Twelve Data no trae velas de pre
  y post mercado en el historial (`getCandles()`), solo la sesión regular,
  así que un fondo por sesión se vería como un solo color de punta a
  punta, sin ninguna alternancia. Se implementó en cambio lo que sí se
  puede mostrar de verdad con los datos que hay: un tinte dorado casi
  imperceptible alternado por **día de calendario**, para separar
  visualmente un día de mercado del siguiente en los marcos intradía — el
  mismo efecto visual de "franjas" del video, con datos reales en vez de
  inventados. Se dibuja con `drawBackground` (capa detrás de las velas) y
  solo aplica a marcos intradía (5m a Hora); en Día/Semana/Mes cada vela ya
  es un día completo o más, así que alternar por día ahí sería rayar cada
  vela por separado.

Con esto, de las 15 cosas del video solo faltan **alertas de precio** y
**compra/venta simulada** — los dos sistemas grandes que Alejo decidió
dejar para una conversación aparte.

## Bug real: los dibujos con dos puntos no eran de verdad libres (19 sept. 2026)

Alejo probó Tendencia y dijo que la línea salía "rota" y que quería poder
marcarla "libre" — no que el programa la decidiera. La causa tenía dos
capas:

1. **De diseño**: Tendencia/Regla/Regresión se dibujaban con dos clics
   sueltos (clic en el punto A, clic en el punto B) sin ver nada entre
   medio — el resultado aparecía de golpe después del segundo clic, sin
   ninguna vista previa. Cualquier cosa rara en el segundo punto se sentía
   como que "el programa dibujó mal", no como algo que el usuario hizo a
   propósito.
2. **De código, real**: `TrendLinePrimitive`, `MeasurePrimitive` y
   `RegressionChannelPrimitive` leían sus puntos (`p1`/`p2` o
   `fromTime`/`toTime`) desestructurados una sola vez, arriba de
   `paneViews()`. Si algo movía esos valores después de creado el objeto,
   la función `draw()` seguía usando los de siempre — porque los había
   capturado por valor en ese momento, no una referencia viva al objeto.
   No hacía falta para el modelo de "dos clics" (el objeto se creaba ya
   con sus puntos finales), pero era la razón de fondo por la que un
   dibujo que se moviera después de creado no iba a funcionar nunca.

Los tres cambiaron a **clic, arrastrar, soltar** — como cualquier
herramienta de dibujo real. Para eso:

- Cada clase ahora expone `attached(param)` (lifecycle de
  `ISeriesPrimitive` — Vercel/TradingView lo pasa solo al adjuntar el
  objeto con `series.attachPrimitive()`) para guardarse `requestUpdate`, y
  un método (`setPoints`/`setRange`) que cambia sus puntos Y llama a
  `requestUpdate()` — sin eso, mover el punto mientras se arrastra no
  repintaría nada, lightweight-charts no tiene forma de saber que algo
  cambió si no se le avisa.
- `draw()` ahora lee `primitive.p1`/`primitive.p2` (una referencia viva al
  objeto, no una copia) en cada llamada, así que si `setPoints()` los
  cambió hace un milisegundo, `draw()` ya ve el valor nuevo.
- La interacción usa `chart.subscribeCrosshairMove()` (que ya trae la
  conversión de píxel a tiempo/precio hecha) para seguir el cursor, y
  `mousedown`/`mouseup` nativos del navegador solo para marcar cuándo
  empieza y termina el arrastre — `mouseup` está en `window`, no en el
  contenedor del gráfico, para que soltar el botón fuera del gráfico
  también cierre el arrastre. Un arrastre demasiado corto (básicamente un
  clic sin mover el mouse) se descarta en vez de dejar una línea de un
  solo punto.
- Horizontal se queda con un solo clic — ya era "libre" de por sí: el
  usuario decide exactamente el precio con ese único clic, no hay nada que
  arrastrar.

## Tendencia/Regla: posición lógica en vez de tiempo, y editables después de trazadas (19 sept. 2026)

El arreglo de clic-arrastrar-soltar de arriba resolvió la UX pero dejó dos
cosas sueltas que Alejo señaló con un segundo video comparando contra
TradingView: (1) sus tirones "libres" pueden terminar en el espacio en
blanco después de la última vela, y los míos no podían, y (2) en
TradingView una línea ya trazada se puede volver a agarrar de cualquiera
de sus dos puntas para subirla o bajarla, sin borrar y repetir.

**Causa real de (1)**: los puntos se guardaban como `UTCTimestamp` (tiempo
absoluto), y `chart.timeScale().timeToCoordinate()` /
`coordinateToTime()` devuelven `null` fuera del rango de tiempo de las
velas realmente cargadas. No es un límite arbitrario del código, es cómo
funciona `lightweight-charts`: sin una vela real en ese tiempo, no hay
tiempo que convertir. El espacio en blanco después de la última vela
(donde SÍ se puede dibujar en TradingView) queda fuera de ese rango por
definición.

**Arreglo**: `DrawPoint` pasó de `{ time, price }` a `{ logical, price }`
— posición lógica (índice de barra, puede tener decimales y salirse del
rango 0..última vela) en vez de tiempo absoluto. `chart.timeScale()` sabe
convertir posición lógica a píxel (`logicalToCoordinate`) y viceversa
(`coordinateToLogical`) extrapolando en línea recta hacia ambos lados,
sin necesitar una vela real ahí — por eso sí funciona en el espacio en
blanco. `TrendLinePrimitive`, `MeasurePrimitive` y
`RegressionChannelPrimitive` (y el helper nuevo `logicalToX`) usan esta
conversión en vez de la de tiempo; `RegressionChannelPrimitive`
puntualmente recorta el rango lógico a las velas que sí existen
(`Math.round` + clamp contra `getCandles().length`) antes de calcular la
regresión, porque ese cálculo sí necesita datos reales, no solo una
posición en el eje.

**Arreglo de (2)** — editar después de trazado: cada primitivo ya sabía
dibujar círculos en sus extremos; se les agregó `hitTestHandle(x, y)`
(distancia en píxeles contra cada punta, `HANDLE_HIT_RADIUS = 10`) para
saber si un clic cayó sobre una de ellas. La interacción, en el mismo
`mousedown`/`subscribeCrosshairMove`/`mouseup` que ya existía:

- `mousedown` con `drawTool` en `"none"` (no se está dibujando nada
  nuevo) recorre las tendencias y reglas ya trazadas (`trendLineObjectsRef`
  / `measureObjectsRef`) llamando `hitTestHandle` con la última posición
  conocida del cursor. Si golpea una, guarda en `editingRef` cuál
  primitivo y cuál punta (`p1`/`p2`), y apaga `handleScroll`/`handleScale`
  del gráfico — si no, cada intento de mover la punta también arrastraría
  el gráfico entero por debajo.
- Mientras `editingRef` está activo, `onCrosshairMove` mueve esa punta
  específica (`setPoints`) en cada frame en vez de tratar el movimiento
  como un dibujo nuevo — el mismo repintado en vivo que ya tenía el
  dibujo inicial, pero sobre un objeto existente.
- `mouseup` confirma la posición final de vuelta en el estado de React
  (`trendLines`/`measureLines`, lo que ve el panel de Objetos) y
  reactiva `handleScroll`/`handleScale`.

Deliberadamente no se tocó: líneas horizontales (un solo clic ya elige el
precio exacto, no aplica) y el canal de regresión (el usuario solo pidió
esto para Tendencia y Regla en el video).

## Regla: flecha central y colores un poco más oscuros (19 sept. 2026)

Retoque puramente visual pedido por Alejo sobre `MeasurePrimitive`: una
flechita en el centro del recuadro (triángulo relleno, apunta hacia
arriba o hacia abajo según `p2.price >= p1.price`) para leer sube/baja de
un vistazo, sin depender solo de la etiqueta de texto. Se salta el dibujo
si el recuadro es más chico que la flecha (mediciones muy cortas) para
que no se desborde.

De paso, el verde/rojo (los mismos de TradingView, `#089981`/`#F23645`)
bajaron a un 80% de brillo (`#067A67`/`#C22B37`) — mismo tono, un poco
más oscuros, para que no compitan tanto con las velas ni con la flecha
nueva.

## Cuadro de texto libre (19 sept. 2026)

Nueva herramienta en "Dibujar" (`TextBoxState`): un cuadro que se coloca
con un clic, se puede agrandar/achicar, escribir dentro y mover por el
gráfico — a diferencia de los demás dibujos, **no es un
`ISeriesPrimitive`** (canvas), es un `<div>` de verdad superpuesto. La
razón es simple: hace falta contenido editable de verdad (escribir,
seleccionar, pegar el cursor donde uno quiera), y eso no existe sobre un
canvas — habría que reinventar un editor de texto a mano.

- **Posición vs. tamaño**: solo la esquina superior izquierda
  (`logical`/`price`, igual que los demás dibujos) seguía al gráfico al
  hacer pan/zoom — se recalcula en píxeles (`textBoxPixels`) en los
  mismos disparadores que ya usaba la insignia de "próxima vela"
  (`updatePriceY`, reutilizada para las dos cosas). El tamaño
  (`width`/`height`) es un rectángulo fijo en píxeles, independiente del
  zoom — TradingView tampoco escala sus cuadros de texto con el zoom.
- **Dónde vive en el DOM**: como **hermano** de `containerRef` (el `<div>`
  vacío donde `lightweight-charts` mete sus propios canvas), no como
  hijo — así un clic sobre un cuadro de texto nunca atraviesa el
  `mousedown` nativo del gráfico (que solo escucha eventos que de verdad
  se originan dentro de `containerRef`), sin tener que pelear con el
  orden de `stopPropagation` entre el sistema de eventos de React y un
  listener nativo agregado a mano.
- **Arrastrar/redimensionar**: mismo patrón que agarrar el tirador de una
  Tendencia (`hitTestHandle`), pero en DOM en vez de canvas —
  `mousedown` en la franja superior o en la esquina inferior derecha
  agrega listeners de `mousemove`/`mouseup` a `window`, convierte el
  delta en píxeles de vuelta a lógica/precio (para la posición) o lo
  aplica directo (para el tamaño, que es puramente en píxeles), y los
  quita al soltar.
- **Editar el texto**: `contentEditable`, no un `<textarea>` controlado
  por React — si el texto se pusiera de vuelta desde el estado en cada
  `onInput`, pelearía con la posición del cursor mientras se escribe. El
  `ref` callback solo pone `textContent` la primera vez que ve ese nodo
  (compara contra lo ya guardado en `textBoxContentRefs`), nunca de
  nuevo en renders posteriores.
- Un cuadro recién creado queda pendiente de foco
  (`pendingFocusTextBoxIdRef`) y se enfoca solo, con el cursor
  seleccionando todo el texto por defecto, apenas termina de pintarse —
  para escribir de inmediato sin un clic extra.

Después del primer pase Alejo pidió tres cositas más: centrar el texto y
agrandar/achicar la letra. Se agregó `fontSize`/`align` a `TextBoxState`
y una mini barra de tres botones (`A-`/`A+`/`C`) dentro de la misma
franja naranja de arriba, a la izquierda del área de arrastre. Cada
botón corta la propagación en su propio `mousedown` (no en `onClick`)
para no disparar el arrastre del cuadro completo, que escucha ese mismo
evento un nivel más arriba — el `onClick` sigue llegando normal porque
solo se cortó la propagación, no el evento en sí.

## Incidente: push que no disparó el despliegue automático (18 sept. 2026)

El `git push` de la tanda de tendencia/regla llegó bien a GitHub (commit
`cd18d2a`), pero por primera vez en toda la sesión Vercel **no lo detectó
solo** — el dashboard se quedó mostrando el despliegue anterior como si
nada nuevo hubiera llegado. La integración Git seguía conectada
normalmente (`/settings/git`), así que no fue un problema de configuración.

Se creó un **Deploy Hook** (`/settings/git` → "Deploy Hooks", rama `main`,
nombre `manual-redeploy`) — una URL que, al recibir un POST, le pide a
Vercel que despliegue esa rama sin depender del webhook de GitHub. Se dejó
guardado a propósito como respaldo (no expone nada sensible, solo dispara
un build). Si un push no aparece en Vercel después de un par de minutos,
usar ese hook en vez de esperar o reintentar el push.

Ojo con un detalle: el primer disparo del hook se quedó atascado en
"Initializing" varios minutos sin arrancar el build — se canceló y se
volvió a disparar, y ese segundo intento sí construyó normal en ~20s.
Además, un despliegue creado por Deploy Hook puede quedar marcado
**"Staged"** con "Assigning Custom Domains: Skipped" — es decir, se
construye bien pero **no queda apuntado al dominio de producción solo**.
Hay que entrar al despliegue y usar el menú "···" → **Promote** a mano
para que el dominio real (`1-ermillondedolares-in8t.vercel.app`) empiece a
servirlo — si no, el sitio real sigue mostrando la versión anterior aunque
el despliegue diga "Ready".

## Rediseño visual — arranque: logo real y paleta azul/verde oliva (19 sept. 2026)

Alejo pidió pasar a la parte gráfica del sitio: mandó un video de un
sitio de referencia (seminario de otro economista) para inspirarse, y
después el archivo real del logo — un oso y un toro dorados/bronce con
un gráfico de velas esmeralda entre ambos, más el texto "1ER MILLÓN DE
DÓLARES" en oro debajo.

**Contradicción real que apareció al comparar**: en el video Alejo
describió querer "un azul muy bonito, ese verde oliva" — pero el logo
que mandó no tiene nada de azul, es oro + esmeralda. Antes de tocar
código se armó un Artifact comparando las dos direcciones (oro/esmeralda
del logo real vs. azul/oliva de su descripción) con el logo real puesto
encima de cada una, para que eligiera viendo en vez de a ciegas. Eligió
**azul + verde oliva** — es decir, el logo queda como una pieza dorada
destacada sobre un fondo que no comparte sus colores, a propósito.

**Implementado, alcance: solo el homepage público** (`src/app/page.tsx`),
no toda la app:

- `public/logo.png` (el archivo original, oso+toro+texto, fondo
  transparente) y `public/logo-icon.png` (recortado solo al emblema,
  sin el texto — el recorte se hizo detectando por código dónde
  terminaba el ícono y empezaba el bloque de texto, no a mano) para el
  logo compacto del header.
- Nueva clase `.hero-brand-bg` en `globals.css` — **no** se tocaron los
  tokens `--bg`/`--gold` de `:root`, que sigue usando el resto del sitio
  (Sala de Trading, admin, etc.) para su estética de terminal oscura sin
  cambios. El fondo nuevo (degradado azul marino → verde oliva oscuro,
  más un patrón sutil de puntos vía `radial-gradient` repetidos, sin
  librería ni canvas) vive en esa clase y solo se aplica a la sección
  del hero del homepage.
- Botón CTA nuevo ("Empezar en la academia" → `/introduccion`) en azul
  (`#4c8fd1`), primer llamado a la acción real que tiene el homepage.

**Pendiente de esta misma iniciativa**: qué incluye la suscripción, qué
aprenderás, ganancias semanales de alumnos — inspiradas en el sitio de
referencia pero con contenido propio. Testimonios (ver siguiente
sección) ya quedó resuelto.

## Repositorio de testimonios — Vercel Blob + Redis (19 sept. 2026)

Siguiendo con el rediseño: Alejo quiere poder ir subiendo, día a día, un
testimonio corto (imagen o video + texto + nombre) sin tener que
pasármelo por chat cada vez — un "repositorio" de verdad, no una lista
fija en el código como `modules` en `page.tsx`.

**Dónde vive cada cosa:**

- **Archivos (imagen/video)** → **Vercel Blob**, un almacenamiento de
  objetos nuevo para este proyecto (se activó desde el dashboard de
  Vercel — Storage → Create Database → Blob — con la casilla "Add a
  read-write token" marcada para que quedara `BLOB_READ_WRITE_TOKEN` en
  Production y Preview). Local no tiene ese token configurado (mismo
  criterio del resto del proyecto: sin la llave, esa pieza no funciona
  pero tampoco tumba nada) — se probó en local que la UI y las validaciones
  de tipo compilan bien, pero la subida real de un archivo solo se puede
  verificar en producción.
- **Texto (nombre, testimonio, URL del archivo, tipo, fecha)** → el
  mismo Redis (Upstash) que ya usaba `watchlist.ts` — una lista bajo la
  llave `testimonials:list`, sin vencimiento, tope de 60 registros (los
  más viejos se caen solos). No hizo falta ninguna base de datos nueva
  para esto.

**Piezas nuevas:**

- `src/lib/testimonials.ts` — `getTestimonials`/`addTestimonial`/
  `removeTestimonial`, mismo patrón de "fallar en silencio sin las
  llaves puestas" que ya usa el resto del proyecto.
- `POST`/`DELETE /api/admin/testimonials` — protegidas con `isAdmin()`
  (el mismo helper de `/admin`). `POST` recibe `multipart/form-data`
  (archivo + nombre + texto), valida tipo (imagen/video) y tamaño (8 MB
  imagen, 60 MB video), sube a Blob y guarda el registro en Redis. Si el
  registro no se pudo guardar, borra el archivo que ya había subido a
  Blob en vez de dejarlo huérfano.
- `/admin/testimonios` — página nueva (protegida), formulario de subida
  + galería de lo ya subido con botón de borrar. Enlazada desde `/admin`.
- `TestimonialsMarquee` — componente de **servidor** (no hace falta
  `"use client"`, el movimiento es puro CSS) que pinta el carrusel en el
  homepage: dos filas moviéndose en direcciones opuestas
  (`@keyframes marquee-left`/`marquee-right` en `globals.css`), cada
  fila con su contenido duplicado una vez para que el bucle no se note,
  en pausa al pasar el mouse y quieto del todo con
  `prefers-reduced-motion`. Fondo crema/blanco (`#f4f1e8`), a propósito
  distinto del azul/oliva del hero — mismo criterio que se explicó a
  Alejo: un testimonio se lee mejor en una tarjeta clara, y separa
  visualmente "esto lo dice la gente" de "esto lo decimos nosotros". Si
  no hay testimonios todavía, el componente no pinta nada (`return
  null`) — no se le muestra una sección vacía a un visitante real.

**Bug evitado — la página se iba a quedar estática de por vida:**
`Home()` pasó a ser `async` para poder leer `getTestimonials()` en el
servidor, pero Next.js detectó que la página no depende de nada dinámico
(sin cookies/headers/params) y la iba a dejar **prerenderizada en el
build** — un testimonio nuevo subido desde `/admin/testimonios` nunca
habría aparecido en el sitio real sin un redeploy completo, sin importar
cuántos se subieran. Se agregó `export const revalidate = 60;` en
`page.tsx` (ISR) para que la página se vuelva a generar como mucho una
vez por minuto — sin esto, la funcionalidad ENTERA de "ir subiendo
testimonios" habría quedado rota en silencio, sin ningún error visible
en build ni en runtime.

## Bug real: subir un video de testimonio fallaba en producción (19 sept. 2026)

Alejo probó `/admin/testimonios` en producción con un video real y le
salió "no se pudo subir el archivo (¿está configurado el Blob store?)"
— el Blob store sí estaba bien configurado, el problema era otro.

La primera versión mandaba el archivo como `multipart/form-data` a un
`POST` normal en `/api/admin/testimonials`, que lo recibía en el
servidor y recién ahí lo subía a Blob. Eso funciona con imágenes chicas,
pero **las Serverless Functions de Vercel rechazan cualquier cuerpo de
petición de más de ~4.5 MB** — un límite de la plataforma, no algo que
se pueda subir con configuración. Cualquier video real lo iba a superar
siempre, sin importar el límite de 60 MB que el código intentaba
permitir.

Arreglo: subida **directa del navegador a Blob**, sin pasar por nuestro
servidor en absoluto (`@vercel/blob/client`, función `upload()`):

- `AdminTestimonialsManager` llama `upload()` con `handleUploadUrl:
  "/api/admin/testimonials/upload"` y manda nombre/texto en
  `clientPayload` (un string, no hay otro canal para pasar datos extra
  junto con el archivo en este flujo).
- La ruta nueva (`upload/route.ts`) usa `handleUpload` de
  `@vercel/blob/client`: en `onBeforeGenerateToken` valida `isAdmin()` y
  el tamaño máximo según el tipo de archivo (leído del `clientPayload`);
  en `onUploadCompleted` — un webhook que Vercel Blob le pega a esta
  misma ruta cuando el archivo YA terminó de subirse — recién ahí se
  guarda el registro en Redis.
- Como el registro real se crea de forma asíncrona (el webhook), el
  navegador arma una versión "optimista" del testimonio para la lista
  apenas `upload()` resuelve, en vez de esperar una respuesta que no va
  a llegar por ese mismo camino.

`onUploadCompleted` necesita que el despliegue sea alcanzable desde
internet para que Vercel se lo pueda pegar — **no dispara en local**,
mismo límite que ya se había aceptado para todo lo de Blob en este
proyecto: la subida de punta a punta solo se puede probar en
producción.

## Bug real #2: el Blob store había quedado en modo "Private" (19 sept. 2026)

Con la subida directa del navegador arreglada, Alejo probó de nuevo con
un archivo real y esta vez se quedó pegado en "Subiendo…" sin terminar
nunca — "parece que está en un bucle", como él lo describió. Y sí,
literalmente lo estaba: `@vercel/blob` reintenta automáticamente
cuando la petición de subida falla por lo que parece un error de red.

Diagnóstico (reproducido a mano con `fetch` desde la consola del
navegador, sin pasar por la librería, para descartar que fuera un bug
de la librería en sí): la subida directa al archivo SÍ le pide un token
a nuestro servidor correctamente (200 OK), pero el `PUT` real del
archivo — que va del navegador directo a `vercel.com/api/blob`, nunca
toca nuestro servidor — fallaba siempre con: *"blocked by CORS policy:
No 'Access-Control-Allow-Origin' header"*.

La causa real, encontrada revisando el store en el dashboard de Vercel
(Storage → el store → Settings → Store Access): quedó creado en modo
**"Private"** — la opción marcada "Recommended" y la que queda
seleccionada por defecto si no se cambia a propósito, algo que se pasó
por alto al crearlo la primera vez. Un store privado **nunca** sirve un
archivo con acceso público sin importar qué le pida el código
(`access: "public"` en `put()`/`upload()` no tiene ningún efecto ahí) —
y ese modo **no se puede cambiar después de creado**, según la propia
página de configuración del store.

Arreglo: no se pudo borrar el store privado (el clasificador de
permisos de Claude Code bloqueó el borrado — "Cloud Storage Mass
Delete" — incluso con a Alejo confirmando explícitamente en el chat, a
propósito, como protección extra que ni su propia confirmación
puede saltarse desde ahí; queda pendiente que él lo borre a mano desde
el dashboard, ya que está vacío y no se pierde nada). En su lugar se
creó un store **nuevo** en modo **Public**, con prefijo de variables
`BLOB_PUBLIC_*` (el prefijo por defecto, `BLOB_*`, ya estaba tomado por
el store privado). Como `@vercel/blob` busca por defecto
`BLOB_READ_WRITE_TOKEN` a secas, hubo que pasar
`token: process.env.BLOB_PUBLIC_READ_WRITE_TOKEN` a mano tanto en
`handleUpload` (`upload/route.ts`) como en `del()` (`route.ts`) — sin
esto, seguiría usando (o buscando en vano) el token del store privado
equivocado.

**Para la próxima vez que se cree un recurso de Storage en este
proyecto**: revisar con cuidado cualquier opción de "Access"/visibilidad
antes de confirmar, sobre todo si la opción recomendada por Vercel no es
la que hace falta — acá "Recommended" significaba "más seguro por
defecto", no "lo que este proyecto necesita".

## Pantalla dividida en la Sala de Trading (24 sept. 2026)

Pedido de Alejo, con capturas de ProRealTime como referencia: "Dividir
verticalmente" para ver **máximo dos gráficos** a la vez — lo plantea como
la innovación frente a uCharts, que solo deja ver uno. Se aprobó el plan
antes de construir, con dos decisiones suyas: los dibujos son **por
acción** (una línea en SPY aparece en cualquier gráfico que muestre SPY), y
se abre con **clic derecho y además un botón** en la barra del gráfico (a la
gente ya le costó encontrar cómo cerrar Favoritas).

**Cómo quedó** (`TradingRoom.tsx` + props nuevas de `CandleChart`):

- Clic derecho en una parte vacía del gráfico → "Dividir verticalmente" /
  "Cerrar este gráfico" (sobre una flecha o cuadro sigue saliendo su menú
  de color). Lo mismo con el botón ◫ / ⊠ al lado del ☀.
- Cada gráfico tiene su acción, marco, indicadores y paneles propios. El
  último que se tocó queda seleccionado (borde dorado) y el encabezado de
  la sala (precio, cierre de ayer, apertura, volumen) muestra su acción.
- El gráfico nuevo arranca como copia del actual (igual que ProRealTime).
- Se recuerda entre visitas (`localStorage["millon:sala:diseno"]`): si
  estaba dividida, cuál estaba seleccionado y qué acción/marco había en
  cada lado.
- Por debajo de 768 px de ancho no se ofrece dividir (se muestra solo el
  seleccionado): dos gráficos no caben en un celular.
- `timeScale.lockVisibleTimeRangeOnResize`: al dividir (o abrir
  Favoritas) se conserva el tramo de tiempo visible y las velas se achican.
  Sin esto el gráfico conservaba el tamaño de las velas y a la mitad del
  ancho quedaban 2 velas a la vista.

**Cambio de fondo: los dibujos se guardan por hora, no por índice de
vela.** Hasta ahora se guardaban con el `logical` de la pantalla (ver
"Tendencia/Regla: posición lógica en vez de tiempo" más arriba). Eso fallaba
de dos formas, y la pantalla dividida volvía la primera inevitable:

1. El mismo índice es otra hora en otro marco — SPY 1h y SPY 5m ponían la
   misma línea en sitios distintos (y ya pasaba al cambiar de marco con un
   solo gráfico).
2. El tramo cargado es de N velas fijas: cada día entran nuevas y salen las
   más viejas, así que todos los índices se corren y los dibujos guardados
   se iban moviendo solos con los días.

Ahora en pantalla se sigue usando `logical` (así se puede seguir dibujando
en el espacio en blanco a la derecha — la razón de la decisión del 19
sept.), pero al **guardar** cada punto se convierte a hora
(`logicalATiempo`) y al **cargar** de vuelta a índice con las velas que haya
(`tiempoALogical`, búsqueda binaria; fuera del tramo extrapola con la
duración de vela del marco, `SEGUNDOS_POR_VELA`). Detalles:

- Si un punto sigue en la misma vela que lo guardado, se conserva la hora
  guardada exacta: un dibujo hecho en 5m, visto en 1h, cae en la vela de la
  hora y no debe "redondearse" a ella al guardar.
- El borde derecho de un cuadro se guarda al FINAL de su vela
  (`finDeVela`): el cuadro que enmarca la vela de 1h de las 12:00, en 5m,
  cubre de 12:00 a 12:55 y no una sola velita.
- Los dibujos se recargan cuando cambia la clave `símbolo|marco|hora de la
  primera vela|versión` — o sea al cambiar de marco, cuando se corre el
  tramo, o cuando el otro gráfico guardó cambios (aviso
  `millon:dibujos` entre los dos, y el evento `storage` entre pestañas). Se
  conserva el `id` de cada dibujo, así su ojo oculto/visible se mantiene.
- Guardar no escribe (ni avisa) si el resultado es igual a lo guardado —
  así la recarga en el otro gráfico no rebota de un lado a otro.
- Lo guardado antes con el formato viejo (`logical`) se lee tal cual y
  queda convertido a hora en el primer guardado.

**Bug real encontrado probando**: enganchar un primitivo
(`series.attachPrimitive`) NO repinta el gráfico — `lightweight-charts`
solo le entrega `requestUpdate`. Al cargar un dibujo desde el otro gráfico,
sin que nadie toque este, quedaba invisible hasta pasar el mouse por
encima. Todos los primitivos piden repintado en `attached()`.

**Ojo al probar en el panel del navegador**: con un tamaño de ventana
emulado (`resize_window` a medida) el navegador NO entrega
`requestAnimationFrame`, así que el gráfico no se repinta y las capturas
llegan atrasadas — parece un bug y no lo es. Para probar la pantalla
dividida se bajó temporalmente el mínimo de 768 px a 500 px con el tamaño
normal del panel (y se devolvió).

### Corrección: los dibujos son por acción Y por marco (26 sept. 2026)

Alejo encontró que lo dibujado en 1h aparecía en Día (y en Mes): un cuadro
que enmarcaba una vela de 1h se veía enorme en Día. Decisión suya: cada
marco guarda sus propios dibujos. La llave pasó de `millon:draw:SÍMBOLO` a
`millon:draw:SÍMBOLO:MARCO` (p. ej. `millon:draw:SPY:1h`). En la pantalla
dividida, dos gráficos comparten dibujos solo si tienen la misma acción Y
el mismo marco (el aviso `millon:dibujos` lleva ahora también el marco).

Migración: lo guardado con la llave vieja (compartida por todos los
marcos) no dice en qué marco se hizo, así que se pasa a **1h** — el marco
por defecto, donde más se trabaja — la primera vez que se abre la acción en
1h, y la llave vieja se borra (para que no reaparezca en Día/Mes).

Se mantiene el guardado por hora (no por índice de vela): sigue haciendo
falta para que los dibujos no se corran con los días.

## Clases con el profesor Miguel — por Zoom (26 sept. 2026)

Paso 2 del plan de lanzamiento acordado con Alejo (2 clases → 3 planes →
4 Botón de Bold → 5 control en admin → 1 dominio/Clerk producción, al
final). Las clases van por **Zoom** mientras tanto: transmitir dentro de la
página no sirve todavía porque mucha gente mira la clase desde el celular
y opera desde el mismo celular.

- Pestaña **"Clases con el profesor Miguel"** en el menú (se quitó "en
  construcción · fase 1"). El menú completo necesita ~1080 px: por debajo
  de `xl` pasa al botón ☰ (a 1024 px se salía por la derecha).
- Nueva sección de acceso `clases` en `scopes.ts` → aparece sola como
  columna en la tabla de /admin, con el mismo "dar acceso por N días" que
  las demás. La tabla ahora distingue **"venció [fecha]"** (tuvo y no
  renovó) de "—" (nunca tuvo), para ver quién no pagó.
- Regla (`getAccesoClase` en `subscription.ts`): entra quien tenga
  `clases` vigente; y el día marcado como **clase abierta del plan
  básico** entra también quien tenga la Sala de Trading pagada o dada a
  mano (la semana gratis NO cuenta). "Eliminar acceso" en Clases lo deja
  afuera también ese día.
- `/clases`: el botón "Entrar a la clase" NO lleva el link de Zoom —
  apunta a `/api/clases/entrar`, que revisa el acceso, anota el ingreso y
  recién ahí redirige a Zoom. Quien no tiene acceso no puede sacar el link
  del código de la página. (Quien entra sí puede compartirlo: Alejo lo
  sabe y lo acepta por ahora.)
- `/admin/clases`: link de Zoom de la semana, día de la clase abierta del
  básico, y **"Quién entró a la clase"** (registro de clics en "Entrar",
  lo más cercano a asistencia: la página no ve quién está dentro de Zoom).
  Todo en Redis (`clases:config`, `clases:ingresos`, tope 2000).
- Probado en local: /clases sin sesión, la ruta de entrada devuelve a
  /clases sin filtrar el link, menú en 1024 px, y el admin de clases con
  datos de ejemplo (página temporal, borrada). Guardar config y el acceso
  con cuenta real solo se pueden probar en producción (en local no hay
  Redis ni sesión de admin).

## Planes y Sala de Trading solo con plan o semana gratis (26 sept. 2026)

Paso 3 del plan de lanzamiento. Planes definidos por Alejo, todos en un
solo lugar (`src/lib/planes.ts`, lo usan la página y el cobro del paso 4):

| Plan | Precio (USD) | Incluye |
|---|---|---|
| Básico | $12.59 / mes | Sala de Trading 1 mes + la clase abierta (día que marca el admin) |
| **Premium** (destacado) | $25.99 / semana | Clases 1 semana + Sala de Trading 1 mes |
| Anual | $120 / año | Solo Sala de Trading 1 año (≈ $10/mes) |

Promoción del Premium (decisiones de Alejo con ejemplo de fechas): al
pagar la **4ª semana seguida**, las gráficas quedan por **2 meses desde
ese pago**. "Seguidas" = paga a más tardar **3 días** después de que se
le venció la semana anterior; si se pasa, el conteo vuelve a 1. Se aplica
en el paso 4 (cobro con Bold).

- `/suscripcion` muestra los tres planes (se quitó la membresía única de
  $25/mes y la lista "En camino") y, si hay sesión, "Tu acceso: Sala hasta
  X, Clases hasta Y".
- **La Sala de Trading deja de ser pública.** Entra quien tenga plan o
  acceso manual, y quien se registra durante su **semana gratis** (con
  todas las acciones). Sin cuenta: "Pruébala gratis por una semana" +
  planes. Pasada la semana: "Inscríbete para seguir en la Sala" + planes.
  La portada sigue mostrando a todos el gráfico pequeño con SPY, QQQ, META
  y GLD (`FREE_SYMBOLS`, sin cambios).
- Mientras el cobro en línea no esté (paso 4), el botón de cada plan dice
  "Pago en línea muy pronto".

## Cobro con el Botón de pagos de Bold (26 sept. 2026)

Pasos 4 y 5 del plan de lanzamiento. Se eligió **Bold** (Alejo ya cobra
con Bold) y su **Botón de pagos** en vez del Link de pago: con el link,
Bold no le dice a la página QUIÉN pagó; con el botón, cada pago va
amarrado a la cuenta y el acceso se abre solo. **Bold no tiene
suscripciones** (cobro automático mensual): cada pago es único; lo
automático es que el acceso se abre y se vence solo, y la Sala avisa 3
días antes ("Renovar"). MercadoPago sí cobraba solo, pero se prefirió
Bold por ya estar configurado.

Cómo funciona (`src/lib/bold.ts`):
1. `/api/pagos/orden` crea la orden en Redis (`bold:orden:ID`, amarrada
   al usuario de Clerk) y la firma: SHA-256 de
   `{orden}{monto}{moneda}{llave secreta}` — nadie puede cambiar el monto.
2. `BotonPagoBold` abre la pasarela (`BoldCheckout`, librería de Bold).
3. Se confirma por dos caminos: `/pago/resultado` (al volver, **le
   pregunta a Bold** el estado por la API `payment-voucher` — el
   `bold-tx-status` de la URL no se usa) y el webhook
   `/api/webhooks/bold` (firma HMAC-SHA256 del cuerpo en base64; en
   pruebas Bold firma con llave vacía, `BOLD_PRUEBAS=1`). **En modo de
   pruebas Bold no manda webhooks**, por eso el primer camino es el que
   hace funcionar las pruebas. Candado en Redis por orden: el plan se
   aplica una sola vez aunque lleguen los dos (y se suelta si algo falla a
   mitad, para que el reintento lo aplique).
4. `calcularAcceso` (`src/lib/planesAcceso.ts`, sin dependencias para
   poder probarlo) escribe las fechas en `publicMetadata.acceso` de Clerk
   — el mismo lugar que el acceso manual de /admin — y la racha del
   Premium en `publicMetadata.premium`. Probado con fechas: el ejemplo de
   Alejo (pagos 29 sep, 6, 13, 20 oct) deja la Sala hasta el 19 dic;
   pagar 2 días tarde sigue la racha, 5 días tarde la reinicia; Básico se
   suma; Anual un año.
5. `/admin/pagos`: cada pago aprobado, plan, monto y cómo quedó el
   acceso (marca "prueba" los del modo de pruebas).

Llaves en Vercel (nunca en el código): `BOLD_IDENTITY_KEY`,
`BOLD_SECRET_KEY`, `BOLD_PRUEBAS=1` mientras sean las de pruebas. Sin
llaves, los botones dicen "Pago en línea muy pronto".

**Pendiente de confirmar en el modo de pruebas**: Bold pide el monto "sin
decimales". En USD se manda en centavos ($12.59 → 1259); si la pasarela
muestra $1,259, Bold no acepta centavos en USD. Además, **en USD Bold solo
acepta tarjeta** (no PSE ni Nequi) y convierte a pesos con la TRM del día
— decisión de negocio pendiente: USD o pesos.

## Decisiones pendientes

Ver la sección "Puntos por decidir" del organigrama de ideas. Las que
más afectan la arquitectura:

- Proveedor de datos en tiempo real (Polygon.io / Alpaca / Twelve Data
  / IEX Cloud) — condiciona cómo se construye el motor de gráficos.
- Plan de Vimeo (OTT vs Enterprise).
- Si se suma un método de pago local (PSE/Nequi vía Wompi o PayU) además
  de Stripe.

