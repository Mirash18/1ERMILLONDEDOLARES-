import Link from "next/link";
import { OptionsCalculator } from "@/components/OptionsCalculator";

// Calculadora de opciones (Black-Scholes) — pública, como la Sala de
// Trading: es puro cálculo en el navegador, no cuesta ni un crédito de
// datos, así que no tiene sentido dejarla detrás de una suscripción.
export default function Calculadora() {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="font-display text-lg uppercase tracking-tight text-text"
          >
            1er <span className="text-gold">Millón</span> de Dólares
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="font-sans text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-gold"
            >
              ← volver
            </Link>
            <Link
              href="/sala-de-trading"
              className="font-sans text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-gold"
            >
              Sala de Trading
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <p className="mb-2 font-sans text-xs uppercase tracking-[0.14em] text-gold">
          Herramientas
        </p>
        <h1 className="mb-2 font-display text-2xl font-medium text-text sm:text-3xl">
          Calculadora de opciones
        </h1>
        <p className="mb-8 max-w-2xl text-sm text-text-soft">
          Precio teórico y las griegas (delta, gamma, vega, theta, rho) de
          una opción call o put, con el modelo Black-Scholes.
        </p>

        <OptionsCalculator />
      </main>

      <footer className="border-t border-border px-6 py-6 text-center font-sans text-[11px] text-text-soft">
        1er Millón de Dólares — contenido educativo, no es asesoría financiera.
      </footer>
    </div>
  );
}
