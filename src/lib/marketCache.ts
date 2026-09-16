/**
 * Caché persistente de datos de mercado en Redis (Upstash), para no
 * volverle a pedir a Twelve Data lo mismo una y otra vez.
 *
 * Nació del incidente del 15 de sept. de 2026 (ver docs/ARQUITECTURA.md):
 * el plan gratuito de Twelve Data (800 créditos/día) se agotaba en menos de
 * dos horas con una sola pestaña abierta, porque cada refresco del
 * navegador terminaba pegándole otra vez a la API. Con esto:
 *
 *   - Mientras el mercado está en sesión regular, el dato se refresca cada
 *     pocos minutos (igual que antes, solo que ahora respaldado por una
 *     caché real y compartida entre TODAS las visitas, no una por cada
 *     invocación fría del servidor).
 *   - Con el mercado cerrado (o fuera de sesión), el último dato guardado
 *     no cambia — así que se sirve tal cual, sin gastar un solo crédito
 *     más, hasta que abra de nuevo. Es justo lo que pidió Alejo: poder ver
 *     las velas del día después del cierre sin tener que re-pedirlas.
 *
 * Sin las llaves de Redis puestas (`REDIS_KV_REST_API_URL` /
 * `REDIS_KV_REST_API_TOKEN`, las crea solo la integración de Upstash en
 * Vercel), esto se comporta como si no hubiera caché — mismo criterio del
 * resto del proyecto: una pieza opcional que falla en silencio, nunca
 * tumba el sitio.
 */

import { Redis } from "@upstash/redis";
import type { MarketSession } from "./marketData";

let client: Redis | null | undefined;

/**
 * El mismo cliente de Redis, para quien necesite guardar algo que no es
 * caché de mercado (por ejemplo, la lista de seguimiento de cada usuario en
 * `src/lib/watchlist.ts`) — esos datos no expiran solos, así que no pasan
 * por `getCached`/`setCached` (que siempre le ponen un TTL).
 */
export function getRedisClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_KV_REST_API_URL;
  const token = process.env.REDIS_KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

type Cached<T> = {
  value: T;
  fetchedAt: number; // Date.now(), en milisegundos.
};

export async function getCached<T>(key: string): Promise<Cached<T> | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    return await redis.get<Cached<T>>(key);
  } catch {
    // Un fallo de Redis nunca debe tumbar el gráfico ni las cotizaciones —
    // simplemente se trata como si no hubiera nada guardado.
    return null;
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    const entry: Cached<T> = { value, fetchedAt: Date.now() };
    await redis.set(key, entry, { ex: ttlSeconds });
  } catch {
    // Si falla la escritura, el próximo pedido simplemente vuelve a pedirle
    // a Twelve Data — no es crítico, solo se pierde el ahorro de esta vez.
  }
}

/**
 * Cuánto puede vivir un dato guardado antes de considerarse viejo.
 *
 * Fuera de la sesión regular el dato no cambia — Twelve Data no publica
 * velas ni cotizaciones nuevas mientras el mercado está cerrado — así que
 * se guarda por horas en vez de minutos. En sesión regular se mantiene un
 * refresco frecuente para que se sienta "vivo".
 */
export function cacheTtlSeconds(session: MarketSession): number {
  return session === "regular" ? 5 * 60 : 12 * 60 * 60;
}
