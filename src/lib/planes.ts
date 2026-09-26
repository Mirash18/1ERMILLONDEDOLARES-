/**
 * Los planes de la plataforma (decisión de Alejo, 26 sept. 2026). Un solo
 * lugar para precio, lo que incluye cada uno y cuánto acceso da — la página
 * de planes lo muestra y el cobro con Bold (paso 4) aplica lo mismo, así no
 * pueden quedar distintos.
 *
 *   Básico   $12.59 — Sala de Trading 1 mes + la clase abierta (el día que
 *                     marque el admin, ver src/lib/clases.ts).
 *   Premium  $25.99 — Clases con el profesor Miguel 1 semana + Sala de
 *                     Trading 1 mes. Pagando 4 semanas seguidas (3 días de
 *                     gracia entre una y otra), al pagar la 4ª las gráficas
 *                     quedan por 2 meses desde ese día. Es el que se quiere
 *                     vender: va destacado.
 *   Anual    $120    — Solo Sala de Trading, 1 año (equivale a $10 al mes).
 *
 * Precios en dólares. Sin nada de servidor: lo usan también componentes del
 * navegador.
 */

export type PlanId = "basico" | "premium" | "anual";

export type Plan = {
  id: PlanId;
  nombre: string;
  /** Precio en USD. */
  precio: number;
  /** Lo que va al lado del precio: "/ mes", "/ semana"... */
  periodo: string;
  incluye: string[];
  /** Nota corta debajo (promoción, equivalencia). */
  nota?: string;
  destacado?: boolean;
};

// Racha del Premium: cuántas semanas seguidas dan el premio, y cuántos días
// de gracia hay después de que se vence la semana para que siga contando.
export const PREMIUM_SEMANAS_PREMIO = 4;
export const PREMIUM_DIAS_GRACIA = 3;

export const PLANES: Plan[] = [
  {
    id: "basico",
    nombre: "Básico",
    precio: 12.59,
    periodo: "/ mes",
    incluye: [
      "Sala de Trading por 1 mes: gráficas en vivo de todas las acciones",
      "1 clase en vivo con el profesor Miguel (el día que él elija)",
    ],
  },
  {
    id: "premium",
    nombre: "Premium",
    precio: 25.99,
    periodo: "/ semana",
    incluye: [
      "Clases en vivo con el profesor Miguel durante 1 semana",
      "Sala de Trading por 1 mes: gráficas en vivo de todas las acciones",
    ],
    nota: `Paga ${PREMIUM_SEMANAS_PREMIO} semanas seguidas y las gráficas te quedan por 2 meses.`,
    destacado: true,
  },
  {
    id: "anual",
    nombre: "Anual",
    precio: 120,
    periodo: "/ año",
    incluye: ["Sala de Trading por 1 año: gráficas en vivo de todas las acciones"],
    nota: "Equivale a $10 al mes.",
  },
];

export function formatoPrecio(usd: number): string {
  return `$${Number.isInteger(usd) ? usd : usd.toFixed(2)}`;
}
