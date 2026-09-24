"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CandleChart } from "@/components/CandleChart";
import { TradingRoomHeader } from "@/components/TradingRoomHeader";
import { TradingInfoBar } from "@/components/TradingInfoBar";
import type { Quote } from "@/lib/marketData";

/**
 * Sala de Trading completa: encabezado (acción, precio, cambio), barra de
 * datos (volumen de ayer, cierre de ayer, apertura de hoy) y el gráfico — o
 * DOS gráficos lado a lado.
 *
 * Pantalla dividida (pedido de Alejo, 24 sept. 2026 — "la innovación frente
 * a uCharts, que solo deja ver un cuadro"): clic derecho en el gráfico →
 * "Dividir verticalmente", o el botón de la barra. Máximo dos gráficos, para
 * no saturar. Cada uno con su acción, su marco y sus indicadores; los
 * dibujos son por ACCIÓN (lo eligió Alejo): una línea en SPY aparece en
 * cualquier gráfico que muestre SPY. El que se tocó por última vez queda
 * seleccionado (borde dorado) y el encabezado muestra su acción. Se recuerda
 * entre visitas si estaba dividida y qué había en cada lado.
 *
 * En celular no se divide: dos gráficos no caben en una pantalla angosta.
 */

type Lado = "izq" | "der";
type EstadoGrafico = { symbol: string; timeframe: string };
type Diseno = {
  dividido: boolean;
  activo: Lado;
  graficos: Record<Lado, EstadoGrafico>;
};

const CLAVE_DISENO = "millon:sala:diseno";
const DISENO_INICIAL: Diseno = {
  dividido: false,
  activo: "izq",
  graficos: {
    izq: { symbol: "SPY", timeframe: "1h" },
    der: { symbol: "SPY", timeframe: "1h" },
  },
};
const LADOS: Lado[] = ["izq", "der"];
const otro = (l: Lado): Lado => (l === "izq" ? "der" : "izq");

type VolumenDia = { fecha: string; volumen: number } | null;

// ¿Pantalla de escritorio/tablet? Por debajo de 768 px no se ofrece dividir.
function useEsAncho(): boolean {
  const [ancho, setAncho] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const actualizar = () => setAncho(mq.matches);
    actualizar();
    mq.addEventListener("change", actualizar);
    return () => mq.removeEventListener("change", actualizar);
  }, []);
  return ancho;
}

export function TradingRoom() {
  // `null` hasta leer lo recordado — los gráficos no se montan antes, para
  // que arranquen directo con la acción y el marco de la última visita.
  const [diseno, setDiseno] = useState<Diseno | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  // El volumen sale de las velas de cada gráfico, no de la cotización (ver
  // el comentario en Quote, marketData.ts).
  const [volumenes, setVolumenes] = useState<Record<Lado, VolumenDia>>({
    izq: null,
    der: null,
  });
  const esAncho = useEsAncho();

  useEffect(() => {
    let recordado: Diseno = DISENO_INICIAL;
    try {
      const raw = localStorage.getItem(CLAVE_DISENO);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Diseno>;
        recordado = {
          dividido: !!d.dividido,
          activo: d.activo === "der" ? "der" : "izq",
          graficos: {
            izq: { ...DISENO_INICIAL.graficos.izq, ...d.graficos?.izq },
            der: { ...DISENO_INICIAL.graficos.der, ...d.graficos?.der },
          },
        };
      }
    } catch {
      // Sin localStorage (modo privado, bloqueado): se arranca como siempre.
    }
    setDiseno(recordado);
  }, []);

  useEffect(() => {
    if (!diseno) return;
    try {
      localStorage.setItem(CLAVE_DISENO, JSON.stringify(diseno));
    } catch {
      // No es crítico: solo no se recuerda para la próxima visita.
    }
  }, [diseno]);

  // En celular se muestra solo el gráfico seleccionado.
  const dividido = !!diseno?.dividido && esAncho;
  const activo = diseno?.activo ?? "izq";
  const symbol = diseno?.graficos[activo].symbol ?? "SPY";

  // Funciones estables por lado: el gráfico las usa en efectos.
  const porLado = useMemo(() => {
    const armar = (lado: Lado) => ({
      onSymbolChange: (s: string) =>
        setDiseno((d) =>
          d && d.graficos[lado].symbol !== s
            ? { ...d, graficos: { ...d.graficos, [lado]: { ...d.graficos[lado], symbol: s } } }
            : d
        ),
      onTimeframeChange: (tf: string) =>
        setDiseno((d) =>
          d && d.graficos[lado].timeframe !== tf
            ? { ...d, graficos: { ...d.graficos, [lado]: { ...d.graficos[lado], timeframe: tf } } }
            : d
        ),
      onVolumenDelDia: (v: VolumenDia) => setVolumenes((prev) => ({ ...prev, [lado]: v })),
      onActivar: () => setDiseno((d) => (d && d.activo !== lado ? { ...d, activo: lado } : d)),
      // El gráfico nuevo arranca con la misma acción y marco que el actual
      // (como ProRealTime); de ahí se cambia a la que se quiera.
      onDividir: () =>
        setDiseno((d) =>
          d
            ? {
                ...d,
                dividido: true,
                activo: otro(lado),
                graficos: { ...d.graficos, [otro(lado)]: { ...d.graficos[lado] } },
              }
            : d
        ),
      onCerrar: () => setDiseno((d) => (d ? { ...d, dividido: false, activo: otro(lado) } : d)),
    });
    return { izq: armar("izq"), der: armar("der") };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Al cambiar de acción se borra la anterior de inmediato — mejor "—"
    // un instante que mostrar el precio de SPY con el nombre de Netflix.
    setQuote(null);

    async function load() {
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbol)}&scope=sala`);
        const json: { quotes?: Quote[] } = await res.json();
        const q = json.quotes?.find((x) => x.symbol === symbol) ?? null;
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) setQuote(null);
      }
    }

    load();
    // El servidor guarda la cotización 5 min (Redis), así que refrescar
    // cada minuto no gasta créditos de más: casi siempre sale de la caché.
    const id = setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  const visibles = dividido ? LADOS : [activo];

  return (
    <div className="flex h-screen flex-col bg-bg">
      <TradingRoomHeader symbol={symbol} quote={quote} />
      <TradingInfoBar quote={quote} volumenDia={volumenes[activo]} />
      <main className="flex min-h-0 flex-1 gap-3 overflow-hidden px-3 py-3">
        {diseno &&
          visibles.map((lado) => {
            const f = porLado[lado];
            return (
              // `key` por lado: al cerrar uno, el que queda NO se vuelve a
              // montar (no parpadea ni recarga).
              <CandleChart
                key={lado}
                fillHeight
                initialSymbol={diseno.graficos[lado].symbol}
                initialTimeframe={diseno.graficos[lado].timeframe}
                onSymbolChange={f.onSymbolChange}
                onTimeframeChange={f.onTimeframeChange}
                onVolumenDelDia={f.onVolumenDelDia}
                activo={lado === activo}
                onActivar={f.onActivar}
                onDividir={!dividido && esAncho ? f.onDividir : undefined}
                onCerrar={dividido ? f.onCerrar : undefined}
              />
            );
          })}
      </main>
    </div>
  );
}
