import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { isAdmin } from "@/lib/admin";
import { removeTestimonial } from "@/lib/testimonials";

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
    await del(removed.mediaUrl).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
