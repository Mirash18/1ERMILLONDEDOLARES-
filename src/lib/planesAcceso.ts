/**
 * Cuánto acceso da cada plan al pagarse (ver lib/planes.ts y lib/bold.ts).
 * Separado de bold.ts, sin Clerk ni Redis, para poder probarlo solo.
 */

import { ACCESO_BLOQUEADO } from "./scopes";
import { PREMIUM_DIAS_GRACIA, PREMIUM_SEMANAS_PREMIO, type PlanId } from "./planes";

const DIA = 24 * 60 * 60 * 1000;

function vigenteHasta(v: unknown, ahora: number): number | null {
  if (typeof v !== "string" || v === ACCESO_BLOQUEADO) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) && t > ahora ? t : null;
}

/** Suma días desde donde termine lo que ya tiene (o desde hoy). */
function extender(v: unknown, dias: number, ahora: number): string {
  const base = vigenteHasta(v, ahora) ?? ahora;
  return new Date(base + dias * DIA).toISOString();
}

/** Garantiza acceso al menos hasta hoy + días (sin acortar lo que tenga). */
function alMenos(v: unknown, dias: number, ahora: number): string {
  const actual = vigenteHasta(v, ahora) ?? 0;
  return new Date(Math.max(actual, ahora + dias * DIA)).toISOString();
}

/**
 * Qué da cada plan (ver lib/planes.ts):
 *   - Básico: +30 días de Sala (se suman si todavía tenía).
 *   - Anual: +365 días de Sala.
 *   - Premium: +7 días de Clases (se suman si todavía tenía) y Sala al
 *     menos 30 días desde hoy (no se suman: si no, 4 semanas darían 4
 *     meses). Racha: si paga a más tardar PREMIUM_DIAS_GRACIA días después
 *     de que se le venció la semana anterior, cuenta como seguida; al pagar
 *     la PREMIUM_SEMANAS_PREMIO-ésima seguida, Sala al menos 60 días desde
 *     ese pago, y la racha vuelve a empezar.
 */
export function calcularAcceso(
  plan: PlanId,
  acceso: Record<string, unknown>,
  rachaPrevia: number,
  ahora: number
): { acceso: Record<string, unknown>; racha: number } {
  const nuevo = { ...acceso };
  let racha = rachaPrevia;

  if (plan === "basico") {
    nuevo.sala = extender(acceso.sala, 30, ahora);
  } else if (plan === "anual") {
    nuevo.sala = extender(acceso.sala, 365, ahora);
  } else {
    const clasesPrevias = typeof acceso.clases === "string" ? new Date(acceso.clases).getTime() : NaN;
    const seguida =
      Number.isFinite(clasesPrevias) && ahora <= clasesPrevias + PREMIUM_DIAS_GRACIA * DIA;
    racha = seguida ? rachaPrevia + 1 : 1;
    nuevo.clases = extender(acceso.clases, 7, ahora);
    if (racha >= PREMIUM_SEMANAS_PREMIO) {
      nuevo.sala = alMenos(acceso.sala, 60, ahora);
      racha = 0;
    } else {
      nuevo.sala = alMenos(acceso.sala, 30, ahora);
    }
  }
  return { acceso: nuevo, racha };
}
