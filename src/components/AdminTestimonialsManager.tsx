"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { Testimonial } from "@/lib/testimonials";

function formatFecha(ts: number): string {
  return new Date(ts).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AdminTestimonialsManager({
  initial,
}: {
  initial: Testimonial[];
}) {
  const [items, setItems] = useState<Testimonial[]>(initial);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim() || !text.trim()) {
      setMensaje("Falta la imagen/video, el nombre o el testimonio.");
      return;
    }
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) {
      setMensaje("El archivo debe ser una imagen o un video.");
      return;
    }

    setWorking(true);
    setMensaje(null);
    try {
      // Sube directo del navegador a Vercel Blob (no pasa por nuestro
      // servidor) — un video normal ya supera el límite de ~4.5 MB que
      // aceptan las Serverless Functions de Vercel para el cuerpo de una
      // petición normal. El nombre/texto viajan en clientPayload y el
      // registro real en Redis lo crea el webhook onUploadCompleted del
      // lado del servidor (ver upload/route.ts) — por eso acá se agrega
      // una versión "optimista" a la lista de inmediato, en vez de
      // esperar la respuesta de ese webhook.
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/testimonials/upload",
        clientPayload: JSON.stringify({
          name: name.trim(),
          text: text.trim(),
          mediaType: isVideo ? "video" : "image",
        }),
      });

      setItems((prev) => [
        {
          id: `${Date.now()}-local`,
          name: name.trim(),
          text: text.trim(),
          mediaUrl: blob.url,
          mediaType: isVideo ? "video" : "image",
          createdAt: Date.now(),
        },
        ...prev,
      ]);
      setName("");
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMensaje("Testimonio agregado.");
    } catch (err) {
      setMensaje(
        err instanceof Error ? err.message : "No se pudo subir el testimonio — intenta de nuevo."
      );
    } finally {
      setWorking(false);
    }
  }

  async function onDelete(id: string) {
    setWorking(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/testimonials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        setMensaje("No se pudo borrar el testimonio.");
        return;
      }
      setItems((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setMensaje("No se pudo borrar el testimonio — intenta de nuevo.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-text-soft">
            Nombre del alumno
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Carlos P."
              className="rounded border border-border bg-input px-3 py-2 text-text outline-none focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-soft">
            Imagen o video
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded border border-border bg-input px-3 py-1.5 text-text outline-none file:mr-3 file:rounded file:border-0 file:bg-gold file:px-2 file:py-1 file:text-xs file:text-bg"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-text-soft">
          Testimonio corto
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Lo que dijo el alumno…"
            className="rounded border border-border bg-input px-3 py-2 text-text outline-none focus:border-gold"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={working}
            className="w-fit rounded bg-gold px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-bg transition-opacity disabled:opacity-50"
          >
            {working ? "Subiendo…" : "Agregar testimonio"}
          </button>
          {mensaje && <p className="text-xs text-text-soft">{mensaje}</p>}
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-text-soft">Todavía no hay testimonios subidos.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-2 overflow-hidden rounded-lg border border-border bg-panel"
            >
              {t.mediaType === "video" ? (
                <video src={t.mediaUrl} className="h-40 w-full object-cover" controls />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.mediaUrl} alt={t.name} className="h-40 w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-sm text-text-soft">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="font-mono text-[11px] text-gold">
                    {t.name} · {formatFecha(t.createdAt)}
                  </span>
                  <button
                    onClick={() => onDelete(t.id)}
                    disabled={working}
                    className="font-mono text-[11px] text-text-soft transition-colors hover:text-red disabled:opacity-50"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
