/**
 * Header mejorado de la sala de trading con información del símbolo en vivo.
 * Muestra símbolo actual, precio, % cambio, y hora de actualización.
 */
export function TradingRoomHeader() {
  // Valores simulados mientras se integra con datos reales
  const symbol = "SPY";
  const price = 595.42;
  const priceChange = 12.85;
  const priceChangePercent = 2.2;
  const bid = 595.40;
  const ask = 595.44;
  const lastUpdate = "14:35:22 EDT";

  const isPositive = priceChange >= 0;

  return (
    <div className="shrink-0 border-b border-border bg-gradient-to-r from-bg via-bg to-[#0d1a14]/20">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
        {/* Logo y símbolo */}
        <div className="flex items-center gap-6">
          <a
            href="/"
            className="font-display text-base tracking-tight text-text hover:text-gold transition-colors"
          >
            1er <span className="text-gold">Millón</span>
          </a>

          {/* Símbolo y precio principal */}
          <div className="flex items-baseline gap-3 border-l border-border/30 pl-6">
            <h1 className="font-display text-2xl font-semibold text-white">
              {symbol}
            </h1>
            <span className="font-display text-3xl font-medium text-white">
              ${price.toFixed(2)}
            </span>
            <span
              className={`text-lg font-semibold ${
                isPositive ? "text-[#089981]" : "text-[#F23645]"
              }`}
            >
              {isPositive ? "+" : ""}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Info de mercado */}
        <div className="flex items-center gap-8">
          <div className="flex gap-6 text-xs">
            <div>
              <p className="text-text-soft uppercase tracking-[0.1em]">Bid</p>
              <p className="font-mono text-sm font-medium text-text">
                {bid.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-text-soft uppercase tracking-[0.1em]">Ask</p>
              <p className="font-mono text-sm font-medium text-text">
                {ask.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-text-soft uppercase tracking-[0.1em]">Hora</p>
              <p className="font-mono text-sm font-medium text-text">
                {lastUpdate}
              </p>
            </div>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-3 border-l border-border/30 pl-6">
            <a
              href="/"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
            >
              ← volver
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
