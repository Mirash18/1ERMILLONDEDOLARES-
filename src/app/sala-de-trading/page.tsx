import { SignUpButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { TradingRoom } from "@/components/TradingRoom";
import { SiteHeader } from "@/components/SiteHeader";
import { Planes } from "@/components/Planes";
import { FREE_TRIAL_DAYS, getAccess } from "@/lib/subscription";
import { ACCESO_BLOQUEADO } from "@/lib/scopes";

// Depende de la sesión: nunca estática.
export const dynamic = "force-dynamic";

/**
 * Sala de Trading — gráfico a pantalla completa como TradingView, con
 * encabezado (acción, precio, cambio) y barra de datos que siguen a la
 * acción elegida (ver TradingRoom).
 *
 * Quién entra (decisión de Alejo, 26 sept. 2026 — antes era pública):
 *   - con plan pagado o acceso dado a mano en /admin;
 *   - quien se registra, durante su semana gratis (con TODAS las acciones).
 * Nadie más: sin cuenta, o pasada la semana gratis, se muestra
 * "Inscríbete" con los planes. El gráfico pequeño de la portada sigue
 * abierto para todos con SPY, QQQ, META y GLD.
 */
export default async function SalaDeTrading() {
  const access = await getAccess("sala");
  if (access.allowed) return <TradingRoom />;

  const sinCuenta = access.status === "sin-cuenta";
  const user = sinCuenta ? null : await currentUser();
  const bloqueado =
    (user?.publicMetadata?.acceso as Record<string, unknown> | undefined)?.sala ===
    ACCESO_BLOQUEADO;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <section className="mb-12 max-w-2xl">
          <p className="mb-2 font-sans text-xs uppercase tracking-[0.14em] text-gold">
            Sala de Trading
          </p>
          <h1 className="text-balance font-display text-4xl font-medium leading-tight text-text">
            {sinCuenta ? "Pruébala gratis por una semana." : "Inscríbete para seguir en la Sala."}
          </h1>
          <p className="mt-4 text-text-soft">
            {sinCuenta
              ? `Crea tu cuenta y usa la Sala de Trading ${FREE_TRIAL_DAYS} días gratis, con las gráficas en vivo de todas las acciones. Después, sigue con cualquiera de los planes.`
              : bloqueado
                ? "Tu acceso a la Sala de Trading está suspendido. Escríbenos si crees que es un error, o elige un plan."
                : "Tu semana gratis ya terminó. Para seguir viendo las gráficas en vivo de todas las acciones, elige un plan."}
          </p>
          {sinCuenta && (
            <SignUpButton mode="modal">
              <button
                type="button"
                className="mt-6 rounded bg-gold px-6 py-3 font-sans text-sm font-medium text-bg transition-opacity hover:opacity-90"
              >
                Crear cuenta — {FREE_TRIAL_DAYS} días gratis
              </button>
            </SignUpButton>
          )}
        </section>

        <Planes conCuenta={!sinCuenta} />

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
