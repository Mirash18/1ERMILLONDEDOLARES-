// De dónde viene un testimonio — la tarjeta muestra ese ícono. Archivo
// aparte (sin Redis) para que lo puedan importar también los componentes
// del navegador.
export const TESTIMONIAL_SOURCES = ["whatsapp", "instagram", "facebook"] as const;
export type TestimonialSource = (typeof TESTIMONIAL_SOURCES)[number];

export const TESTIMONIAL_SOURCE_LABEL: Record<TestimonialSource, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
};

export function isTestimonialSource(v: unknown): v is TestimonialSource {
  return typeof v === "string" && (TESTIMONIAL_SOURCES as readonly string[]).includes(v);
}
