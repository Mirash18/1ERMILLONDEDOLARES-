import Image from "next/image";
import Link from "next/link";
import { TickerStrip } from "@/components/TickerStrip";
import { CandleChart } from "@/components/CandleChart";
import { SiteHeader } from "@/components/SiteHeader";
import { TestimonialsMarquee } from "@/components/TestimonialsMarquee";
import { getTestimonials } from "@/lib/testimonials";

// Sin esto, Next.js detecta que la página no depende de nada dinámico
// (cookies, headers, params) y la deja estática desde el build — un
// testimonio nuevo subido desde /admin/testimonios nunca aparecería sin
// un redeploy. 60s es más que suficiente para "se va viendo lo que se
// va haciendo día a día" sin pegarle a Redis en cada visita.
export const revalidate = 60;

const modules = [
  {
    tag: "Clases en vivo",
    title: "Profesor Miguel Cortés",
    status: "Fase 4 — pendiente",
    body: "Clases lunes a viernes vía Vimeo, con acceso ligado al estado de la suscripción.",
  },
  {
    tag: "Herramientas",
    title: "Calculadora y estudios",
    status: "Fase 5 — pendiente",
    body: "Calculadora de velas (Black-Scholes) y estudios técnicos (PM, RSI, volumen).",
  },
];

export default async function Home() {
  const testimonials = await getTestimonials();

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <SiteHeader />

      <section className="hero-brand-bg relative overflow-hidden">
        {/* A diferencia del fondo de testimonios, este SÍ lleva `priority`:
            es lo primero que se ve al abrir la página. Si se cargara de
            forma diferida, el hero aparecería oscuro y la ilustración
            entraría de golpe un segundo después — justo la sensación de
            lentitud que queremos evitar. El degradado de `.hero-brand-bg`
            queda debajo como base mientras la imagen llega. */}
        <div aria-hidden className="fundido-abajo pointer-events-none absolute inset-0">
          <Image
            src="/hero-velas.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          {/* Velo apenas insinuado, y se apaga del todo antes de llegar a
              las velas. Esta ilustración ya nace con la mitad izquierda
              negra (se pidió así a propósito), así que taparla más solo
              apagaba el dibujo sin ganar contraste: sobre negro, un velo
              oscuro no se nota. Se conserva únicamente por el celular,
              donde la sección es alta y angosta, el recorte se come el
              margen izquierdo y las velas se le acercan al texto. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(5,12,10,0.55),rgba(5,12,10,0.12)_45%,transparent_65%)]" />
        </div>
        <div className="relative mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
          <p className="mb-3 font-sans text-xs uppercase tracking-[0.14em] text-[#8fc4f2]">
            Análisis, señales y educación
          </p>
          <h1 className="max-w-2xl text-balance font-display text-4xl font-medium leading-tight text-white sm:text-5xl">
            Aprende a leer el mercado antes de arriesgar tu capital.
          </h1>
          <p className="mt-4 max-w-xl text-[#c7d2c4]">
            Gráficos en vivo, herramientas de estudio y las clases del
            profesor Miguel Cortés, todo en un mismo lugar.
          </p>
          <Link
            href="/introduccion"
            className="mt-7 inline-flex w-fit items-center rounded-md bg-[#4c8fd1] px-5 py-2.5 font-sans text-sm font-medium text-[#06111d] transition-colors hover:bg-[#5fa0e0]"
          >
            Empezar en la academia
          </Link>
        </div>
      </section>

      {/* La ilustración del toro y el oso va DETRÁS de la sección, no
          detrás del gráfico. El gráfico pinta su propio fondo opaco y
          queda encima como una tarjeta sólida: así la ilustración
          enmarca la herramienta sin que las velas finas, las medias
          móviles y las etiquetas de precio tengan que pelear contra un
          oso. Carga diferida (sin `priority`) — a esta altura de la
          página el usuario ya tiene que haber bajado. */}
      <div className="relative flex-1 overflow-hidden bg-bg">
        <div aria-hidden className="fundido-vertical pointer-events-none absolute inset-0">
          <Image
            src="/fondo-grafico.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-left"
          />
          <div className="absolute inset-0 bg-[rgba(6,12,10,0.62)]" />
        </div>
        <main className="relative mx-auto w-full max-w-5xl px-6 py-16">
          <section className="mb-8">
            <TickerStrip />
          </section>

          <section>
            <CandleChart />
          </section>
        </main>
      </div>

      <TestimonialsMarquee items={testimonials} />

      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        <section>
          <div className="mb-6 flex items-center gap-3">
            <h2 className="font-display text-xl font-medium text-text">
              Lo que viene
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map((m) => (
              <div
                key={m.title}
                className="flex flex-col gap-2 rounded-lg border border-border bg-panel p-5"
              >
                <span className="font-sans text-[11px] uppercase tracking-[0.1em] text-gold">
                  {m.tag}
                </span>
                <h3 className="font-display text-lg font-medium text-text">
                  {m.title}
                </h3>
                <p className="text-sm text-text-soft">{m.body}</p>
                <span className="mt-1 w-fit rounded border border-border bg-input px-2 py-1 font-sans text-[10px] text-text-soft">
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-border px-6 py-6 text-center font-sans text-[11px] text-text-soft">
        1er Millón de Dólares — contenido educativo, no es asesoría financiera.
      </footer>
    </div>
  );
}
