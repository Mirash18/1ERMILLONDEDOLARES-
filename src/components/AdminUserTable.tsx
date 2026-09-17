"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminUserRow } from "@/app/api/admin/users/route";
import { SCOPE_LABELS, type Scope } from "@/lib/scopes";

const SCOPES: { scope: Scope; label: string }[] = (
  Object.entries(SCOPE_LABELS) as [Scope, string][]
).map(([scope, label]) => ({ scope, label }));

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

function accesoVigente(iso: string | undefined): boolean {
  return Boolean(iso && new Date(iso).getTime() > Date.now());
}

export function AdminUserTable() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Qué secciones tocan los botones de acceso de abajo — más de una a la
  // vez, para poder dar de alta a alguien en todo con un solo clic aunque
  // más adelante se agreguen más secciones (ver "Todas" abajo).
  const [scopes, setScopes] = useState<Set<Scope>>(new Set(["introduccion"]));
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

  // Nunca deja las secciones en cero: si esa fuera la única marcada, el
  // clic no hace nada — si no, los botones de dar/quitar acceso se
  // desactivan solos (por no tener a qué sección aplicar) sin que se note
  // por qué, y parece que el panel dejó de funcionar.
  function toggleScope(s: Scope) {
    setScopes((prev) => {
      if (prev.has(s) && prev.size === 1) return prev;
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const todasLasSecciones = scopes.size === SCOPES.length;

  // `days: null` es "Quitar acceso permanente": borra la fecha de acceso
  // de esa sección de inmediato (no espera a que venza sola) — la cuenta
  // sigue pudiendo iniciar sesión, solo pierde esa sección. Para bloquear
  // la cuenta entera, ver aplicarBan() más abajo.
  async function aplicarAcceso(days: number | null) {
    if (selected.size === 0 || scopes.size === 0) return;
    setWorking(true);
    setMensaje(null);
    const nombresSecciones = SCOPES.filter((s) => scopes.has(s.scope))
      .map((s) => s.label)
      .join(" + ");
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: Array.from(selected),
          scopes: Array.from(scopes),
          days,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMensaje(json.error ?? "Algo falló.");
      } else {
        setMensaje(
          days === null
            ? `Acceso a ${nombresSecciones} quitado de forma permanente a ${selected.size} persona(s) — ya no cuenta ninguna fecha anterior.`
            : `Acceso a ${nombresSecciones} dado a ${selected.size} persona(s) hasta el ${formatFecha(json.hasta)}.`
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

  // Banear es más serio que quitar acceso: cierra la cuenta de Clerk por
  // completo (ni siquiera puede iniciar sesión, sin importar la sección) —
  // pensado para cuentas que retransmiten o comparten el contenido pagado.
  // Por eso pide confirmación aparte, a diferencia de los botones de
  // acceso.
  async function aplicarBan(banned: boolean) {
    if (selected.size === 0) return;
    if (
      banned &&
      !window.confirm(
        `¿Banear ${selected.size} cuenta(s)? No van a poder volver a iniciar sesión con ese correo.`
      )
    ) {
      return;
    }
    setWorking(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selected), banned }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMensaje(json.error ?? "Algo falló.");
      } else {
        setMensaje(
          banned
            ? `${selected.size} cuenta(s) baneada(s) — ya no pueden iniciar sesión.`
            : `${selected.size} cuenta(s) desbaneada(s).`
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
        <label className="flex items-center gap-1.5 font-mono text-[11px] text-text-soft">
          <input
            type="checkbox"
            checked={todosSeleccionados}
            onChange={toggleTodos}
            disabled={users.length === 0}
          />
          Seleccionar todas
        </label>
        <span className="font-mono text-[11px] text-text-soft">
          {selected.size > 0
            ? `${selected.size} seleccionada(s)`
            : `${users.length} persona(s)`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-soft">
          Sección:
        </span>
        <button
          type="button"
          onClick={() =>
            setScopes(
              todasLasSecciones
                ? new Set([SCOPES[0].scope])
                : new Set(SCOPES.map((s) => s.scope))
            )
          }
          className={`rounded border px-3 py-1.5 font-mono text-[11px] font-medium transition-colors ${
            todasLasSecciones
              ? "border-gold/50 bg-gold/10 text-gold"
              : "border-border text-text-soft hover:border-gold/30"
          }`}
        >
          Todas
        </button>
        {SCOPES.map((s) => (
          <button
            key={s.scope}
            type="button"
            onClick={() => toggleScope(s.scope)}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              scopes.has(s.scope)
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-border text-text-soft hover:border-gold/30"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DURACIONES.map((d) => (
          <button
            key={d.days}
            type="button"
            disabled={selected.size === 0 || scopes.size === 0 || working}
            onClick={() => aplicarAcceso(d.days)}
            className="rounded bg-gold px-3 py-1.5 font-mono text-[11px] font-medium text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Dar acceso {d.label}
          </button>
        ))}
        <button
          type="button"
          disabled={selected.size === 0 || scopes.size === 0 || working}
          onClick={() => aplicarAcceso(null)}
          className="rounded border border-red/40 px-3 py-1.5 font-mono text-[11px] text-red transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Quitar acceso permanente
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-soft">
          Cuenta:
        </span>
        <button
          type="button"
          disabled={selected.size === 0 || working}
          onClick={() => aplicarBan(true)}
          className="rounded bg-red px-3 py-1.5 font-mono text-[11px] font-medium text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Banear — no puede volver a entrar
        </button>
        <button
          type="button"
          disabled={selected.size === 0 || working}
          onClick={() => aplicarBan(false)}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-soft transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:border-gold/30"
        >
          Quitar ban
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
              {SCOPES.map((s) => (
                <th key={s.scope} className="px-3 py-2">
                  {s.label}
                </th>
              ))}
              <th className="px-3 py-2">Cuenta</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4 + SCOPES.length} className="px-3 py-4 text-text-soft">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={4 + SCOPES.length} className="px-3 py-4 text-text-soft">
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
                  {SCOPES.map((s) => (
                    <td key={s.scope} className="px-3 py-2">
                      {accesoVigente(u.acceso[s.scope]) ? (
                        <span className="text-green">
                          hasta {formatFecha(u.acceso[s.scope] ?? null)}
                        </span>
                      ) : (
                        <span className="text-text-soft opacity-60">sin acceso</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {u.banned ? (
                      <span className="text-red">baneado</span>
                    ) : (
                      <span className="text-text-soft opacity-60">activa</span>
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
