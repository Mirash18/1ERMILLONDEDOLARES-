/**
 * Modelo Black-Scholes para opciones europeas (call y put), con
 * rendimiento de dividendos continuo opcional.
 *
 * Es puro cálculo — no depende de ninguna fuente de datos. El "precio
 * del subyacente" que alguien meta puede ser el que quiera, o el precio
 * en vivo de un símbolo (ver OptionsCalculator, que sí llama a
 * /api/quotes para eso). Esta función nunca inventa un precio: si no le
 * dan uno válido, no calcula nada (ver `blackScholes` más abajo).
 *
 * Los signos y la escala de cada resultado siguen la convención más
 * común entre calculadoras de opciones (la del propio Black-Scholes
 * "de libro", verificado a mano contra una calculadora de referencia):
 *   - vega: por 1 punto porcentual de volatilidad (no por 100%)
 *   - theta: por día calendario (no por año)
 *   - rho: por 1 punto porcentual de tasa (no por 100%)
 * Sin este ajuste, esos tres números saldrían ~100x o ~365x más grandes
 * de lo que cualquiera espera ver en una pantalla de opciones.
 */

export type OptionType = "call" | "put";

export type BlackScholesInputs = {
  /** Precio actual del subyacente (S). */
  spot: number;
  /** Precio de ejercicio (K). */
  strike: number;
  /** Días calendario hasta el vencimiento. */
  daysToExpiry: number;
  /** Tasa libre de riesgo, en porcentaje (5 = 5%). */
  riskFreeRate: number;
  /** Volatilidad implícita, en porcentaje (20 = 20%). */
  volatility: number;
  /** Rendimiento de dividendos, en porcentaje. Opcional, default 0. */
  dividendYield?: number;
  optionType: OptionType;
};

export type BlackScholesResult = {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  d1: number;
  d2: number;
};

// Aproximación de Abramowitz & Stegun (7.1.26) para la función de error —
// error máximo ~1.5×10⁻⁷, de sobra para una herramienta de cálculo. No
// hace falta traer una librería aparte solo por esto.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y =
    1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return sign * y;
}

function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Calcula el precio teórico y las griegas. Devuelve `null` si los
 * parámetros no forman una opción válida (precio, strike, plazo o
 * volatilidad en cero o negativos) — en vez de forzar un número sin
 * sentido.
 */
export function blackScholes(inputs: BlackScholesInputs): BlackScholesResult | null {
  const S = inputs.spot;
  const K = inputs.strike;
  const T = inputs.daysToExpiry / 365;
  const r = inputs.riskFreeRate / 100;
  const sigma = inputs.volatility / 100;
  const q = (inputs.dividendYield ?? 0) / 100;

  if (!(S > 0) || !(K > 0) || !(T > 0) || !(sigma > 0)) return null;

  const sqrtT = Math.sqrt(T);
  const d1 =
    (Math.log(S / K) + (r - q + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const Nd1 = normCdf(d1);
  const Nd2 = normCdf(d2);
  const NminusD1 = normCdf(-d1);
  const NminusD2 = normCdf(-d2);
  const pdfD1 = normPdf(d1);

  const discR = Math.exp(-r * T);
  const discQ = Math.exp(-q * T);

  let price: number;
  let delta: number;
  let rhoAnnual: number;
  let thetaAnnual: number;

  if (inputs.optionType === "call") {
    price = S * discQ * Nd1 - K * discR * Nd2;
    delta = discQ * Nd1;
    rhoAnnual = K * T * discR * Nd2;
    thetaAnnual =
      -(S * discQ * pdfD1 * sigma) / (2 * sqrtT) -
      r * K * discR * Nd2 +
      q * S * discQ * Nd1;
  } else {
    price = K * discR * NminusD2 - S * discQ * NminusD1;
    delta = -discQ * NminusD1;
    rhoAnnual = -K * T * discR * NminusD2;
    thetaAnnual =
      -(S * discQ * pdfD1 * sigma) / (2 * sqrtT) +
      r * K * discR * NminusD2 -
      q * S * discQ * NminusD1;
  }

  const gamma = (discQ * pdfD1) / (S * sigma * sqrtT);
  const vegaAnnual = S * discQ * pdfD1 * sqrtT;

  return {
    price,
    delta,
    gamma,
    vega: vegaAnnual / 100,
    theta: thetaAnnual / 365,
    rho: rhoAnnual / 100,
    d1,
    d2,
  };
}
