import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { CandleChart } from "@/components/CandleChart";

// Gráfico a pantalla completa — como TradingView, ThinkOrSwim o TC2000,
// sin el resto de la página alrededor. Público, igual que el de la
// portada (no requiere cuenta ni suscripción): es el mismo universo de
// símbolos que ya se ve ahí, solo que ocupando toda la pantalla.
export default function SalaDeTrading() {
  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="shrink-0 border-b border-border">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="font-display text-base tracking-tight text-text"
          >
            1er <span className="text-gold">Millón</span> de Dólares
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
            >
              ← volver
            </Link>
            <AuthStatus />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 px-3 py-3">
        <CandleChart fillHeight />
      </main>
    </div>
  );
}
