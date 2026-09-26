"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/planes";

const SCRIPT_BOLD = "https://checkout.bold.co/library/boldPaymentButton.js";

type BoldCheckoutConfig = Record<string, string | undefined>;
declare global {
  interface Window {
    BoldCheckout?: new (config: BoldCheckoutConfig) => { open: () => void };
  }
}

// Carga la librería de Bold una sola vez, recién cuando alguien va a pagar.
function cargarBold(): Promise<void> {
  if (window.BoldCheckout) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_BOLD}"]`);
    const script = existente ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("no cargó Bold")));
    if (!existente) {
      script.src = SCRIPT_BOLD;
      document.head.appendChild(script);
    }
  });
}

/**
 * "Pagar" de un plan (ver lib/bold.ts): pide al servidor la orden firmada y
 * abre la pasarela de Bold. Al terminar, Bold devuelve a /pago/resultado.
 */
export function BotonPagoBold({ plan, destacado }: { plan: PlanId; destacado?: boolean }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pagar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/pagos/orden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const orden = await res.json();
      if (!res.ok) throw new Error(orden.error ?? "No se pudo iniciar el pago.");

      await cargarBold();
      if (!window.BoldCheckout) throw new Error("No cargó la pasarela de pago.");
      new window.BoldCheckout({
        orderId: orden.orderId,
        currency: orden.currency,
        amount: orden.amount,
        apiKey: orden.apiKey,
        integritySignature: orden.integritySignature,
        description: orden.description,
        redirectionUrl: orden.redirectionUrl,
        customerData: orden.customerData,
      }).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={pagar}
        disabled={cargando}
        className={`w-full rounded px-4 py-2.5 font-sans text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 ${
          destacado ? "bg-gold text-bg" : "border border-border text-text hover:border-gold/40"
        }`}
      >
        {cargando ? "Abriendo el pago…" : "Pagar con Bold"}
      </button>
      {error && <p className="text-xs text-red">{error}</p>}
    </div>
  );
}
