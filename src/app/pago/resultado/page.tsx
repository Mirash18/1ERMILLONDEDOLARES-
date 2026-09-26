import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { confirmarOrden, type EstadoBold } from "@/lib/bold";
import { PLANES } from "@/lib/planes";

// Siempre en el momento: le pregunta a Bold el estado del pago.
export const dynamic = "force-dynamic";

function fechaCorta(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  return new Date(iso).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Adonde vuelve la persona después de pagar en Bold
 * (`?bold-order-id=...&bold-tx-status=...`). El estado que trae la URL NO
 * se usa para dar acceso — se le pregunta a Bold (confirmarOrden en
 * lib/bold.ts). Si está aprobado y todavía no se había aplicado, se aplica
 * aquí mismo.
 */
export default async function ResultadoPago({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const orderId = params["bold-order-id"];

  let estado: EstadoBold = "ERROR";
  let planNombre: string | null = null;
  let salaHasta: string | null = null;
  let clasesHasta: string | null = null;

  if (orderId) {
    try {
      const r = await confirmarOrden(orderId, "regreso");
      estado = r.estado;
      planNombre = PLANES.find((p) => p.id === r.orden?.plan)?.nombre ?? null;
      if (r.estado === "APPROVED" && r.orden) {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const user = await (await clerkClient()).users.getUser(r.orden.userId);
        const acceso = (user.publicMetadata?.acceso ?? {}) as Record<string, unknown>;
        salaHasta = fechaCorta(acceso.sala);
        clasesHasta = fechaCorta(acceso.clases);
      }
    } catch {
      estado = "ERROR";
    }
  }

  const aprobado = estado === "APPROVED";
  const enProceso = estado === "PROCESSING" || estado === "PENDING";
  // Bold dijo que NO: ahí sí se puede asegurar que no hubo cobro.
  const rechazado = estado === "REJECTED" || estado === "FAILED" || estado === "VOIDED";

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <section className="rounded-lg border border-border bg-panel p-8">
          {aprobado ? (
            <>
              <p className="mb-2 font-sans text-xs uppercase tracking-[0.14em] text-green">
                Pago aprobado
              </p>
              <h1 className="font-display text-3xl font-medium text-text">
                ¡Listo! {planNombre ? `Tu plan ${planNombre} está activo.` : "Tu plan está activo."}
              </h1>
              <ul className="mt-5 flex flex-col gap-1.5 text-sm text-text">
                {salaHasta && <li>Sala de Trading hasta el {salaHasta}.</li>}
                {clasesHasta && <li>Clases con el profesor Miguel hasta el {clasesHasta}.</li>}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/sala-de-trading"
                  className="rounded bg-gold px-5 py-2.5 font-sans text-sm font-medium text-bg hover:opacity-90"
                >
                  Ir a la Sala de Trading
                </Link>
                {clasesHasta && (
                  <Link
                    href="/clases"
                    className="rounded border border-border px-5 py-2.5 font-sans text-sm text-text hover:border-gold/40"
                  >
                    Ir a las clases
                  </Link>
                )}
              </div>
            </>
          ) : enProceso ? (
            <>
              <p className="mb-2 font-sans text-xs uppercase tracking-[0.14em] text-gold">
                Pago en proceso
              </p>
              <h1 className="font-display text-3xl font-medium text-text">
                Tu pago todavía se está procesando.
              </h1>
              <p className="mt-4 text-sm text-text-soft">
                Apenas se apruebe, tu plan se activa solo. Puedes recargar esta página en unos
                minutos para ver cómo va.
              </p>
            </>
          ) : rechazado ? (
            <>
              <p className="mb-2 font-sans text-xs uppercase tracking-[0.14em] text-red">
                Pago no aprobado
              </p>
              <h1 className="font-display text-3xl font-medium text-text">El pago no se aprobó.</h1>
              <p className="mt-4 text-sm text-text-soft">
                No se te hizo ningún cobro por este intento. Puedes intentarlo de nuevo; si el
                problema sigue, escríbenos por WhatsApp.
              </p>
              <Link
                href="/suscripcion"
                className="mt-6 inline-block rounded bg-gold px-5 py-2.5 font-sans text-sm font-medium text-bg hover:opacity-90"
              >
                Volver a los planes
              </Link>
            </>
          ) : (
            <>
              <p className="mb-2 font-sans text-xs uppercase tracking-[0.14em] text-gold">
                Sin confirmar
              </p>
              <h1 className="font-display text-3xl font-medium text-text">
                {orderId ? "Todavía no pudimos confirmar tu pago." : "No encontramos el pago."}
              </h1>
              <p className="mt-4 text-sm text-text-soft">
                Si ya pagaste, <span className="text-text">no vuelvas a pagar</span>: recarga
                esta página en unos minutos, o escríbenos por WhatsApp y lo revisamos.
              </p>
              <Link
                href="/suscripcion"
                className="mt-6 inline-block rounded bg-gold px-5 py-2.5 font-sans text-sm font-medium text-bg hover:opacity-90"
              >
                Volver a los planes
              </Link>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
