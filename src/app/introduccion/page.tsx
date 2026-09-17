import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AuthStatus } from "@/components/AuthStatus";
import { CandleChart } from "@/components/CandleChart";
import { accountsConfigured, getAccess } from "@/lib/subscription";

// Módulos del programa de estudio. Los títulos y el orden son la base típica
// de cualquier curso de introducción al trading — el contenido real (video,
// texto, quiz) todavía no existe: eso lo trae Miguel Cortés. Se muestran
// igual, marcados "Próximamente", con el mismo criterio del resto del sitio:
// no fingir que algo ya está listo cuando no lo está.
const modulos = [
  {
    numero: "01",
    titulo: "¿Qué es el trading?",
    resumen: "Mercados, activos y cómo se gana (o se pierde) dinero moviendo precios.",
  },
  {
    numero: "02",
    titulo: "Cómo leer un gráfico de velas",
    resumen: "Apertura, cierre, máximo, mínimo — y qué cuenta cada vela sobre la sesión.",
  },
  {
    numero: "03",
    titulo: "Medias móviles",
    resumen: "Para qué sirven la PM 20, PM 40, PM 100 y PM 200 que ya ves en el gráfico.",
  },
  {
    numero: "04",
    titulo: "Bandas de Bollinger y volumen",
    resumen: "Cómo leer volatilidad y volumen para confirmar (o dudar de) un movimiento.",
  },
  {
    numero: "05",
    titulo: "Gestión de riesgo",
    resumen: "Antes de la primera operación: cuánto arriesgar, y por qué eso importa más que acertar.",
  },
];

export default async function Introduccion() {
  if (!accountsConfigured()) {
    redirect("/");
  }

  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // Decisión de Alejo (17 sept. 2026): "Introducción" deja de ser abierta a
  // cualquiera que se registre — ahora hace falta que él dé acceso a mano
  // desde /admin (o, más adelante, una suscripción pagada). Cualquiera de
  // las dos formas ya cuenta como "activa" en getAccess() — ver
  // subscription.ts.
  const access = await getAccess();
  if (!access.allowed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-gold">
          Introducción
        </p>
        <h1 className="mb-3 font-display text-2xl font-medium text-text">
          Todavía no tienes acceso aquí
        </h1>
        <p className="max-w-sm text-sm text-text-soft">
          Esta sección se habilita a mano, uno por uno. Escríbenos y te
          damos acceso.
        </p>
        <Link
          href="/"
          className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
        >
          ← volver
        </Link>
      </div>
    );
  }

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
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
            >
              ← volver
            </Link>
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
        <section className="mb-12">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-gold">
            Bienvenido
          </p>
          <h1 className="text-balance font-display text-4xl font-medium leading-tight text-text sm:text-5xl">
            Introducción al trading.
          </h1>
          <p className="mt-4 max-w-xl text-text-soft">
            Antes de mirar el gráfico en serio, vale la pena entender qué
            estás viendo. Este es el punto de partida — cinco temas cortos
            para llegar con las bases claras.
          </p>
        </section>

        <section className="mb-16 grid gap-4 sm:grid-cols-2">
          {modulos.map((m) => (
            <div
              key={m.numero}
              className="flex gap-4 rounded-lg border border-border bg-panel p-5"
            >
              <span className="font-display text-2xl font-medium text-gold/50">
                {m.numero}
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="font-display text-lg font-medium text-text">
                  {m.titulo}
                </h3>
                <p className="text-sm text-text-soft">{m.resumen}</p>
                <span className="mt-1 w-fit rounded border border-border bg-input px-2 py-1 font-mono text-[10px] text-text-soft">
                  Próximamente
                </span>
              </div>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-6 flex items-center gap-3">
            <h2 className="font-display text-xl font-medium text-text">
              Practica mientras tanto
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="mb-6 max-w-xl text-sm text-text-soft">
            El mismo gráfico en vivo de la portada, para que le vayas
            agarrando el ojo a las velas y las medias móviles desde ya.
          </p>
          <CandleChart />
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center font-mono text-[11px] text-text-soft">
        1er Millón de Dólares — contenido educativo, no es asesoría financiera.
      </footer>
    </div>
  );
}
