/**
 * Barra de información de mercado debajo del header.
 * Muestra volumen, rango diario, capitalización, y otros datos rápidos.
 */
export function TradingInfoBar() {
  // Valores simulados
  const volume = "45.2M";
  const avgVolume = "38.5M";
  const dayHigh = 596.88;
  const dayLow = 590.12;
  const fiftyTwoWeekHigh = 612.50;
  const fiftyTwoWeekLow = 420.35;
  const marketCap = "2.95T";
  const pe = 28.4;

  return (
    <div className="shrink-0 border-b border-border bg-[#0b0e14]/50 backdrop-blur-sm">
      <div className="mx-auto max-w-[1600px] px-6 py-3">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-8">
          {/* Volumen */}
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.1em] text-text-soft">
              Vol
            </p>
            <p className="font-mono text-sm font-medium text-text">
              {volume}
            </p>
            <p className="text-[10px] text-text-soft/70">
              Prom: {avgVolume}
            </p>
          </div>

          {/* Rango diario */}
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.1em] text-text-soft">
              Rango diario
            </p>
            <p className="font-mono text-sm font-medium text-text">
              {dayLow.toFixed(2)} - {dayHigh.toFixed(2)}
            </p>
          </div>

          {/* 52 semanas */}
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.1em] text-text-soft">
              52 semanas
            </p>
            <p className="font-mono text-sm font-medium text-text">
              {fiftyTwoWeekLow.toFixed(2)} - {fiftyTwoWeekHigh.toFixed(2)}
            </p>
          </div>

          {/* Market Cap */}
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.1em] text-text-soft">
              Cap. Mercado
            </p>
            <p className="font-mono text-sm font-medium text-gold">
              {marketCap}
            </p>
          </div>

          {/* P/E */}
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.1em] text-text-soft">
              P/E
            </p>
            <p className="font-mono text-sm font-medium text-text">
              {pe.toFixed(1)}x
            </p>
          </div>

          {/* Espaciador para pantallas más pequeñas */}
          <div className="hidden md:block" />
          <div className="hidden md:block" />
          <div className="hidden md:block" />
        </div>
      </div>
    </div>
  );
}
