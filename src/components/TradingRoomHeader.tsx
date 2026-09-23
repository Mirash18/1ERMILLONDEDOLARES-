"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Reloj en vivo de la bolsa de EE.UU. (hora de Nueva York), corriendo
 * cada segundo sin importar si el mercado está abierto o cerrado — a
 * pedido de Alejo, que notó que la hora estaba congelada. Usa la zona
 * "America/New_York" (cambia solo entre EST y EDT según el horario de
 * verano) y `en-US` para que la sigla salga como EST/EDT.
 *
 * Empieza en `null` para no romper la hidratación: el valor de hora del
 * servidor y el del primer render del navegador serían instantes
 * distintos. Se llena recién montado el componente.
 */
function useHoraNuevaYork(): string | null {
  const [hora, setHora] = useState<string | null>(null);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
    const tick = () => setHora(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return hora;
}

/**
 * Header de la sala de trading con el logo de la marca y la información
 * del símbolo en vivo: símbolo actual, precio, cambio del día y hora.
 * Sin Bid/Ask (se quitó por pedido de Alejo).
 */
export function TradingRoomHeader() {
  // Valores simulados mientras se integra con datos reales
  const symbol = "SPY";
  const price = 595.42;
  const priceChange = 12.85;
  const priceChangePercent = 2.2;
  const lastUpdate = useHoraNuevaYork();

  const isPositive = priceChange >= 0;

  return (
    <div className="shrink-0 border-b border-border bg-gradient-to-r from-bg via-bg to-[#0d1a14]/20">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
        {/* Logo de marca + símbolo y precio */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <Image
              src="/logo-icon.png"
              alt=""
              width={40}
              height={32}
              priority
              className="h-8 w-auto"
            />
            <span className="hidden whitespace-nowrap font-display text-[17px] uppercase tracking-tight text-text sm:inline">
              1er <span className="text-gold">Millón</span> de Dólares
            </span>
          </Link>

          {/* Símbolo, precio y cambio del día */}
          <div className="flex items-baseline gap-3 border-l border-border/30 pl-6">
            <h1 className="font-display text-2xl font-semibold text-white">
              {symbol}
            </h1>
            <span className="font-display text-3xl font-medium text-white">
              ${price.toFixed(2)}
            </span>
            <span
              className={`text-lg font-semibold ${
                isPositive ? "text-[#089981]" : "text-[#F23645]"
              }`}
            >
              {isPositive ? "+" : ""}
              {priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Hora y volver */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:block">
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-soft">
              Hora NY
            </p>
            <p className="font-mono text-sm font-medium text-text">
              {lastUpdate ?? "—:—:—"}
            </p>
          </div>
          <Link
            href="/calculadora"
            className="border-l border-border/30 pl-6 font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-gold"
          >
            Calculadora
          </Link>
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-gold"
          >
            ← volver
          </Link>
        </div>
      </div>
    </div>
  );
}
