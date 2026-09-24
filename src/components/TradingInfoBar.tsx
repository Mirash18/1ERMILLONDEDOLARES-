import type { Quote } from "@/lib/marketData";

/**
 * Barra de datos de la Sala de Trading, de la acción elegida en el gráfico:
 * volumen de ayer, cierre de ayer y apertura de hoy — la apertura en verde
 * o rojo según abrió por encima o por debajo del cierre, con la diferencia.
 * Alejo pidió cambiar el "Rango diario" por estos dos datos.
 *
 * Todo sale de la cotización real (Twelve Data); sin dato se muestra "—".
 */

// Fecha de hoy en Nueva York, AAAA-MM-DD (en-CA da justo ese formato).
function hoyNuevaYork(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatearVolumen(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

export function TradingInfoBar({
  quote,
  volumenDia,
}: {
  quote: Quote | null;
  // Suma de las velas de la última sesión en el gráfico (el volumen de la
  // cotización de Twelve Data es de un solo mercado y sale muy bajo).
  volumenDia: { fecha: string; volumen: number } | null;
}) {
  // La cotización es de la sesión de HOY solo desde la apertura. Antes (pre-
  // mercado, o fin de semana) Twelve Data sigue entregando la sesión
  // anterior: ahí el "cierre de ayer" es su último precio, y la apertura de
  // hoy todavía no existe.
  const sesionDeHoy = !!quote?.sessionDate && quote.sessionDate === hoyNuevaYork();
  const cierreAyer = sesionDeHoy ? quote?.previousClose ?? null : quote?.price ?? null;
  const aperturaHoy = sesionDeHoy ? quote?.open ?? null : null;
  // Volumen de la última sesión completa (ver CandleChart: el de la sesión
  // en curso llega incompleto de Twelve Data).
  const volumen = volumenDia?.volumen ?? null;

  const gap =
    aperturaHoy !== null && cierreAyer !== null ? aperturaHoy - cierreAyer : null;
  const gapPct = gap !== null && cierreAyer ? (gap / cierreAyer) * 100 : null;
  const abrioArriba = (gap ?? 0) >= 0;

  return (
    <div className="shrink-0 border-b border-border bg-[#0b0e14]/50 backdrop-blur-sm">
      <div className="mx-auto max-w-[1600px] px-6 py-3">
        <div className="flex flex-wrap gap-x-12 gap-y-2">
          <Dato titulo="Volumen ayer">
            {volumen === null ? "—" : formatearVolumen(volumen)}
          </Dato>

          <Dato titulo="Cierre ayer">
            {cierreAyer === null ? "—" : `$${cierreAyer.toFixed(2)}`}
          </Dato>

          <Dato titulo="Apertura hoy">
            {aperturaHoy === null ? (
              // "Aún no abre" solo si hay cotización válida de una sesión
              // anterior; un error o la carga muestran "—".
              quote?.price != null && !sesionDeHoy ? (
                <span className="text-text-soft">Aún no abre</span>
              ) : (
                "—"
              )
            ) : (
              <span className={abrioArriba ? "text-[#089981]" : "text-[#F23645]"}>
                ${aperturaHoy.toFixed(2)}
                {gap !== null && gapPct !== null && (
                  <span className="ml-2 text-xs">
                    {abrioArriba ? "+" : ""}
                    {gap.toFixed(2)} ({abrioArriba ? "+" : ""}
                    {gapPct.toFixed(2)}%)
                  </span>
                )}
              </span>
            )}
          </Dato>
        </div>
      </div>
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.1em] text-text-soft">{titulo}</p>
      <p className="font-mono text-sm font-medium text-text">{children}</p>
    </div>
  );
}
