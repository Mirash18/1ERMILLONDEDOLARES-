import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { AdminUserTable } from "@/components/AdminUserTable";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    redirect("/");
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="font-display text-lg tracking-tight text-text"
          >
            1er <span className="text-gold">Millón</span> de Dólares
          </Link>
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
          >
            ← volver
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <section className="mb-10">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-gold">
            Administración
          </p>
          <h1 className="text-balance font-display text-3xl font-medium leading-tight text-text">
            Personas registradas
          </h1>
          <p className="mt-3 max-w-xl text-sm text-text-soft">
            Mientras el cobro automático no está listo, el acceso a las
            clases y demás contenido pagado se da desde aquí, a mano, por un
            tiempo limitado.
          </p>
        </section>

        <AdminUserTable />
      </main>
    </div>
  );
}
