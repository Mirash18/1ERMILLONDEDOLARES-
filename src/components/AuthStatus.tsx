"use client";

import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
// Nota: las etiquetas de UI del sitio público usan `font-sans` (Figtree),
// no `font-sans` — el monoespaciado se reserva para números y datos
// (precios, gráfico), donde sí aporta. Ver docs/ARQUITECTURA.md.

/**
 * Botones de sesión para el header. Si Clerk no está configurado (llave
 * pública ausente) no renderiza nada — el `<ClerkProvider>` tampoco está
 * montado en ese caso (ver `layout.tsx`), así que los componentes de Clerk
 * no tendrían de dónde leer contexto.
 *
 * `orientation="stack"` es para el menú desplegable en móvil: los mismos
 * botones, pero uno debajo del otro y ocupando todo el ancho, que es lo
 * que se puede tocar cómodo con el pulgar.
 */
export function AuthStatus({
  orientation = "row",
}: {
  orientation?: "row" | "stack";
}) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return null;
  }

  const apilado = orientation === "stack";

  return (
    <div
      className={
        apilado ? "flex flex-col items-stretch gap-3" : "flex items-center gap-4"
      }
    >
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className={`whitespace-nowrap font-sans text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-gold ${
              apilado ? "py-2 text-left" : ""
            }`}
          >
            Iniciar sesión
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className={`whitespace-nowrap rounded border border-gold/40 px-3 py-1.5 font-sans text-[11px] uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold/10 ${
              apilado ? "py-2.5 text-center" : ""
            }`}
          >
            Crear cuenta
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/introduccion"
          className={`whitespace-nowrap font-sans text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-gold ${
            apilado ? "py-2" : ""
          }`}
        >
          Introducción
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
