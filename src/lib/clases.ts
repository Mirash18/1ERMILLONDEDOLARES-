/**
 * Clases con el profesor Miguel — por Zoom mientras tanto (decisión de
 * Alejo, 26 sept. 2026). La transmisión dentro de la página quedó para más
 * adelante: mucha gente mira la clase desde el celular y opera desde el
 * mismo celular, y un video dentro de la página no les dejaría escuchar y
 * operar a la vez.
 *
 * Aquí se guarda, en el mismo Redis de los testimonios (sin vencimiento):
 *
 *   - El link de Zoom de la semana y la fecha de la "clase abierta" del
 *     plan básico — los cambia el admin desde /admin.
 *   - Un registro de quién le dio "Entrar a la clase" y cuándo. La página
 *     no puede saber quién está conectado dentro de Zoom; esto es lo más
 *     cercano, y de paso deja ver si un link se está compartiendo (llegan
 *     diez a la clase y acá entró uno).
 *
 * Sin Redis (en local) todo responde vacío y nada se guarda — mismo
 * criterio de fallar en silencio del resto del proyecto.
 */

import { getRedisClient } from "./marketCache";

const KEY_CONFIG = "clases:config";
const KEY_INGRESOS = "clases:ingresos";
// Tope del registro de ingresos: suficiente para varias semanas de clases.
const MAX_INGRESOS = 2000;

export type ClasesConfig = {
  /** Link de Zoom vigente (https). `null` si todavía no se publicó. */
  zoomUrl: string | null;
  /** Día de la clase abierta del plan básico, AAAA-MM-DD (hora de Colombia). */
  fechaClaseAbierta: string | null;
};

export type IngresoClase = {
  userId: string;
  nombre: string | null;
  email: string | null;
  /** Unix ms. */
  fecha: number;
  /** Por qué pudo entrar: plan con clases, o la clase abierta del básico. */
  via: "clases" | "clase-abierta";
};

const CONFIG_VACIA: ClasesConfig = { zoomUrl: null, fechaClaseAbierta: null };

export async function getClasesConfig(): Promise<ClasesConfig> {
  const redis = getRedisClient();
  if (!redis) return CONFIG_VACIA;
  try {
    const c = await redis.get<ClasesConfig>(KEY_CONFIG);
    return { ...CONFIG_VACIA, ...(c ?? {}) };
  } catch {
    return CONFIG_VACIA;
  }
}

export async function setClasesConfig(config: ClasesConfig): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    await redis.set(KEY_CONFIG, config);
    return true;
  } catch {
    return false;
  }
}

export async function registrarIngreso(ingreso: IngresoClase): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.lpush(KEY_INGRESOS, ingreso);
    await redis.ltrim(KEY_INGRESOS, 0, MAX_INGRESOS - 1);
  } catch {
    // Si falla el registro, la persona igual entra a la clase — el registro
    // es para control, no puede dejar a alguien afuera.
  }
}

/** Los ingresos más recientes primero. */
export async function getIngresos(limite = 300): Promise<IngresoClase[]> {
  const redis = getRedisClient();
  if (!redis) return [];
  try {
    return await redis.lrange<IngresoClase>(KEY_INGRESOS, 0, limite - 1);
  } catch {
    return [];
  }
}

/** Solo links https — lo que se pega en el admin termina en un redirect. */
export function esLinkValido(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Hoy en Colombia, AAAA-MM-DD — la fecha de la clase abierta se marca así. */
export function hoyColombia(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}
