"use client";

import { useEffect, useMemo, useState } from "react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import type { Palette } from "./CandleChart";
import type { Quote } from "@/lib/marketData";
import { sectorOf, nameOf } from "@/lib/universe";

type Sector = { name: string; symbols: string[] };
type OrdenColumna = "symbol" | "price";

// Lista de seguimiento por defecto — la que ve alguien que todavía no ha
// armado la suya, tomada de la "Lista roja" que Alejo mostró en su
// TradingView. En cuanto agrega o quita algo, su lista propia manda y estos
// dejan de aparecer. Todos tienen que existir en el universo de símbolos
// (ver FREE_SYMBOLS / SECTORS en universe.ts), si no, no cargarían precio.
const DEFAULT_WATCHLIST = ["SPY", "QQQ", "MU", "META", "AMD", "GLD", "TSLA"];

// Minimizar el panel — la rayita de las ventanas. La gente no se daba
// cuenta de que se cerraba volviendo a tocar el botón "Favoritas" del
// toolbar (lo pidió Alejo).
function BotonMinimizar({ palette, onClose }: { palette: Palette; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="flex h-6 w-6 items-center justify-center rounded"
      style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
      title="Minimizar favoritas"
      aria-label="Minimizar favoritas"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <line x1="1.5" y1="5" x2="8.5" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/**
 * Lista de seguimiento (watchlist) de la Sala de Trading — como el panel
 * "Populares" de ProRealTime, con un buscador por categorías como el
 * "Agregar símbolo" de TradingView para armarla.
 *
 * Decisión de Alejo (17 sept. 2026): la Sala de Trading pasa a necesitar
 * acceso dado a mano desde /admin, igual que Introducción — antes bastaba
 * con tener cuenta (ver getSymbolAccess() en subscription.ts).
 */
export function Watchlist({
  symbol,
  onSelect,
  palette,
  onClose,
}: {
  symbol: string;
  onSelect: (s: string) => void;
  palette: Palette;
  onClose: () => void;
}) {
  // `null` mientras se confirma con el servidor si hay cuenta — así no se
  // le muestra por un instante el aviso de "crea una cuenta" a alguien que
  // sí tiene sesión, mientras carga.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  // Orden de la lista — clic en un encabezado ordena por esa columna; clic
  // de nuevo en el mismo encabezado invierte la dirección, como en la
  // watchlist de TradingView.
  const [ordenPor, setOrdenPor] = useState<OrdenColumna>("symbol");
  const [ordenAsc, setOrdenAsc] = useState(true);

  // El servidor decide (según la sesión) si hay cuenta y si tiene acceso
  // dado, y trae las categorías — el navegador nunca decide esto por su
  // cuenta.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/universe?scope=sala")
      .then((res) => res.json())
      .then((json: { sectors?: Sector[]; allowed?: boolean; status?: string }) => {
        if (cancelled) return;
        setAllowed(Boolean(json.allowed));
        setStatus(json.status ?? null);
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
        if (cancelled) return;
        // Si todavía no ha guardado ninguna, se muestran las de por defecto
        // (no se guardan solas: recién se persiste cuando agrega o quita
        // algo, y ahí su lista propia reemplaza a estas).
        const saved = json.symbols ?? [];
        setFavorites(saved.length ? saved : DEFAULT_WATCHLIST);
      })
      .catch(() => {
        if (!cancelled) setFavorites(DEFAULT_WATCHLIST);
      });
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

  function ordenarPor(columna: OrdenColumna) {
    if (columna === ordenPor) {
      setOrdenAsc((asc) => !asc);
    } else {
      setOrdenPor(columna);
      setOrdenAsc(true);
    }
  }

  // Sin precio todavía (`-Infinity`/`Infinity` según dirección) para que las
  // favoritas cuya cotización no ha llegado se vayan al final en vez de
  // aparecer primero por casualidad.
  const favoritasOrdenadas = useMemo(() => {
    const sinPrecio = ordenAsc ? Infinity : -Infinity;
    return [...favorites].sort((a, b) => {
      if (ordenPor === "symbol") {
        return ordenAsc ? a.localeCompare(b) : b.localeCompare(a);
      }
      const pa = quotes[a]?.price ?? sinPrecio;
      const pb = quotes[b]?.price ?? sinPrecio;
      return ordenAsc ? pa - pb : pb - pa;
    });
  }, [favorites, quotes, ordenPor, ordenAsc]);

  // Todavía no se sabe si hay cuenta — no se pinta nada para no parpadear.
  if (allowed === null) {
    return <div className="w-72 shrink-0" />;
  }

  if (!allowed) {
    // Sin cuenta: invita a registrarse. Con cuenta pero sin acceso dado:
    // decirlo tal cual — no tiene sentido ofrecerle "crear cuenta" a
    // alguien que ya tiene una.
    if (status === "sin-cuenta") {
      return (
        <div
          className="relative flex w-72 shrink-0 flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center"
          style={{ backgroundColor: palette.wrapperBg, borderColor: palette.wrapperBorder }}
        >
          <div className="absolute right-3 top-3">
            <BotonMinimizar palette={palette} onClose={onClose} />
          </div>
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

    return (
      <div
        className="relative flex w-72 shrink-0 flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center"
        style={{ backgroundColor: palette.wrapperBg, borderColor: palette.wrapperBorder }}
      >
        <div className="absolute right-3 top-3">
          <BotonMinimizar palette={palette} onClose={onClose} />
        </div>
        <p className="font-mono text-[11px] leading-relaxed" style={{ color: palette.textSoft }}>
          Todavía no tienes acceso a la Sala de Trading. Esta sección se
          habilita a mano, uno por uno — escríbenos y te damos acceso.
        </p>
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
        <div className="flex items-center gap-1.5">
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
          <BotonMinimizar palette={palette} onClose={onClose} />
        </div>
      </div>

      {favorites.length > 0 && (
        <div
          className="mb-1 flex items-center gap-1 px-2 font-mono text-[10px] uppercase tracking-wide opacity-70"
          style={{ color: palette.textSoft }}
        >
          <button
            type="button"
            onClick={() => ordenarPor("symbol")}
            className="flex flex-1 items-center gap-1 text-left"
          >
            Símbolo
            {ordenPor === "symbol" && <span>{ordenAsc ? "▲" : "▼"}</span>}
          </button>
          <button
            type="button"
            onClick={() => ordenarPor("price")}
            className="flex items-center gap-1"
          >
            Última
            {ordenPor === "price" && <span>{ordenAsc ? "▲" : "▼"}</span>}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {favorites.length === 0 && (
          <p className="mt-2 font-mono text-[11px] opacity-60" style={{ color: palette.textSoft }}>
            Todavía no tienes favoritas — dale a &ldquo;+&rdquo; para agregar.
          </p>
        )}
        {favoritasOrdenadas.map((s) => {
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
                <span className="flex items-center gap-1.5">
                  {/* Bandera de color — puramente visual, como la marca de
                      lista de colores de TradingView. */}
                  <span
                    className="h-2.5 w-1 shrink-0 rounded-sm"
                    style={{ backgroundColor: active ? palette.buttonActiveText : "#D4AF37" }}
                  />
                  {s}
                </span>
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

      {/* Ficha de detalle del símbolo activo del gráfico. Con datos reales
          que sí tenemos: símbolo, nombre de empresa/fondo, sector, y —
          cuando el símbolo está entre las favoritas (su cotización ya se
          consultó) — precio y % del día. Nada de noticias: no hay una
          fuente de eso todavía y este sitio no finge tener listo lo que no
          tiene (decisión de Alejo, sin noticias por ahora).

          El nombre y el sector son estáticos (no cuestan una consulta a
          Twelve Data), así que la ficha aparece SIEMPRE para el símbolo
          activo, no solo si es favorita; el precio solo se añade si ya se
          tiene la cotización, para no gastar una consulta extra solo por
          esta ficha. */}
      <div
        className="mt-2 border-t pt-2"
        style={{ borderColor: palette.wrapperBorder }}
      >
        <p className="font-mono text-sm font-medium" style={{ color: palette.buttonText }}>
          {symbol}
        </p>
        {nameOf(symbol) && (
          <p className="font-mono text-[11px]" style={{ color: palette.buttonText }}>
            {nameOf(symbol)}
          </p>
        )}
        {sectorOf(symbol) && (
          <p className="font-mono text-[10px] opacity-60" style={{ color: palette.textSoft }}>
            {sectorOf(symbol)}
          </p>
        )}
        {quotes[symbol]?.price != null && (
          <p className="mt-1 flex items-baseline gap-2 font-mono">
            <span className="text-lg" style={{ color: palette.buttonText }}>
              {quotes[symbol].price!.toFixed(2)}
            </span>
            <span
              className="text-xs"
              style={{
                color: (quotes[symbol].change ?? 0) >= 0 ? "#089981" : "#F23645",
              }}
            >
              {(quotes[symbol].change ?? 0) >= 0 ? "+" : ""}
              {quotes[symbol].percentChange?.toFixed(2)}%
            </span>
          </p>
        )}
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
