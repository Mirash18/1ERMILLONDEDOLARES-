import { SignUpButton } from "@clerk/nextjs";
import { PLANES, formatoPrecio, type PlanId } from "@/lib/planes";

/**
 * Las tres tarjetas de planes (Básico / Premium / Anual — ver lib/planes.ts).
 * Se usan en /suscripcion y en el aviso "Inscríbete" de la Sala de Trading.
 *
 * El botón de cada plan depende de quién mira:
 *   - sin cuenta → "Crea tu cuenta" (el pago va amarrado a una cuenta);
 *   - con cuenta → pagar ese plan (`botonPago`, lo pone quien usa esto —
 *     el Botón de Bold del paso 4). Mientras el cobro en línea no esté
 *     listo, "Disponible muy pronto".
 */
export function Planes({
  conCuenta,
  botonPago,
}: {
  conCuenta: boolean;
  botonPago?: (plan: PlanId) => React.ReactNode;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {PLANES.map((p) => (
        <div
          key={p.id}
          className={`relative flex flex-col rounded-lg border bg-panel p-6 ${
            p.destacado ? "border-gold shadow-[0_0_0_1px_rgba(212,175,55,0.35)]" : "border-border"
          }`}
        >
          {p.destacado && (
            <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-bg">
              Recomendado
            </span>
          )}
          <h3 className="font-display text-xl font-medium text-text">{p.nombre}</h3>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-medium text-text">
              {formatoPrecio(p.precio)}
            </span>
            <span className="font-sans text-sm text-text-soft">USD {p.periodo}</span>
          </div>

          <ul className="mt-5 flex flex-1 flex-col gap-2.5">
            {p.incluye.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-text">
                <span className="mt-[1px] text-green">✓</span>
                {item}
              </li>
            ))}
          </ul>

          {p.nota && (
            <p
              className={`mt-4 rounded px-3 py-2 text-xs ${
                p.destacado ? "bg-gold/10 text-gold" : "bg-input text-text-soft"
              }`}
            >
              {p.nota}
            </p>
          )}

          <div className="mt-5">
            {!conCuenta ? (
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className={`w-full rounded px-4 py-2.5 font-sans text-sm font-medium transition-opacity hover:opacity-90 ${
                    p.destacado ? "bg-gold text-bg" : "border border-border text-text hover:border-gold/40"
                  }`}
                >
                  Crea tu cuenta para inscribirte
                </button>
              </SignUpButton>
            ) : botonPago ? (
              botonPago(p.id)
            ) : (
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded border border-border px-4 py-2.5 font-sans text-sm text-text-soft opacity-60"
              >
                Pago en línea muy pronto
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
