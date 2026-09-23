"use client";

import { useMemo, useState } from "react";
import { blackScholes, type OptionType } from "@/lib/blackScholes";
import type { Quote } from "@/lib/marketData";

// Los mismos símbolos gratuitos que ya se ven en la portada (ver
// FREE_SYMBOLS en universe.ts) — son los únicos que /api/quotes entrega
// sin necesitar sesión. "Usar precio en vivo" llama a ese mismo endpoint
// real; nunca se inventa un precio.
const SIMBOLOS_PRECIO_VIVO = ["SPY", "QQQ", "META", "GLD"];

// Valores con los que arranca la calculadora — un ejemplo neutro (nada
// que se parezca a una cotización real), solo para que los campos no
// empiecen vacíos.
const VALORES_INICIALES = {
  spot: "100",
  strike: "100",
  dte: "30",
  rate: "5",
  vol: "20",
  dividend: "0",
};

function Campo({
  label,
  value,
  onChange,
  suffix,
  step = "any",
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  step?: string;
  min?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-text-soft">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-border bg-input px-3 py-2">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-right font-mono text-sm text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix && (
          <span className="shrink-0 text-xs text-text-soft">{suffix}</span>
        )}
      </div>
    </label>
  );
}

function FilaResultado({
  label,
  value,
  destacado,
  positivo,
}: {
  label: string;
  value: string;
  destacado?: boolean;
  positivo?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
      <span
        className={destacado ? "font-medium text-text" : "text-sm text-text-soft"}
      >
        {label}
      </span>
      <span
        className={
          destacado
            ? "font-display text-xl font-semibold text-gold"
            : `font-mono text-sm ${
                positivo === undefined
                  ? "text-text"
                  : positivo
                    ? "text-green"
                    : "text-red"
              }`
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Calculadora de opciones (Black-Scholes) — precio teórico y griegas
 * para opciones europeas call/put. Todo el cálculo pasa en el navegador
 * (src/lib/blackScholes.ts): no hay nada que pedirle al servidor salvo,
 * opcionalmente, el precio en vivo de un símbolo para autocompletar
 * "Precio del subyacente".
 *
 * Verificado a mano contra una calculadora de opciones de referencia
 * (mismos 5 resultados — precio, delta, gamma, vega, theta, rho — con
 * los mismos parámetros de entrada) antes de publicarla.
 */
export function OptionsCalculator() {
  const [optionType, setOptionType] = useState<OptionType>("call");
  const [spot, setSpot] = useState(VALORES_INICIALES.spot);
  const [strike, setStrike] = useState(VALORES_INICIALES.strike);
  const [dte, setDte] = useState(VALORES_INICIALES.dte);
  const [rate, setRate] = useState(VALORES_INICIALES.rate);
  const [vol, setVol] = useState(VALORES_INICIALES.vol);
  const [dividend, setDividend] = useState(VALORES_INICIALES.dividend);

  const [liveSymbol, setLiveSymbol] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  async function usarPrecioEnVivo(symbol: string) {
    setLiveLoading(symbol);
    setLiveError(null);
    try {
      const res = await fetch("/api/quotes");
      const data: { quotes?: Quote[] } = await res.json();
      const q = data.quotes?.find((x) => x.symbol === symbol);
      if (q?.price != null) {
        setSpot(q.price.toFixed(2));
        setLiveSymbol(symbol);
      } else {
        setLiveError(
          `Sin precio disponible ahora mismo para ${symbol}${q?.error ? ` (${q.error})` : ""}.`
        );
      }
    } catch {
      setLiveError("No se pudo consultar el precio en vivo.");
    } finally {
      setLiveLoading(null);
    }
  }

  const result = useMemo(() => {
    return blackScholes({
      spot: parseFloat(spot),
      strike: parseFloat(strike),
      daysToExpiry: parseFloat(dte),
      riskFreeRate: parseFloat(rate),
      volatility: parseFloat(vol),
      dividendYield: parseFloat(dividend) || 0,
      optionType,
    });
  }, [spot, strike, dte, rate, vol, dividend, optionType]);

  return (
    <div className="flex flex-col gap-6">
      {/* Call / Put */}
      <div className="flex gap-1 rounded-md border border-border bg-input p-1">
        {(["call", "put"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOptionType(t)}
            className={`flex-1 rounded px-4 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${
              optionType === t
                ? t === "call"
                  ? "bg-green text-bg"
                  : "bg-red text-bg"
                : "text-text-soft hover:text-text"
            }`}
          >
            {t === "call" ? "Call (compra)" : "Put (venta)"}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Parámetros de entrada */}
        <div className="rounded-lg border border-border bg-panel p-5">
          <h2 className="mb-4 font-display text-base font-medium text-text">
            Parámetros de entrada
          </h2>
          <div className="flex flex-col gap-4">
            <Campo label="Precio del subyacente" value={spot} onChange={setSpot} suffix="USD" min="0" />

            {/* Precio en vivo: dato real vía /api/quotes, nunca inventado. */}
            <div className="-mt-2 flex flex-wrap gap-1.5">
              <span className="mr-1 self-center text-[11px] uppercase tracking-wide text-text-soft">
                Usar precio en vivo:
              </span>
              {SIMBOLOS_PRECIO_VIVO.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => usarPrecioEnVivo(s)}
                  disabled={liveLoading !== null}
                  className={`rounded border px-2 py-1 font-mono text-[11px] transition-colors disabled:opacity-50 ${
                    liveSymbol === s
                      ? "border-gold text-gold"
                      : "border-border text-text-soft hover:text-text"
                  }`}
                >
                  {liveLoading === s ? "…" : s}
                </button>
              ))}
            </div>
            {liveError && <p className="-mt-2 text-xs text-red">{liveError}</p>}

            <Campo label="Precio de ejercicio (strike)" value={strike} onChange={setStrike} suffix="USD" min="0" />
            <Campo label="Días al vencimiento" value={dte} onChange={setDte} suffix="días" min="0" step="1" />
            <Campo label="Tasa libre de riesgo" value={rate} onChange={setRate} suffix="%" />
            <Campo label="Volatilidad implícita" value={vol} onChange={setVol} suffix="%" min="0" />
            <Campo
              label="Rendimiento de dividendos (opcional)"
              value={dividend}
              onChange={setDividend}
              suffix="%"
              min="0"
            />
          </div>
        </div>

        {/* Resultados */}
        <div className="rounded-lg border border-border bg-panel p-5">
          <h2 className="mb-4 font-display text-base font-medium text-text">
            Valores teóricos calculados
          </h2>
          {result ? (
            <div>
              <FilaResultado label="Precio teórico" value={`$${result.price.toFixed(2)}`} destacado />
              <FilaResultado label="Delta" value={result.delta.toFixed(5)} />
              <FilaResultado label="Gamma" value={result.gamma.toFixed(5)} />
              <FilaResultado label="Vega (por 1% de volatilidad)" value={result.vega.toFixed(5)} />
              <FilaResultado
                label="Theta (por día)"
                value={result.theta.toFixed(5)}
                positivo={result.theta >= 0}
              />
              <FilaResultado label="Rho (por 1% de tasa)" value={result.rho.toFixed(5)} />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-text-soft">
              Completa los parámetros con valores mayores que cero para ver
              el resultado.
            </p>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-text-soft">
        Modelo teórico Black-Scholes para opciones europeas — herramienta
        educativa, no es asesoría financiera ni el precio real de mercado.
        El precio de una opción real depende de la oferta y la demanda, y
        muchas opciones (como las de acciones en EE. UU.) son americanas,
        no europeas.
      </p>
    </div>
  );
}
