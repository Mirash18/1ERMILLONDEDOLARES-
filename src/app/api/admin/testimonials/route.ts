import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { isAdmin } from "@/lib/admin";
import { addTestimonial, removeTestimonial } from "@/lib/testimonials";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB

/**
 * Sube un testimonio nuevo (imagen o video + nombre + texto corto) al
 * repositorio que ve todo el mundo en el homepage. Solo admins — el
 * archivo va a Vercel Blob, el texto queda en Redis (ver
 * `src/lib/testimonials.ts`).
 *
 * multipart/form-data: `file`, `name`, `text`.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const name = String(form?.get("name") ?? "").trim();
  const text = String(form?.get("text") ?? "").trim();

  if (!(file instanceof File) || !name || !text) {
    return NextResponse.json(
      { error: "faltan el archivo, el nombre o el texto" },
      { status: 400 }
    );
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: "el archivo debe ser una imagen o un video" },
      { status: 400 }
    );
  }
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `el archivo pesa más de lo permitido (${Math.round(maxBytes / 1024 / 1024)} MB)` },
      { status: 400 }
    );
  }

  let blob;
  try {
    blob = await put(`testimonios/${Date.now()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
  } catch {
    return NextResponse.json(
      { error: "no se pudo subir el archivo (¿está configurado el Blob store?)" },
      { status: 500 }
    );
  }

  const testimonial = await addTestimonial({
    name,
    text,
    mediaUrl: blob.url,
    mediaType: isVideo ? "video" : "image",
  });

  if (!testimonial) {
    // El archivo ya se subió pero no se pudo guardar el registro — no lo
    // dejamos huérfano en Blob.
    await del(blob.url).catch(() => {});
    return NextResponse.json(
      { error: "no se pudo guardar el testimonio (¿está configurado Redis?)" },
      { status: 500 }
    );
  }

  return NextResponse.json({ testimonial });
}

/** Body: `{ id: string }`. Borra el registro y su archivo en Blob. */
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
