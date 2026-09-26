import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { AuthStatus } from "@/components/AuthStatus";
import { Planes } from "@/components/Planes";
import { accountsConfigured } from "@/lib/subscription";
import { ACCESO_BLOQUEADO } from "@/lib/scopes";

// Depende de la sesión (qué botón mostrar, hasta cuándo tiene acceso).
export const dynamic = "force-dynamic";

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function vigente(v: unknown): v is string {
  return typeof v === "string" && v !== ACCESO_BLOQUEADO && new Date(v).getTime() > Date.now();
}

/**
 * Planes de la plataforma (ver lib/planes.ts). Antes esta página ofrecía una
 * sola membresía de $25/mes con una lista de "En camino"; desde el 26 sept.
 * 2026 son los tres planes que definió Alejo.
 */
export default async function Suscripcion() {
  const user = accountsConfigured() ? await currentUser() : null;
  const acceso = (user?.publicMetadata?.acceso ?? {}) as Record<string, unknown>;
  const salaHasta = vigente(acceso.sala) ? acceso.sala : null;
  const clasesHasta = vigente(acceso.clases) ? acceso.clases : null;

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
              className="font-sans text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
            >
              ← volver
            </Link>
            <AuthStatus />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <section className="mb-12">
          <p className="mb-2 font-sans text-xs uppercase tracking-[0.14em] text-gold">
            Planes
          </p>
          <h1 className="text-balance font-display text-4xl font-medium leading-tight text-text">
            Elige tu plan.
          </h1>
          <p className="mt-4 max-w-xl text-text-soft">
            Gráficas en vivo en la Sala de Trading y clases con el profesor Miguel. Sin
            permanencia: los planes no se cobran solos — cuando se te venza, renuevas con un
            clic.
          </p>
        </section>

        {(salaHasta || clasesHasta) && (
          <section className="mb-10 rounded-lg border border-green/40 bg-green/10 px-5 py-4 text-sm text-text">
            <p className="mb-1 font-sans text-[11px] uppercase tracking-[0.12em] text-green">
              Tu acceso
            </p>
            {salaHasta && <p>Sala de Trading hasta el {fechaCorta(salaHasta)}.</p>}
            {clasesHasta && <p>Clases con el profesor Miguel hasta el {fechaCorta(clasesHasta)}.</p>}
          </section>
        )}

        <Planes conCuenta={Boolean(user)} />

        <p className="mt-10 text-center text-sm text-text-soft">
          Precios en dólares (USD). El pago se procesa con Bold: nosotros no guardamos ni
          vemos los datos de tu tarjeta.
        </p>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center font-sans text-[11px] text-text-soft">
        1er Millón de Dólares — contenido educativo, no es asesoría financiera.
      </footer>
    </div>
  );
}
