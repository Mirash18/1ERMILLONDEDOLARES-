import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { SiteHeader } from "@/components/SiteHeader";
import { getAccesoClase } from "@/lib/subscription";
import { getClasesConfig, hoyColombia } from "@/lib/clases";

// Depende de la sesión y del link de Zoom del momento: nunca estática.
export const dynamic = "force-dynamic";

function fechaLarga(dia: string): string {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-CO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const AVISOS: Record<string, string> = {
  "sin-acceso": "Tu cuenta no tiene acceso a la clase de hoy.",
  "sin-link": "El link de la clase todavía no está publicado. Vuelve un rato antes de la clase.",
};

/**
 * Clases con el profesor Miguel — por Zoom (ver src/lib/clases.ts). El
 * botón "Entrar a la clase" no lleva el link de Zoom: pasa por
 * /api/clases/entrar, que revisa el acceso, lo anota y redirige.
 */
export default async function ClasesPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  const config = await getClasesConfig();
  const hoy = hoyColombia();
  const acceso = await getAccesoClase(config.fechaClaseAbierta, hoy);
  const proximaAbierta =
    config.fechaClaseAbierta && config.fechaClaseAbierta >= hoy ? config.fechaClaseAbierta : null;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <section className="mb-10">
          <p className="mb-2 font-sans text-xs uppercase tracking-[0.14em] text-gold">
            Clases en vivo
          </p>
          <h1 className="text-balance font-display text-4xl font-medium leading-tight text-text">
            Clases con el profesor Miguel
          </h1>
          <p className="mt-4 max-w-xl text-text-soft">
            Las clases son en vivo por Zoom: puedes seguirlas desde el celular y operar al
            mismo tiempo.
          </p>
        </section>

        {/* "sin-acceso" no se muestra si ya puede entrar, ni a quien no ha
            iniciado sesión (ya le aparece "Inicia sesión" abajo). */}
        {aviso &&
          AVISOS[aviso] &&
          !(aviso === "sin-acceso" && (acceso.allowed || acceso.status === "sin-cuenta")) && (
          <p className="mb-6 rounded border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-text">
            {AVISOS[aviso]}
          </p>
        )}

        <section className="rounded-lg border border-border bg-panel p-8">
          {acceso.status === "sin-cuenta" ? (
            <div className="flex flex-col gap-5">
              <p className="text-text">
                Inicia sesión para entrar a la clase. Si todavía no tienes cuenta, créala gratis.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="w-full rounded bg-gold px-6 py-3 font-sans text-sm font-medium text-bg transition-opacity hover:opacity-90 sm:w-auto"
                  >
                    Iniciar sesión
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="w-full rounded border border-border px-6 py-3 font-sans text-sm font-medium text-text transition-colors hover:border-gold/40 sm:w-auto"
                  >
                    Crear cuenta
                  </button>
                </SignUpButton>
              </div>
            </div>
          ) : acceso.allowed ? (
            <div className="flex flex-col gap-5">
              <p className="text-text">
                {acceso.via === "clase-abierta"
                  ? "Hoy es la clase abierta de tu plan básico. ¡Te esperamos!"
                  : "Tienes acceso a las clases con el profesor Miguel."}
              </p>
              {config.zoomUrl ? (
                <a
                  href="/api/clases/entrar"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex w-fit items-center gap-2 rounded bg-gold px-6 py-3 font-sans text-sm font-medium text-bg transition-opacity hover:opacity-90"
                >
                  Entrar a la clase (Zoom)
                </a>
              ) : (
                <p className="text-sm text-text-soft">{AVISOS["sin-link"]}</p>
              )}
            </div>
          ) : acceso.status === "sin-configurar" ? (
            <p className="text-text-soft">Las clases todavía no están disponibles.</p>
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-text">
                Las clases con el profesor Miguel vienen incluidas en los planes de la
                plataforma.
              </p>
              {proximaAbierta && (
                <p className="text-sm text-text-soft">
                  Próxima clase abierta del plan básico:{" "}
                  <span className="text-gold">{fechaLarga(proximaAbierta)}</span>.
                </p>
              )}
              <Link
                href="/suscripcion"
                className="inline-flex w-fit items-center rounded bg-gold px-6 py-3 font-sans text-sm font-medium text-bg transition-opacity hover:opacity-90"
              >
                Ver planes
              </Link>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center font-sans text-[11px] text-text-soft">
        1er Millón de Dólares — contenido educativo, no es asesoría financiera.
      </footer>
    </div>
  );
}
