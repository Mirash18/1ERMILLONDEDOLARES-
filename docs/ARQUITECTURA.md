# Arquitectura — 1er Millón de Dólares

Registro técnico vivo de cómo funciona la plataforma por dentro: qué se
construyó, por qué se tomó cada decisión, y qué depende de qué. Se
actualiza en cada fase — no es un documento que se escribe una vez y se
olvida.

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

La vía elegida es **TradingView Advanced Charts**: es gratuita a cambio de
mantener visible el logo de TradingView, trae 80+ herramientas de dibujo y
100+ indicadores, y se conecta a nuestra API de velas mediante un adaptador
UDF. Como regalo, resuelve de paso que la comunidad vea la misma interfaz que
ya conoce. Se solicitó a `platforms@tradingview.com` y está pendiente de
aprobación.

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

## Decisiones pendientes

Ver la sección "Puntos por decidir" del organigrama de ideas. Las que
más afectan la arquitectura:

- Proveedor de datos en tiempo real (Polygon.io / Alpaca / Twelve Data
  / IEX Cloud) — condiciona cómo se construye el motor de gráficos.
- Plan de Vimeo (OTT vs Enterprise).
- Si se suma un método de pago local (PSE/Nequi vía Wompi o PayU) además
  de Stripe.

