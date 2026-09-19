import type { Testimonial } from "@/lib/testimonials";

// Componente de servidor a propósito — el movimiento es puro CSS
// (@keyframes en globals.css), no hace falta JS ni "use client" para
// nada de esto.

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
    <section className="bg-[#f4f1e8] py-14">
      <div className="mx-auto mb-8 max-w-5xl px-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-[#4c8fd1]">
          Testimonios
        </p>
        <h2 className="font-display text-2xl font-medium text-[#1c1c16]">
          Lo que dicen nuestros alumnos
        </h2>
      </div>
      <div className="flex flex-col gap-4">
        <Row items={filaUno} reverse={false} />
        {filaDos.length > 0 && <Row items={filaDos} reverse />}
      </div>
    </section>
  );
}
