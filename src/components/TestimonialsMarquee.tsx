import Image from "next/image";
import type { Testimonial } from "@/lib/testimonials";
import { TestimonialsGrid } from "./TestimonialsGrid";

/**
 * Fondo de la sección de testimonios: la ilustración que mandó Alejo —
 * el toro y el oso como siluetas doradas tenues a los lados, con el
 * centro oscuro y limpio para que las tarjetas se lean primero.
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
        src="/testimonios-siluetas.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-center"
      />
      {/* Velo suave: esta ilustración ya nace oscura y con el centro
          limpio (se pidió así justamente para que las tarjetas fueran lo
          primero que se lee). */}
      <div className="absolute inset-0 bg-black/15" />
    </div>
  );
}

export function TestimonialsMarquee({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null;

  return (
    <section className="relative overflow-hidden pb-24 pt-16">
      <TradingBackdrop />
      <div className="relative">
        {/* Centrado: la ilustración tiene el toro a la izquierda y el oso
            a la derecha, con el centro oscuro y limpio. El título cae
            justo en ese hueco, entre los dos animales. */}
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
