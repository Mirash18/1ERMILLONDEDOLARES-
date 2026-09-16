/**
 * Lista de seguimiento (watchlist) personal — solo para la Sala de Trading.
 *
 * Se guarda en el mismo Redis que la caché de mercado, pero SIN vencimiento:
 * a diferencia de una vela o una cotización, la lista de favoritas de
 * alguien no se puede volver a pedir si se pierde. Por eso usa
 * `getRedisClient()` directo en vez de `getCached`/`setCached` (que le
 * ponen TTL a todo).
 *
 * OJO — esta base de Redis tiene "eviction" activado (Storage → Upstash en
 * Vercel), pensado para cuando la caché de mercado se llene y haya que
 * botar lo más viejo. Mientras el proyecto sea chico el riesgo de que eso
 * bote una watchlist real es bajísimo, pero si esto crece en serio hay que
 * separar la watchlist a su propio almacenamiento (o una base de datos de
 * verdad) — ver "Decisiones pendientes" en docs/ARQUITECTURA.md.
 *
 * Sin las llaves de Redis puestas, esto no persiste nada (mismo criterio de
 * fallar en silencio del resto del proyecto) — la Sala de Trading sigue
 * funcionando, solo que sin guardar favoritas de una visita a la otra.
 */

import { getRedisClient } from "./marketCache";
import { isFreeSymbol, isPaidSymbol } from "./universe";

const MAX_SYMBOLS = 30;

function key(userId: string): string {
  return `watchlist:${userId}`;
}

export async function getWatchlist(userId: string): Promise<string[]> {
  const redis = getRedisClient();
  if (!redis) return [];
  try {
    const list = await redis.get<string[]>(key(userId));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Reemplaza la lista completa. Filtra cualquier símbolo que no exista en el
 * proyecto (nunca se guarda lo que el navegador mande sin más) y la recorta
 * a `MAX_SYMBOLS` para que nadie termine con una lista de miles de
 * símbolos por error. Devuelve la lista ya limpia, la haya podido guardar o
 * no — así el navegador siempre sabe qué quedó de verdad.
 */
export async function setWatchlist(
  userId: string,
  symbols: string[]
): Promise<string[]> {
  const clean = Array.from(new Set(symbols.map((s) => s.toUpperCase())))
    .filter((s) => isFreeSymbol(s) || isPaidSymbol(s))
    .slice(0, MAX_SYMBOLS);

  const redis = getRedisClient();
  if (!redis) return clean;
  try {
    await redis.set(key(userId), clean);
  } catch {
    // No se pudo guardar — el navegador se queda con la lista en su estado
    // local hasta el próximo intento; no es motivo para romper nada.
  }
  return clean;
}
