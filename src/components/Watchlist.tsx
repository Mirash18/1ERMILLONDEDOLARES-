"use client";

import { useEffect, useState } from "react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import type { Palette } from "./CandleChart";
import type { Quote } from "@/lib/marketData";

type Sector = { name: string; symbols: string[] };

/**
 * Lista de seguimiento (watchlist) de la Sala de Trading — como el panel
 * "Populares" de ProRealTime, con un buscador por categorías como el
 * "Agregar símbolo" de TradingView para armarla.
 *
 * Decisión temporal (15 sept. 2026, ver hasSymbolAccess() en
 * subscription.ts): solo hace falta tener cuenta, no pagar. A futuro esto
 * se vuelve parte del plan de $25/mes.
 */
export function Watchlist({
  symbol,
  onSelect,
  palette,
}: {
  symbol: string;
  onSelect: (s: string) => void;
  palette: Palette;
}) {
  // `null` mientras se confirma con el servidor si hay cuenta — así no se
  // le muestra por un instante el aviso de "crea una cuenta" a alguien que
  // sí tiene sesión, mientras carga.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");

  // El servidor decide (según la sesión) si hay cuenta, y trae las
  // categorías — el navegador nunca decide esto por su cuenta.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/universe?scope=sala")
      .then((res) => res.json())
      .then((json: { sectors?: Sector[]; allowed?: boolean }) => {
        if (cancelled) return;
        setAllowed(Boolean(json.allowed));
        setSectors(json.sectors ?? []);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Favoritas ya guardadas de antes.
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    fetch("/api/watchlist")
      .then((res) => res.json())
      .then((json: { symbols?: string[] }) => {
        if (!cancelled) setFavorites(json.symbols ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  // Precios de las favoritas — cada 5 min, mismo criterio que TickerStrip
  // (ver docs/ARQUITECTURA.md, incidente del límite diario de Twelve Data).
  useEffect(() => {
    if (favorites.length === 0) {
      setQuotes({});
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/quotes?symbols=${favorites.join(",")}&scope=sala`
        );
        const json: { quotes?: Quote[] } = await res.json();
        if (cancelled || !json.quotes) return;
        const map: Record<string, Quote> = {};
        for (const q of json.quotes) map[q.symbol] = q;
        setQuotes(map);
      } catch {
        // Se quedan los últimos precios conocidos si falla la red.
      }
    }

    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites.join(",")]);

  async function saveFavorites(next: string[]) {
    setFavorites(next);
    try {
      await fetch("/api/watchlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: next }),
      });
    } catch {
      // Si falla el guardado, se intenta de nuevo la próxima vez que
      // cambie la lista — no hay nada más que hacer aquí.
    }
  }

  function toggleFavorite(s: string) {
    saveFavorites(
      favorites.includes(s)
        ? favorites.filter((f) => f !== s)
        : [...favorites, s]
    );
  }

  // Todavía no se sabe si hay cuenta — no se pinta nada para no parpadear.
  if (allowed === null) {
    return <div className="w-72 shrink-0" />;
  }

  if (!allowed) {
    return (
      <div
        className="flex w-72 shrink-0 flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center"
        style={{ backgroundColor: palette.wrapperBg, borderColor: palette.wrapperBorder }}
      >
        <p className="font-mono text-[11px] leading-relaxed" style={{ color: palette.textSoft }}>
          Crea una cuenta gratis para armar tu lista de seguimiento con
          cualquier acción del S&P 500 y el Nasdaq.
        </p>
        <div className="flex gap-2">
          <SignUpButton mode="modal">
            <button
              type="button"
              className="rounded bg-gold px-3 py-1.5 font-mono text-[11px] font-medium text-bg"
            >
              Crear cuenta
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded border px-3 py-1.5 font-mono text-[11px]"
              style={{ borderColor: palette.wrapperBorder, color: palette.textSoft }}
            >
              Iniciar sesión
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  const categories = ["Todos", ...sectors.map((s) => s.name)];
  const symbolsInCategory =
    category === "Todos"
      ? Array.from(new Set(sectors.flatMap((s) => s.symbols))).sort()
      : (sectors.find((s) => s.name === category)?.symbols ?? []);
  const filtered = (
    query.trim()
      ? symbolsInCategory.filter((s) =>
          s.toLowerCase().includes(query.trim().toLowerCase())
        )
      : symbolsInCategory
  ).slice(0, 300);

  return (
    <div
      className="flex w-72 shrink-0 flex-col rounded-lg border p-3"
      style={{ backgroundColor: palette.wrapperBg, borderColor: palette.wrapperBorder }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: palette.textSoft }}
        >
          Favoritas
        </span>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-6 w-6 items-center justify-center rounded font-mono text-sm"
          style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
          title="Agregar símbolo"
          aria-label="Agregar símbolo"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {favorites.length === 0 && (
          <p className="mt-2 font-mono text-[11px] opacity-60" style={{ color: palette.textSoft }}>
            Todavía no tienes favoritas — dale a &ldquo;+&rdquo; para agregar.
          </p>
        )}
        {favorites.map((s) => {
          const q = quotes[s];
          const active = s === symbol;
          return (
            <div
              key={s}
              className="group flex items-center gap-1 rounded"
              style={{ backgroundColor: active ? palette.buttonActiveBg : "transparent" }}
            >
              <button
                type="button"
                onClick={() => onSelect(s)}
                className="flex flex-1 items-center justify-between gap-2 px-2 py-1.5 font-mono text-xs"
                style={{ color: active ? palette.buttonActiveText : palette.buttonText }}
              >
                <span>{s}</span>
                {q?.price != null ? (
                  <span className="flex items-center gap-1.5">
                    <span>{q.price.toFixed(2)}</span>
                    <span
                      style={{
                        color:
                          (q.change ?? 0) >= 0
                            ? active
                              ? palette.buttonActiveText
                              : "#089981"
                            : "#F23645",
                      }}
                    >
                      {(q.change ?? 0) >= 0 ? "+" : ""}
                      {q.percentChange?.toFixed(2)}%
                    </span>
                  </span>
                ) : (
                  <span className="opacity-50">—</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => toggleFavorite(s)}
                className="pr-2 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: active ? palette.buttonActiveText : palette.textSoft }}
                title="Quitar de favoritas"
                aria-label={`Quitar ${s} de favoritas`}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border p-4"
            style={{ backgroundColor: palette.wrapperBg, borderColor: palette.wrapperBorder }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base text-text">Agregar símbolo</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-lg leading-none"
                style={{ color: palette.textSoft }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="mb-3 rounded border bg-transparent px-3 py-1.5 font-mono text-xs outline-none"
              style={{ borderColor: palette.wrapperBorder, color: palette.buttonText }}
            />

            <div className="mb-3 flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wide"
                  style={{
                    backgroundColor: c === category ? palette.buttonActiveBg : palette.buttonBg,
                    color: c === category ? palette.buttonActiveText : palette.buttonText,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="font-mono text-xs opacity-60" style={{ color: palette.textSoft }}>
                  Sin resultados
                </p>
              )}
              {filtered.map((s) => {
                const isFav = favorites.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleFavorite(s)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 font-mono text-xs"
                    style={{ color: palette.buttonText }}
                  >
                    <span>{s}</span>
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[11px]"
                      style={{
                        backgroundColor: isFav ? "#089981" : palette.buttonBg,
                        color: isFav ? "#fff" : palette.textSoft,
                      }}
                    >
                      {isFav ? "✓" : "+"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
