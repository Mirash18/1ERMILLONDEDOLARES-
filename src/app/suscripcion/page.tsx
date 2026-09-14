import Link from "next/link";
import { accountsConfigured } from "@/lib/subscription";

// Lo que YA funciona hoy y entra con la suscripción.
const incluidoAhora = [
  "Gráfico de velas en vivo con marcos de hora, día, semana y mes",
  "Medias móviles de 20, 40, 100 y 200 periodos",
  "Bandas de Bollinger y volumen",
  "Vela de apertura señalada y cuenta atrás de la vela en curso",
];

// Lo que está construido a medias o todavía no existe. Va aparte y dicho con
// todas las letras: no se le cobra a nadie por algo que aún no puede usar.
const enCamino = [
  {
    texto: "Universo completo del S&P 500 y el Nasdaq",
    nota: "Depende de subir el plan de datos",
  },
  {
    texto: "Clases en vivo con el profesor Miguel Cortés",
    nota: "Fase 4",
  },
  {
    texto: "Calculadora de velas (Black-Scholes) y estudios técnicos",
    nota: "Fase 5",
  },
  {
    texto: "Biblioteca de clases grabadas",
    nota: "Fase 6",
  },
];

export default function Suscripcion() {
  const listo = accountsConfigured();

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="font-display text-lg tracking-tight text-text"
          >
            1er <span className="text-gold">Millón</span> de Dólares
          </Link>
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
          >
            ← volver
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <section className="mb-12">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-gold">
            Membresía
          </p>
          <h1 className="text-balance font-display text-4xl font-medium leading-tight text-text">
            Acceso completo a la plataforma.
          </h1>
          <p className="mt-4 max-w-xl text-text-soft">
            Una sola membresía, sin permanencia. Se cancela cuando quieras
            desde tu propia cuenta.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-panel p-8">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-5xl font-medium text-text">
              $25
            </span>
            <span className="font-mono text-sm text-text-soft">USD / mes</span>
          </div>

          <div className="my-7 h-px bg-border" />

          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-gold">
            Disponible ahora
          </h2>
          <ul className="mb-8 flex flex-col gap-2.5">
            {incluidoAhora.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-text">
                <span className="mt-[2px] text-green">✓</span>
                {item}
              </li>
            ))}
          </ul>

          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-text-soft">
            En camino
          </h2>
          <ul className="mb-8 flex flex-col gap-2.5">
            {enCamino.map((item) => (
              <li
                key={item.texto}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-soft"
              >
                <span className="flex gap-3">
                  <span className="mt-[2px] opacity-50">○</span>
                  {item.texto}
                </span>
                <span className="rounded border border-border bg-input px-2 py-0.5 font-mono text-[10px]">
                  {item.nota}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={!listo}
            className="w-full rounded bg-gold px-6 py-3 font-mono text-sm font-medium text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {listo ? "Suscribirme" : "Disponible muy pronto"}
          </button>

          {!listo && (
            <p className="mt-3 text-center font-mono text-[11px] text-text-soft">
              Estamos terminando de conectar el sistema de pagos.
            </p>
          )}
        </section>

        <p className="mt-8 text-center text-sm text-text-soft">
          El pago se procesa con Stripe. Nosotros no guardamos ni vemos los
          datos de tu tarjeta.
        </p>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center font-mono text-[11px] text-text-soft">
        1er Millón de Dólares — contenido educativo, no es asesoría financiera.
      </footer>
    </div>
  );
}
