import { CandleChart } from "@/components/CandleChart";
import { TradingRoomHeader } from "@/components/TradingRoomHeader";
import { TradingInfoBar } from "@/components/TradingInfoBar";

// Sala de trading — gráfico a pantalla completa como TradingView
// con header informativo (SPY, precio, cambio) y barra de datos
// esenciales (volumen, rango diario). Público, sin requerimientos.
export default function SalaDeTrading() {
  return (
    <div className="flex h-screen flex-col bg-bg">
      {/* Header con SPY, precio y cambio */}
      <TradingRoomHeader />

      {/* Barra con volumen y rango diario */}
      <TradingInfoBar />

      {/* Gráfico TradingView a pantalla completa */}
      <main className="min-h-0 flex-1 overflow-hidden px-3 py-3">
        <CandleChart fillHeight />
      </main>
    </div>
  );
}
