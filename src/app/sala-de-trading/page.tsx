import { TradingRoom } from "@/components/TradingRoom";

// Sala de trading — gráfico a pantalla completa como TradingView, con
// encabezado (acción, precio, cambio) y barra de datos (volumen, cierre de
// ayer, apertura de hoy) que siguen a la acción elegida en el gráfico.
// Público, sin requerimientos.
export default function SalaDeTrading() {
  return <TradingRoom />;
}
