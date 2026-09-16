"use client";

import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

/**
 * Botones de sesión para el header. Si Clerk no está configurado (llave
 * pública ausente) no renderiza nada — el `<ClerkProvider>` tampoco está
 * montado en ese caso (ver `layout.tsx`), así que los componentes de Clerk
 * no tendrían de dónde leer contexto.
 */
export function AuthStatus() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
          >
            Iniciar sesión
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="rounded border border-gold/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold/10"
          >
            Crear cuenta
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/introduccion"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
        >
          Introducción
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
