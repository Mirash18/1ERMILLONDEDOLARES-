/**
 * Barra de información de mercado — simplificada.
 * Solo muestra: Volumen y Rango diario.
 */
export function TradingInfoBar() {
  // Valores simulados
  const volume = "45.2M";
  const dayHigh = 596.88;
  const dayLow = 590.12;

  return (
    <div className="shrink-0 border-b border-border bg-[#0b0e14]/50 backdrop-blur-sm">
      <div className="mx-auto max-w-[1600px] px-6 py-3">
        <div className="flex gap-12">
          {/* Volumen */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-soft">
              Volumen
            </p>
            <p className="font-mono text-sm font-medium text-text">
              {volume}
            </p>
          </div>

          {/* Rango diario */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-soft">
              Rango diario
            </p>
            <p className="font-mono text-sm font-medium text-text">
              {dayLow.toFixed(2)} - {dayHigh.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
