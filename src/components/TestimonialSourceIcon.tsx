import {
  TESTIMONIAL_SOURCE_LABEL,
  type TestimonialSource,
} from "@/lib/testimonialSources";

/**
 * Ícono de dónde viene un testimonio: WhatsApp (verde), Instagram
 * (degradado) o Facebook (azul). Glifos simplificados con los colores de
 * cada red — lo justo para reconocerla de un vistazo en la tarjeta.
 */
export function TestimonialSourceIcon({
  source,
  size = 24,
}: {
  source: TestimonialSource;
  size?: number;
}) {
  const label = `Vía ${TESTIMONIAL_SOURCE_LABEL[source]}`;
  const glifo = Math.round(size * 0.58);

  if (source === "whatsapp") {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: "#25D366" }}
      >
        {/* Globo de chat con un teléfono adentro. */}
        <svg width={glifo} height={glifo} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M9.2 8.3c.2-.4.5-.4.8-.4h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.5.9 1.3 1.7 2.3 2.2.2.1.4 0 .5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.2.3.4 0 .9-.6 1.6-1.5 1.8-1 .2-2.3-.2-3.9-1.5-1.6-1.3-2.4-2.8-2.5-3.8-.1-.7.1-1.2.3-1.5Z"
            fill="white"
          />
        </svg>
      </span>
    );
  }

  if (source === "facebook") {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: "#1877F2" }}
      >
        {/* La "f". */}
        <svg width={glifo} height={glifo} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z"
            fill="white"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)",
      }}
    >
      {/* Cámara: marco redondeado, lente y punto. */}
      <svg
        width={glifo}
        height={glifo}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none" />
      </svg>
    </span>
  );
}
