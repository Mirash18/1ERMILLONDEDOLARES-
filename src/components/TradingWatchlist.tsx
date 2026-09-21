/**
 * Sidebar con watchlist de símbolos populares.
 * Permite cambiar de símbolo sin salir de la sala de trading.
 */
export function TradingWatchlist() {
  const symbols = [
    { symbol: "SPY", name: "S&P 500", price: 595.42, change: 2.2, positive: true },
    { symbol: "QQQ", name: "Nasdaq 100", price: 425.18, change: 1.8, positive: true },
    { symbol: "IWM", name: "Russell 2000", price: 198.54, change: -0.5, positive: false },
    { symbol: "GLD", name: "Oro", price: 212.85, change: 0.3, positive: true },
    { symbol: "TLT", name: "Bonos 20Y", price: 88.42, change: -1.2, positive: false },
    { symbol: "DXY", name: "Dólar Index", price: 104.32, change: 0.8, positive: true },
    { symbol: "BTC", name: "Bitcoin", price: 42850, change: 5.2, positive: true },
    { symbol: "NVDA", name: "NVIDIA", price: 138.45, change: 3.1, positive: true },
  ];

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-[#0b0e14]/80 backdrop-blur-sm lg:block overflow-y-auto">
      <div className="sticky top-0 border-b border-border bg-[#0b0e14] px-4 py-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-text">
          Vigilancia
        </h3>
      </div>

      <div className="space-y-1 p-3">
        {symbols.map((item) => (
          <button
            key={item.symbol}
            className="group w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold uppercase text-gold group-hover:text-gold/80">
                  {item.symbol}
                </p>
                <p className="truncate text-[11px] text-text-soft">
                  {item.name}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-xs font-medium text-text">
                  {typeof item.price === "number"
                    ? item.price > 1000
                      ? `$${item.price.toLocaleString()}`
                      : `$${item.price.toFixed(2)}`
                    : item.price}
                </p>
                <p
                  className={`font-mono text-[10px] font-semibold ${
                    item.positive ? "text-[#089981]" : "text-[#F23645]"
                  }`}
                >
                  {item.positive ? "+" : ""}{item.change.toFixed(1)}%
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Sección de análisis rápido */}
      <div className="border-t border-border px-4 py-3">
        <h4 className="mb-2 text-[10px] uppercase tracking-[0.1em] text-text-soft">
          Herramientas
        </h4>
        <div className="space-y-1">
          <button className="w-full rounded-md bg-white/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-text transition-colors hover:bg-white/10">
            Screener
          </button>
          <button className="w-full rounded-md bg-white/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-text transition-colors hover:bg-white/10">
            Heat Map
          </button>
          <button className="w-full rounded-md bg-white/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-text transition-colors hover:bg-white/10">
            Calendario
          </button>
        </div>
      </div>
    </aside>
  );
}
