import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Igual que `accountsConfigured()` en `src/lib/subscription.ts`: si las
 * llaves de Clerk no están puestas, el proxy no debe tumbar el sitio.
 * En vez de fallar, deja pasar la petición tal cual (nadie queda protegido,
 * pero tampoco se cae nada) — falla hacia el lado seguro y silencioso.
 */
const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export default clerkConfigured ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    // Corre en todo menos archivos estáticos (imágenes, fuentes, etc.)
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Y siempre en rutas de API.
    "/(api|trpc)(.*)",
  ],
};
