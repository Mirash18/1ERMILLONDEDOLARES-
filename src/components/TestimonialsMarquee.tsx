import Image from "next/image";
import type { Testimonial } from "@/lib/testimonials";
import { TestimonialsGrid } from "./TestimonialsGrid";

/**
 * Fondo de la sección de testimonios: una foto de escritorio de trading
 * desenfocada (monitores con velas verdes, ambiente nocturno azul), al
 * estilo de la referencia que mandó Alejo, con un velo oscuro encima
 * para que las tarjetas claras de los testimonios se lean primero.
 *
 * **Sin `priority` a propósito.** Esta sección va bien abajo de la
 * página, así que la imagen se descarga recién cuando alguien baja
 * hasta acá (carga diferida, el comportamiento por defecto de
 * `next/image`). La primera pantalla — que es lo que decide si la
 * página "se siente rápida" — no carga ni un byte de esto. Marcarla
 * como prioritaria arruinaría justamente eso.
 *
 * `sizes="100vw"` porque ocupa todo el ancho: le dice a Next qué
 * versión mandarle a cada dispositivo, para que un celular no se
 * descargue la de 2000px.
 *
 * Todo el fondo es decorativo: `aria-hidden` para que un lector de
 * pantalla no lo anuncie, y `pointer-events-none` para que no le robe
 * clics a las tarjetas que van encima.
 */
function TradingBackdrop() {
  return (
    <div aria-hidden className="fundido-vertical pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[#0b0e14]" />
      <Image
        src="/testimonios-trading.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* Velo un poco más marcado que antes: esta foto (escritorio de
          trading desenfocado) tiene monitores iluminados por todo el
          ancho, así que se oscurece un poco más para que las tarjetas
          claras de los testimonios sigan siendo lo primero que se lee. */}
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}

export function TestimonialsMarquee({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null;

  return (
    <section className="relative overflow-hidden pb-24 pt-16">
      <TradingBackdrop />
      <div className="relative">
        {/* Título centrado sobre el fondo de escritorio de trading. */}
        <div className="mx-auto mb-8 max-w-5xl px-6 text-center">
          <h2 className="font-display text-2xl font-medium text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            Lo que dicen nuestros alumnos
          </h2>
        </div>
        <TestimonialsGrid items={items} />
      </div>
    </section>
  );
}
