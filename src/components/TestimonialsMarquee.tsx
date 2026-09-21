import Image from "next/image";
import type { Testimonial } from "@/lib/testimonials";

// Componente de servidor a propósito — el movimiento es puro CSS
// (@keyframes en globals.css), no hace falta JS ni "use client" para
// nada de esto.

// Velas del fondo. Se calculan una sola vez al cargar el módulo, con
// senos en vez de Math.random(): tiene que dar EXACTAMENTE lo mismo en
// el servidor y en el navegador o React se queja de que el HTML no
// coincide. Por eso también van redondeadas a enteros — así no depende
// de decimales que podrían diferir entre motores.
const CANDLE_COUNT = 30;
const CANDLES = Array.from({ length: CANDLE_COUNT }, (_, i) => {
  const centro = 95 + Math.sin(i * 0.5) * 30 + Math.sin(i * 1.9) * 14;
  const cuerpo = 14 + ((i * 7) % 4) * 9;
  const mecha = 8 + ((i * 5) % 3) * 7;
  const sube = Math.sin(i * 1.9) >= 0;
  return {
    x: Math.round(18 + i * 40),
    top: Math.round(centro - cuerpo / 2),
    alto: Math.round(cuerpo),
    mechaArriba: Math.round(mecha),
    mechaAbajo: Math.round(mecha * 0.7),
    sube,
  };
});

/**
 * Fondo de la sección de testimonios: velas verdes y rojas como las de
 * un gráfico real, y el toro y el oso del logo de fondo, en grande y
 * muy tenues — la alegoría clásica del mercado (idea de Alejo).
 *
 * Todo esto es decorativo: `aria-hidden` para que un lector de pantalla
 * no lo anuncie, y `pointer-events-none` para que no le robe clics a
 * las tarjetas que van encima.
 */
function TradingBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#0a1420,#0d1a14_80%)]" />

      <Image
        src="/logo-icon.png"
        alt=""
        width={613}
        height={486}
        className="absolute right-[-60px] top-1/2 w-[380px] max-w-none -translate-y-1/2 opacity-[0.09] sm:w-[520px]"
      />

      <svg
        className="absolute inset-x-0 bottom-0 h-[230px] w-full"
        viewBox="0 0 1200 190"
        preserveAspectRatio="none"
      >
        {CANDLES.map((c, i) => {
          const color = c.sube ? "#089981" : "#f23645";
          const centroX = c.x + 9;
          return (
            <g key={i} opacity="0.65">
              <line
                x1={centroX}
                y1={c.top - c.mechaArriba}
                x2={centroX}
                y2={c.top + c.alto + c.mechaAbajo}
                stroke={color}
                strokeWidth="2"
              />
              <rect x={c.x} y={c.top} width="18" height={c.alto} fill={color} />
            </g>
          );
        })}
      </svg>

      {/* Difumina las velas hacia arriba para que no compitan con las
          tarjetas. El color del degradado es el mismo con el que termina
          el fondo de la sección, para que no se note el empalme. */}
      <div className="absolute inset-x-0 bottom-0 h-[230px] bg-[linear-gradient(to_top,transparent,#0d1a14)]" />
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
        <div className="mx-auto mb-8 max-w-5xl px-6">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-[#8fc4f2]">
            Testimonios
          </p>
          <h2 className="font-display text-2xl font-medium text-white">
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
