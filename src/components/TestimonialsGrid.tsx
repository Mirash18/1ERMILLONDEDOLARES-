"use client";

import { useEffect, useState } from "react";
import type { Testimonial } from "@/lib/testimonials";
import { CarruselHorizontal } from "./CarruselHorizontal";
import { TestimonialSourceIcon } from "./TestimonialSourceIcon";

/**
 * Las tarjetas de testimonios y la vista ampliada al hacer clic.
 *
 * Historia: primero fue un carrusel de dos filas moviéndose solas — Alejo
 * lo descartó ("va como un ciclo y queda feo": con pocos testimonios se
 * veía la misma tarjeta repetida). Después, una cuadrícula que crecía
 * hacia abajo; con más testimonios la página se volvía enorme. Ahora
 * (24 sept. 2026, pedido suyo): UNA fila, el último subido primero, y
 * flechas ← → para pasar — sin movimiento automático.
 *
 * Cada tarjeta muestra el ícono de dónde vino (WhatsApp / Instagram /
 * Facebook), elegido al subirla. Los viejos sin origen, sin ícono.
 *
 * Las imágenes van con `object-contain` y no `object-cover`: recortar
 * para que todas midan igual dejaba los testimonios "incompletos"
 * (también reportado por Alejo). Así se ve la imagen entera, y el que
 * quiera verla en grande le da clic.
 */

const HASHTAG = "#PrimerMillónDeDólares";

export function TestimonialsGrid({ items }: { items: Testimonial[] }) {
  const [ampliado, setAmpliado] = useState<Testimonial | null>(null);

  useEffect(() => {
    if (!ampliado) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAmpliado(null);
    }
    document.addEventListener("keydown", onKey);
    // Sin esto la página de atrás sigue desplazándose mientras se mira
    // la imagen ampliada.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [ampliado]);

  return (
    <>
      <div className="mx-auto max-w-5xl px-6">
        <CarruselHorizontal tono="claro">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAmpliado(t)}
            aria-label={`Ampliar el testimonio de ${t.name}`}
            className="flex h-full w-[260px] flex-col overflow-hidden rounded-lg border border-[#e4e0d4] bg-[#fbfaf6] text-left shadow-sm transition-transform hover:-translate-y-0.5 sm:w-[280px]"
          >
            <div className="flex h-44 w-full items-center justify-center bg-[#11161c]">
              {t.mediaType === "video" ? (
                <video
                  src={t.mediaUrl}
                  className="h-full w-full object-contain"
                  muted
                  loop
                  playsInline
                  autoPlay
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.mediaUrl}
                  alt={t.name}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2.5 p-4">
              {/* Encabezado estilo red social: glifo + nombre del alumno. */}
              <div className="flex items-center gap-2">
                {t.source && <TestimonialSourceIcon source={t.source} />}
                <span className="flex-1 truncate font-sans text-[13px] font-semibold text-[#2a2a24]">
                  {t.name}
                </span>
              </div>
              <p className="text-sm leading-snug text-[#2a2a24]">
                &ldquo;{t.text}&rdquo;
              </p>
              <span className="mt-auto font-sans text-[11px] font-semibold text-[#a9821e]">
                {HASHTAG}
              </span>
            </div>
          </button>
        ))}
        </CarruselHorizontal>
      </div>

      {ampliado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Testimonio de ${ampliado.name}`}
          onClick={() => setAmpliado(null)}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/90 p-4"
        >
          <button
            type="button"
            onClick={() => setAmpliado(null)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white transition-colors hover:bg-white/20"
          >
            ×
          </button>

          {ampliado.mediaType === "video" ? (
            <video
              src={ampliado.mediaUrl}
              className="max-h-[80vh] max-w-full rounded"
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ampliado.mediaUrl}
              alt={ampliado.name}
              className="max-h-[80vh] max-w-full rounded object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}

          <div className="flex max-w-xl flex-col items-center gap-1 text-center">
            <div className="flex items-center gap-2">
              {ampliado.source && <TestimonialSourceIcon source={ampliado.source} />}
              <span className="font-sans text-sm font-semibold text-white">
                {ampliado.name}
              </span>
            </div>
            <p className="text-sm text-white/90">&ldquo;{ampliado.text}&rdquo;</p>
            <span className="font-sans text-[11px] font-semibold text-gold">
              {HASHTAG}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
