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
