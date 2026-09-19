/**
 * Testimonios de alumnos (imagen o video + texto corto) — el "repositorio"
 * que pidió Alejo para ir subiendo, día a día, lo que se va logrando.
 *
 * Los archivos (imagen/video) viven en Vercel Blob; acá solo se guarda el
 * texto y la URL que Blob devuelve, en el mismo Redis (Upstash) que ya usa
 * `watchlist.ts` — una sola lista, sin vencimiento (no es caché de mercado,
 * es contenido real que no se puede perder). Mismo criterio de fallar en
 * silencio del resto del proyecto: sin las llaves de Redis puestas, esto se
 * comporta como si no hubiera testimonios todavía, nunca tumba el sitio.
 */

import { getRedisClient } from "./marketCache";

const KEY = "testimonials:list";
// Tope de cuántos se guardan — una vitrina, no un archivo histórico
// completo. Los más viejos se van cayendo solos al llegar nuevos.
const MAX_TESTIMONIALS = 60;

export type Testimonial = {
  id: string;
  name: string;
  text: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  createdAt: number;
};

export async function getTestimonials(): Promise<Testimonial[]> {
  const redis = getRedisClient();
  if (!redis) return [];
  try {
    const list = await redis.get<Testimonial[]>(KEY);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function addTestimonial(
  input: Omit<Testimonial, "id" | "createdAt">
): Promise<Testimonial | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  const testimonial: Testimonial = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  };

  try {
    const current = await getTestimonials();
    const next = [testimonial, ...current].slice(0, MAX_TESTIMONIALS);
    await redis.set(KEY, next);
    return testimonial;
  } catch {
    return null;
  }
}

/** Devuelve el testimonio borrado (para poder borrar también su archivo de
 * Blob desde quien llama), o `null` si no existía o no se pudo guardar. */
export async function removeTestimonial(id: string): Promise<Testimonial | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const current = await getTestimonials();
    const found = current.find((t) => t.id === id) ?? null;
    if (!found) return null;
    await redis.set(
      KEY,
      current.filter((t) => t.id !== id)
    );
    return found;
  } catch {
    return null;
  }
}
