import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAdmin } from "@/lib/admin";
import { addTestimonial } from "@/lib/testimonials";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB

/**
 * Subida de testimonios directo desde el navegador a Vercel Blob (ver
 * `AdminTestimonialsManager`), en vez de pasar el archivo por esta ruta.
 *
 * Real, no cosmético: las Serverless Functions de Vercel rechazan
 * cualquier cuerpo de petición de más de ~4.5 MB — un video SIEMPRE lo
 * iba a superar. La primera versión mandaba el archivo como
 * multipart/form-data a un POST normal acá y fallaba en producción con
 * "no se pudo subir el archivo" en cuanto alguien probaba con un video
 * real (Alejo, 19 sept. 2026). La subida directa evita esa ruta por
 * completo: el navegador habla directo con Blob, y esta ruta solo
 * entrega el token (`onBeforeGenerateToken`, acá se valida `isAdmin()`)
 * y se entera cuando terminó (`onUploadCompleted`, acá se guarda el
 * registro en Redis) — nunca ve los bytes del archivo.
 *
 * `onUploadCompleted` es un webhook que Vercel Blob le pega a esta URL
 * cuando el archivo ya quedó subido — necesita que el despliegue sea
 * alcanzable desde internet, así que **no dispara en local** (mismo
 * límite ya aceptado en este proyecto: solo se puede probar de punta a
 * punta en producción).
 *
 * `token: process.env.BLOB_PUBLIC_READ_WRITE_TOKEN` — el primer Blob
 * store que se creó (19 sept. 2026) quedó en modo "Private" sin darnos
 * cuenta (esa opción no se puede cambiar después de creado), y un store
 * privado nunca sirve un archivo con acceso público sin importar lo que
 * pida el código — por eso la primera versión fallaba con un error de
 * CORS al subir un archivo real. Se creó un store nuevo en modo
 * "Public" con el prefijo `BLOB_PUBLIC_*` (el prefijo por defecto,
 * `BLOB_*`, ya estaba tomado por el store privado) — como no es el
 * nombre por defecto que la librería busca sola
 * (`BLOB_READ_WRITE_TOKEN`), hay que pasarlo a mano.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      token: process.env.BLOB_PUBLIC_READ_WRITE_TOKEN,
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!(await isAdmin())) {
          throw new Error("no autorizado");
        }
        let mediaType: "image" | "video" = "image";
        try {
          mediaType = JSON.parse(clientPayload ?? "{}").mediaType === "video" ? "video" : "image";
        } catch {
          // se queda en "image" — solo afecta el límite de tamaño de abajo
        }
        return {
          allowedContentTypes: ["image/*", "video/*"],
          maximumSizeInBytes: mediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES,
          addRandomSuffix: true,
          tokenPayload: clientPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const { name, text } = JSON.parse(tokenPayload ?? "{}");
          if (!name || !text) return;
          await addTestimonial({
            name,
            text,
            mediaUrl: blob.url,
            mediaType: blob.contentType.startsWith("video/") ? "video" : "image",
          });
        } catch {
          // Si esto falla, el archivo queda subido pero sin testimonio
          // asociado — se puede borrar a mano desde el dashboard de Blob.
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "error desconocido" },
      { status: 400 }
    );
  }
}
