import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { boldConfigurado, getPagos } from "@/lib/bold";
import { PLANES, formatoPrecio } from "@/lib/planes";

export const dynamic = "force-dynamic";

const ZONA = "America/Bogota";

function fechaHora(ms: number): string {
  return new Date(ms).toLocaleString("es-CO", {
    timeZone: ZONA,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    timeZone: ZONA,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Pagos aprobados con Bold (ver lib/bold.ts) — lo más reciente primero.
 * Quién está al día o vencido se ve en la tabla de /admin (columnas de
 * acceso: "hasta X" / "venció X").
 */
export default async function AdminPagosPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await isAdmin())) redirect("/admin");

  const pagos = await getPagos();

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-display text-lg tracking-tight text-text">
            1er <span className="text-gold">Millón</span> de Dólares
          </Link>
          <Link
            href="/admin"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
          >
            ← volver a admin
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <section className="mb-10">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-gold">
            Administración
          </p>
          <h1 className="text-balance font-display text-3xl font-medium leading-tight text-text">
            Pagos
          </h1>
          <p className="mt-3 max-w-xl text-sm text-text-soft">
            Cada pago aprobado en Bold y cómo le quedó el acceso a esa persona. Quién está al
            día o vencido se ve en{" "}
            <Link href="/admin" className="text-gold hover:underline">
              Personas registradas
            </Link>
            .{" "}
            {!boldConfigurado() && (
              <span className="text-red">
                Las llaves de Bold todavía no están puestas: el pago en línea está apagado.
              </span>
            )}
          </p>
        </section>

        {pagos.length === 0 ? (
          <p className="text-sm text-text-soft">Todavía no hay pagos.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel font-mono text-[11px] uppercase tracking-[0.08em] text-text-soft">
                <tr>
                  <th className="px-3 py-2">Cuándo</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Sala hasta</th>
                  <th className="px-3 py-2">Clases hasta</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => {
                  const plan = PLANES.find((x) => x.id === p.plan);
                  return (
                    <tr key={p.orderId} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 text-text-soft">
                        {fechaHora(p.fecha)}
                        {p.pruebas && (
                          <span className="ml-2 rounded border border-gold/40 px-1.5 py-0.5 text-[10px] text-gold">
                            prueba
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text">{p.email ?? "—"}</td>
                      <td className="px-3 py-2 text-text">{plan?.nombre ?? p.plan}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-text">
                        {plan ? `${formatoPrecio(plan.precio)} ${p.moneda}` : `${p.monto} ${p.moneda}`}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-text-soft">{fecha(p.salaHasta)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-text-soft">{fecha(p.clasesHasta)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
