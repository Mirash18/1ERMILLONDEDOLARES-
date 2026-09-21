import Image from "next/image";
import type { Testimonial } from "@/lib/testimonials";

// Componente de servidor a propósito — el movimiento es puro CSS
// (@keyframes en globals.css), no hace falta JS ni "use client" para
// nada de esto.

/**
 * Fondo de la sección de testimonios: la ilustración que mandó Alejo —
 * velas verdes y rojas, el toro y el oso, la alegoría clásica del
 * mercado. Reemplazó una versión dibujada a mano con SVG que se quedaba
 * corta al lado de esta.
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
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[#0b1410]" />
      <Image
        src="/fondo-testimonios.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-bottom"
      />
      {/* Vela de oscuridad encima: la ilustración tiene zonas claras
          (el toro, los destellos) y las tarjetas van justo ahí. Esto
          baja el contraste del fondo lo suficiente para que el texto de
          las tarjetas siga siendo lo primero que se lee. */}
      <div className="absolute inset-0 bg-black/25" />
    </div>
  );
}

function Card({ t }: { t: Testimonial }) {
  return (
    <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-[#e4e0d4] bg-[#fbfaf6] shadow-sm">
      {t.mediaType === "video" ? (
        <video
          src={t.mediaUrl}
          className="h-40 w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.mediaUrl} alt={t.name} className="h-40 w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-sm leading-snug text-[#2a2a24]">&ldquo;{t.text}&rdquo;</p>
        <span className="mt-auto font-mono text-[11px] font-medium text-[#4c8fd1]">
          {t.name}
        </span>
      </div>
    </div>
  );
}

function Row({
  items,
  reverse,
}: {
  items: Testimonial[];
  reverse: boolean;
}) {
  // Se duplica la lista una vez: con el track animado exactamente -50% de
  // su ancho total, la segunda mitad (idéntica a la primera) entra justo
  // cuando la primera termina de salir — el bucle no se nota.
  const doubled = [...items, ...items];
  return (
    <div className="marquee-row overflow-hidden">
      <div
        className={`flex w-max gap-4 ${reverse ? "marquee-track-reverse" : "marquee-track"}`}
      >
        {doubled.map((t, i) => (
          <Card key={`${t.id}-${i}`} t={t} />
        ))}
      </div>
    </div>
  );
}

export function TestimonialsMarquee({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null;

  // Con pocos testimonios, una sola fila alcanza — la segunda fila (en
  // sentido contrario) se agrega recién cuando hay variedad suficiente
  // para que no se sienta como repetir lo mismo dos veces seguidas.
  const mitad = Math.ceil(items.length / 2);
  const filaUno = items.slice(0, mitad);
  const filaDos = items.slice(mitad);

  return (
    <section className="relative overflow-hidden pb-28 pt-16">
      <TradingBackdrop />
      <div className="relative">
        {/* Centrado y sin la etiqueta de "Testimonios": la ilustración de
            fondo ya trae el logo arriba al centro, así que el título va
            debajo y alineado con él — si no, quedaban la marca, la
            etiqueta y el título como tres cosas apiladas peleándose. */}
        <div className="mx-auto mb-8 max-w-5xl px-6 text-center">
          <h2 className="font-display text-2xl font-medium text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            Lo que dicen nuestros alumnos
          </h2>
        </div>
        <div className="flex flex-col gap-4">
          <Row items={filaUno} reverse={false} />
          {filaDos.length > 0 && <Row items={filaDos} reverse />}
        </div>
      </div>
    </section>
  );
}
