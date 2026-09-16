import Link from "next/link";
import { TickerStrip } from "@/components/TickerStrip";
import { CandleChart } from "@/components/CandleChart";
import { AuthStatus } from "@/components/AuthStatus";

const modules = [
  {
    tag: "Clases en vivo",
    title: "Profesor Miguel Cortés",
    status: "Fase 4 — pendiente",
    body: "Clases lunes a viernes vía Vimeo, con acceso ligado al estado de la suscripción.",
  },
  {
    tag: "Herramientas",
    title: "Calculadora y estudios",
    status: "Fase 5 — pendiente",
    body: "Calculadora de velas (Black-Scholes) y estudios técnicos (MA, RSI, volumen).",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="font-display text-lg tracking-tight text-text">
            1er <span className="text-gold">Millón</span> de Dólares
          </span>
          <div className="flex items-center gap-5">
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft sm:inline">
              en construcción · fase 1
            </span>
            <Link
              href="/sala-de-trading"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
            >
              Sala de Trading
            </Link>
            <AuthStatus />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <section className="mb-14">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-gold">
            Análisis, señales y educación
          </p>
          <h1 className="max-w-2xl text-balance font-display text-4xl font-medium leading-tight text-text sm:text-5xl">
            Aprende a leer el mercado antes de arriesgar tu capital.
          </h1>
          <p className="mt-4 max-w-xl text-text-soft">
            Gráficos en vivo, herramientas de estudio y las clases del
            profesor Miguel Cortés, todo en un mismo lugar.
          </p>
        </section>

        <section className="mb-8">
          <TickerStrip />
        </section>

        <section className="mb-16">
          <CandleChart />
        </section>

        <section>
          <div className="mb-6 flex items-center gap-3">
            <h2 className="font-display text-xl font-medium text-text">
              Lo que viene
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map((m) => (
              <div
                key={m.title}
                className="flex flex-col gap-2 rounded-lg border border-border bg-panel p-5"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold">
                  {m.tag}
                </span>
                <h3 className="font-display text-lg font-medium text-text">
                  {m.title}
                </h3>
                <p className="text-sm text-text-soft">{m.body}</p>
                <span className="mt-1 w-fit rounded border border-border bg-input px-2 py-1 font-mono text-[10px] text-text-soft">
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center font-mono text-[11px] text-text-soft">
        1er Millón de Dólares — contenido educativo, no es asesoría financiera.
      </footer>
    </div>
  );
}
