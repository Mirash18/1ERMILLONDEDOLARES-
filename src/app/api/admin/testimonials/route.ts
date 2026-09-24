import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { isAdmin } from "@/lib/admin";
import {
  isTestimonialSource,
  removeTestimonial,
  setTestimonialSource,
} from "@/lib/testimonials";

/**
 * Cambia de dónde viene un testimonio ya subido (WhatsApp / Instagram /
 * Facebook) — para los que se subieron antes de que existiera el campo.
 *
 * Body: `{ id: string, source: "whatsapp" | "instagram" | "facebook" }`.
 */
export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const source = body?.source;
  if (!id || !isTestimonialSource(source)) {
    return NextResponse.json({ error: "falta el id o el origen" }, { status: 400 });
  }

  const updated = await setTestimonialSource(id, source);
  if (!updated) {
    return NextResponse.json({ error: "no se encontró el testimonio" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, testimonial: updated });
}

/**
 * Subir un testimonio nuevo pasa por `/api/admin/testimonials/upload`
 * (subida directa del navegador a Blob) — esta ruta solo borra. Ver el
 * comentario en `upload/route.ts` sobre por qué no se sube el archivo
 * por acá.
 *
 * Body: `{ id: string }`. Borra el registro y su archivo en Blob.
 */
export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "falta el id" }, { status: 400 });
  }

  const removed = await removeTestimonial(id);
  if (removed) {
    // Mismo token con prefijo BLOB_PUBLIC_* del store público — ver el
    // comentario en upload/route.ts.
    await del(removed.mediaUrl, { token: process.env.BLOB_PUBLIC_READ_WRITE_TOKEN }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
