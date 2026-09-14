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
| 3 | Pagos (Stripe) + nivel $25/mes | Pendiente |
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

## Cómo va a fluir el acceso pagado (diseño, aún no implementado)

Esto es el diseño que se va a implementar en la Fase 3, dejado por
escrito de una vez para que quede claro cómo va a funcionar por dentro:

1. El usuario se suscribe → Stripe cobra los $25/mes.
2. Stripe notifica al servidor por webhook (`/api/webhooks/stripe`)
   cuando el pago se confirma, falla o se cancela.
3. El servidor actualiza el estado de la cuenta en la base de datos
   (`activo` / `vencido`).
4. Cada vez que el navegador pide datos del universo S&P 500 / Nasdaq,
   el servidor revisa ese estado **antes** de servir el dato — nunca se
   confía en lo que diga el navegador sobre si el usuario pagó o no.
5. El mismo estado se usa para dar o quitar acceso a las clases en
   Vimeo (Fase 4).

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

## Decisiones pendientes

Ver la sección "Puntos por decidir" del organigrama de ideas. Las que
más afectan la arquitectura:

- Proveedor de datos en tiempo real (Polygon.io / Alpaca / Twelve Data
  / IEX Cloud) — condiciona cómo se construye el motor de gráficos.
- Plan de Vimeo (OTT vs Enterprise).
- Si se suma un método de pago local (PSE/Nequi vía Wompi o PayU) además
  de Stripe.

