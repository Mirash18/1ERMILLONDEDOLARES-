"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthStatus } from "./AuthStatus";

/**
 * Header del sitio público.
 *
 * Antes era un `flex` suelto dentro de `page.tsx` con todos los enlaces
 * en una sola fila y sin plan para pantallas angostas: entre ~600 y
 * ~800 px de ancho, "Sala de Trading" se partía en dos líneas y se
 * montaba encima del logo. Ahora los enlaces se esconden detrás de un
 * botón de menú por debajo de `md`, y el logo nunca cede espacio
 * (`shrink-0`).
 *
 * Queda pegado arriba al desplazarse, con el fondo semitransparente y
 * desenfocado — así el degradado azul/oliva del hero se sigue viendo
 * por detrás en vez de cortarse con una barra opaca.
 */

const NAV_LINKS = [{ href: "/sala-de-trading", label: "Sala de Trading" }];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
          onClick={() => setMenuOpen(false)}
        >
          <Image
            src="/logo-icon.png"
            alt=""
            width={34}
            height={27}
            priority
            className="h-[26px] w-auto"
          />
          <span className="whitespace-nowrap font-display text-[17px] uppercase tracking-tight text-text">
            1er <span className="text-gold">Millón</span> de Dólares
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <span className="hidden items-center gap-2 font-sans text-[10px] uppercase tracking-[0.14em] text-text-soft lg:inline-flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold/70" />
            en construcción · fase 1
          </span>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-sans text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-gold"
            >
              {link.label}
            </Link>
          ))}
          <AuthStatus />
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded text-text-soft transition-colors hover:text-text md:hidden"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {menuOpen ? (
              <>
                <line x1="5" y1="5" x2="15" y2="15" />
                <line x1="15" y1="5" x2="5" y2="15" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="17" y2="6" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="14" x2="17" y2="14" />
              </>
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-panel md:hidden">
          <nav className="mx-auto flex max-w-5xl flex-col px-6 py-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-border/60 py-3 font-sans text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-gold"
              >
                {link.label}
              </Link>
            ))}
            <div className="py-4">
              <AuthStatus orientation="stack" />
            </div>
            <span className="flex items-center gap-2 pb-3 font-sans text-[10px] uppercase tracking-[0.14em] text-text-soft/70">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold/70" />
              en construcción · fase 1
            </span>
          </nav>
        </div>
      )}
    </header>
  );
}
