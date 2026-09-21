/**
 * Footer de la sala de trading con estadísticas de mercado.
 * Muestra símbolos más activos, movers, y análisis rápido.
 */
export function TradingFooter() {
  const topMovers = [
    { symbol: "TSLA", change: 8.5, type: "up" },
    { symbol: "NVDA", change: 6.2, type: "up" },
    { symbol: "META", change: -4.1, type: "down" },
  ];

  const mostActive = [
    { symbol: "SPY", volume: "125.4M" },
    { symbol: "QQQ", volume: "98.2M" },
    { symbol: "AAPL", volume: "45.8M" },
  ];

  return (
    <div className="shrink-0 border-t border-border bg-[#0b0e14]/50 backdrop-blur-sm">
      <div className="mx-auto max-w-[1600px] px-6 py-4">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Mayores ganadores */}
          <div>
            <h3 className="mb-3 text-[10px] uppercase tracking-[0.1em] text-text-soft">
              🔥 Mayores ganadores
            </h3>
            <div className="space-y-1">
              {topMovers
                .filter((m) => m.type === "up")
                .map((mover) => (
                  <div
                    key={mover.symbol}
                    className="flex items-center justify-between rounded-md bg-[#089981]/10 px-2 py-1"
                  >
                    <span className="font-mono text-xs font-semibold text-gold">
                      {mover.symbol}
                    </span>
                    <span className="text-xs font-semibold text-[#089981]">
                      +{mover.change.toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Mayores perdedores */}
          <div>
            <h3 className="mb-3 text-[10px] uppercase tracking-[0.1em] text-text-soft">
              ❄️ Mayores perdedores
            </h3>
            <div className="space-y-1">
              {topMovers
                .filter((m) => m.type === "down")
                .map((mover) => (
                  <div
                    key={mover.symbol}
                    className="flex items-center justify-between rounded-md bg-[#F23645]/10 px-2 py-1"
                  >
                    <span className="font-mono text-xs font-semibold text-gold">
                      {mover.symbol}
                    </span>
                    <span className="text-xs font-semibold text-[#F23645]">
                      {mover.change.toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Más activos */}
          <div>
            <h3 className="mb-3 text-[10px] uppercase tracking-[0.1em] text-text-soft">
              📊 Más activos por volumen
            </h3>
            <div className="space-y-1">
              {mostActive.map((active) => (
                <div
                  key={active.symbol}
                  className="flex items-center justify-between rounded-md bg-white/5 px-2 py-1"
                >
                  <span className="font-mono text-xs font-semibold text-text">
                    {active.symbol}
                  </span>
                  <span className="text-[10px] text-text-soft">
                    {active.volume}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Línea de info y disclaimers */}
        <div className="mt-4 border-t border-border/30 pt-4">
          <p className="text-center text-[10px] text-text-soft/70">
            Datos retrasados 15 minutos • Análisis educativo, no es asesoría financiera •{" "}
            <a href="/" className="underline hover:text-text-soft">
              Volver a inicio
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
