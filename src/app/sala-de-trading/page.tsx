import { CandleChart } from "@/components/CandleChart";
import { TradingRoomHeader } from "@/components/TradingRoomHeader";
import { TradingInfoBar } from "@/components/TradingInfoBar";
import { TradingWatchlist } from "@/components/TradingWatchlist";
import { TradingFooter } from "@/components/TradingFooter";

// Sala de trading mejorada — gráfico a pantalla completa como TradingView
// con header informativo, barra de datos de mercado, watchlist lateral,
// y footer con análisis rápido. Público, sin requerimientos de suscripción.
export default function SalaDeTrading() {
  return (
    <div className="flex h-screen flex-col bg-bg">
      {/* Header con símbolo, precio y datos principales */}
      <TradingRoomHeader />

      {/* Barra de información de mercado */}
      <TradingInfoBar />

      {/* Contenedor principal: gráfico + sidebar */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Gráfico TradingView en el centro */}
        <main className="min-h-0 flex-1 overflow-hidden px-3 py-3">
          <CandleChart fillHeight />
        </main>

        {/* Sidebar con watchlist */}
        <TradingWatchlist />
      </div>

      {/* Footer con estadísticas de mercado */}
      <TradingFooter />
    </div>
  );
}
