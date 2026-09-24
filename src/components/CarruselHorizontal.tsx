"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fila horizontal con flechas ← → para ir pasando tarjetas, una por una.
 * Pedido de Alejo para los testimonios (24 sept. 2026): en cuadrícula la
 * página crecía hacia abajo sin fin; en fila se ve siempre primero el
 * último subido y se pasa con las flechas (en celular, también
 * deslizando con el dedo). Sin movimiento automático — el carrusel que se
 * movía solo ya se había descartado ("va como un ciclo y queda feo").
 *
 * Las flechas solo aparecen cuando hay más tarjetas hacia ese lado. Si
 * todas caben, se ven centradas y sin flechas.
 */
export function CarruselHorizontal({
  children,
  // Al cambiar (p. ej. se subió un testimonio nuevo), vuelve al inicio para
  // que se vea el recién agregado.
  claveReinicio,
  tono = "oscuro",
}: {
  children: ReactNode;
  claveReinicio?: unknown;
  tono?: "oscuro" | "claro";
}) {
  const filaRef = useRef<HTMLDivElement>(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);

  const actualizar = useCallback(() => {
    const el = filaRef.current;
    if (!el) return;
    setPuedeIzq(el.scrollLeft > 4);
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = filaRef.current;
    if (!el) return;
    actualizar();
    const ro = new ResizeObserver(actualizar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [actualizar, children]);

  useEffect(() => {
    filaRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [claveReinicio]);

  // Avanza exactamente una tarjeta (su ancho + el espacio entre tarjetas).
  function mover(direccion: 1 | -1) {
    const el = filaRef.current;
    const primera = el?.firstElementChild as HTMLElement | null;
    if (!el || !primera) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: direccion * (primera.offsetWidth + gap), behavior: "smooth" });
  }

  const estiloFlecha =
    tono === "claro"
      ? "bg-white text-[#2a2a24] shadow-md hover:bg-[#f1ede2]"
      : "border border-border bg-panel text-text shadow-md hover:border-gold hover:text-gold";

  return (
    <div className="relative">
      <div
        ref={filaRef}
        onScroll={actualizar}
        // `w-fit max-w-full mx-auto`: si todas caben, quedan centradas; si
        // no, la fila ocupa el ancho y se desplaza. Sin barra de
        // desplazamiento visible — para eso están las flechas.
        className="mx-auto flex w-fit max-w-full snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* `pt-1`: espacio para el leve salto hacia arriba de la tarjeta al
            pasarle el mouse (si no, el borde de arriba se corta). */}
        {Children.map(children, (hijo) => (
          <div className="shrink-0 snap-start pt-1">{hijo}</div>
        ))}
      </div>

      {puedeIzq && (
        <button
          type="button"
          onClick={() => mover(-1)}
          aria-label="Ver testimonios anteriores"
          className={`absolute left-0 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors ${estiloFlecha}`}
        >
          <Flecha direccion="izq" />
        </button>
      )}
      {puedeDer && (
        <button
          type="button"
          onClick={() => mover(1)}
          aria-label="Ver más testimonios"
          className={`absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full transition-colors ${estiloFlecha}`}
        >
          <Flecha direccion="der" />
        </button>
      )}
    </div>
  );
}

function Flecha({ direccion }: { direccion: "izq" | "der" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direccion === "izq" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
    </svg>
  );
}
