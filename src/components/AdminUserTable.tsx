"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminUserRow } from "@/app/api/admin/users/route";

const DURACIONES = [
  { label: "1 semana", days: 7 },
  { label: "2 semanas", days: 14 },
  { label: "1 mes", days: 30 },
] as const;

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function accesoVigente(iso: string | null): boolean {
  return Boolean(iso && new Date(iso).getTime() > Date.now());
}

export function AdminUserTable() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function load(q: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
      const json: { users?: AdminUserRow[] } = await res.json();
      setUsers(json.users ?? []);
    } catch {
      setMensaje("No se pudo cargar la lista — intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Buscar con un pequeño respiro después de dejar de teclear, en vez de
  // pedirle a Clerk una lista nueva en cada tecla.
  useEffect(() => {
    const id = setTimeout(() => load(query), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const todosSeleccionados = useMemo(
    () => users.length > 0 && users.every((u) => selected.has(u.id)),
    [users, selected]
  );

  function toggleTodos() {
    setSelected(todosSeleccionados ? new Set() : new Set(users.map((u) => u.id)));
  }

  function toggleUno(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function aplicarAcceso(days: number | null) {
    if (selected.size === 0) return;
    setWorking(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selected), days }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMensaje(json.error ?? "Algo falló.");
      } else {
        setMensaje(
          days === null
            ? `Acceso quitado a ${selected.size} persona(s).`
            : `Acceso dado a ${selected.size} persona(s) hasta el ${formatFecha(json.hasta)}.`
        );
        setSelected(new Set());
        await load(query);
      }
    } catch {
      setMensaje("No se pudo conectar con el servidor.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por correo…"
          className="w-full max-w-xs rounded border border-border bg-input px-3 py-2 font-mono text-xs text-text outline-none focus:border-gold/50"
        />
        <span className="font-mono text-[11px] text-text-soft">
          {selected.size > 0
            ? `${selected.size} seleccionada(s)`
            : `${users.length} persona(s)`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DURACIONES.map((d) => (
          <button
            key={d.days}
            type="button"
            disabled={selected.size === 0 || working}
            onClick={() => aplicarAcceso(d.days)}
            className="rounded bg-gold px-3 py-1.5 font-mono text-[11px] font-medium text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Dar acceso {d.label}
          </button>
        ))}
        <button
          type="button"
          disabled={selected.size === 0 || working}
          onClick={() => aplicarAcceso(null)}
          className="rounded border border-red/40 px-3 py-1.5 font-mono text-[11px] text-red transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Quitar acceso
        </button>
      </div>

      {mensaje && (
        <p className="font-mono text-[11px] text-text-soft">{mensaje}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-border bg-panel text-text-soft">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={toggleTodos}
                  aria-label="Seleccionar todos"
                />
              </th>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Registrado</th>
              <th className="px-3 py-2">Acceso hasta</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-text-soft">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-text-soft">
                  Sin resultados.
                </td>
              </tr>
            )}
            {!loading &&
              users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleUno(u.id)}
                      aria-label={`Seleccionar ${u.email ?? u.id}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-text">{u.email ?? "(sin correo)"}</td>
                  <td className="px-3 py-2 text-text-soft">
                    {formatFecha(new Date(u.createdAt).toISOString())}
                  </td>
                  <td className="px-3 py-2">
                    {accesoVigente(u.accesoManualHasta) ? (
                      <span className="text-green">
                        hasta {formatFecha(u.accesoManualHasta)}
                      </span>
                    ) : (
                      <span className="text-text-soft opacity-60">sin acceso</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
