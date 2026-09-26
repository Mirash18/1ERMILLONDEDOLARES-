"use client";

import { useState } from "react";
import type { ClasesConfig, IngresoClase } from "@/lib/clases";

const ZONA = "America/Bogota";

function fechaHora(ms: number): string {
  return new Date(ms).toLocaleString("es-CO", {
    timeZone: ZONA,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "2026-09-29" → "martes 29 de septiembre" (se arma a mediodía UTC para que
// ninguna zona horaria la corra al día anterior).
function fechaLarga(dia: string): string {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-CO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const VIA_LABEL: Record<IngresoClase["via"], string> = {
  clases: "Plan con clases",
  "clase-abierta": "Clase abierta (básico)",
};

export function AdminClases({
  initialConfig,
  initialIngresos,
}: {
  initialConfig: ClasesConfig;
  initialIngresos: IngresoClase[];
}) {
  const [zoomUrl, setZoomUrl] = useState(initialConfig.zoomUrl ?? "");
  const [fecha, setFecha] = useState(initialConfig.fechaClaseAbierta ?? "");
  const [guardado, setGuardado] = useState(initialConfig);
  const [working, setWorking] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ingresos, setIngresos] = useState(initialIngresos);

  const hoy = hoyColombia();
  const cambios =
    zoomUrl.trim() !== (guardado.zoomUrl ?? "") || fecha !== (guardado.fechaClaseAbierta ?? "");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/clases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoomUrl: zoomUrl.trim() || null, fechaClaseAbierta: fecha || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje(json.error ?? "No se pudo guardar.");
        return;
      }
      setGuardado(json.config);
      setMensaje("Guardado.");
    } catch {
      setMensaje("No se pudo guardar — intenta de nuevo.");
    } finally {
      setWorking(false);
    }
  }

  async function actualizarIngresos() {
    try {
      const res = await fetch("/api/admin/clases");
      if (res.ok) setIngresos((await res.json()).ingresos ?? []);
    } catch {
      // se queda con la lista que ya había
    }
  }

  const ingresosHoy = ingresos.filter(
    (i) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: ZONA,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(i.fecha)) === hoy
  );
  const personasHoy = new Set(ingresosHoy.map((i) => i.userId)).size;

  return (
    <div className="flex flex-col gap-10">
      <form
        onSubmit={guardar}
        className="flex flex-col gap-4 rounded-lg border border-border bg-panel p-5"
      >
        <label className="flex flex-col gap-1 text-sm text-text-soft">
          Link de Zoom de la clase
          <input
            value={zoomUrl}
            onChange={(e) => setZoomUrl(e.target.value)}
            placeholder="https://us02web.zoom.us/j/..."
            className="rounded border border-border bg-input px-3 py-2 text-text outline-none focus:border-gold"
          />
          <span className="text-[11px]">
            Solo lo ven (y solo entran con él) quienes tienen acceso a las clases. Cámbialo cada
            semana si Zoom te da uno nuevo.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-soft">
          Día de la clase abierta del plan básico
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded border border-border bg-input px-3 py-2 text-text outline-none [color-scheme:dark] focus:border-gold"
            />
            {fecha && (
              <button
                type="button"
                onClick={() => setFecha("")}
                className="font-mono text-[11px] text-text-soft hover:text-red"
              >
                quitar
              </button>
            )}
          </div>
          <span className="text-[11px]">
            Ese día (hora de Colombia) entran también quienes tienen solo la Sala de Trading
            pagada. {fecha && fecha < hoy && <span className="text-red">Esa fecha ya pasó.</span>}
            {fecha && fecha === hoy && <span className="text-green">Es hoy.</span>}
            {fecha && fecha > hoy && <span className="text-gold">Será el {fechaLarga(fecha)}.</span>}
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={working || !cambios}
            className="w-fit rounded bg-gold px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-bg transition-opacity disabled:opacity-40"
          >
            {working ? "Guardando…" : "Guardar"}
          </button>
          {mensaje && <p className="text-xs text-text-soft">{mensaje}</p>}
        </div>
      </form>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-medium text-text">Quién entró a la clase</h2>
          <button
            type="button"
            onClick={actualizarIngresos}
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-soft hover:text-gold"
          >
            Actualizar
          </button>
        </div>
        <p className="mb-4 max-w-2xl text-sm text-text-soft">
          Cada vez que alguien le da &ldquo;Entrar a la clase&rdquo; queda anotado aquí. Lo que
          pasa dentro de Zoom no lo ve la página. <span className="text-text">Hoy:</span>{" "}
          {ingresosHoy.length} ingreso{ingresosHoy.length === 1 ? "" : "s"} de {personasHoy}{" "}
          persona{personasHoy === 1 ? "" : "s"}.
        </p>

        {ingresos.length === 0 ? (
          <p className="text-sm text-text-soft">Todavía nadie ha entrado a una clase.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel font-mono text-[11px] uppercase tracking-[0.08em] text-text-soft">
                <tr>
                  <th className="px-3 py-2">Cuándo</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Entró por</th>
                </tr>
              </thead>
              <tbody>
                {ingresos.map((i, n) => (
                  <tr key={`${i.userId}-${i.fecha}-${n}`} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 text-text-soft">{fechaHora(i.fecha)}</td>
                    <td className="px-3 py-2 text-text">{i.nombre ?? "—"}</td>
                    <td className="px-3 py-2 text-text">{i.email ?? "—"}</td>
                    <td className="px-3 py-2 text-text-soft">{VIA_LABEL[i.via]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
