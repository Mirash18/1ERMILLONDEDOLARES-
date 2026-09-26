import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { getClasesConfig, getIngresos } from "@/lib/clases";
import { AdminClases } from "@/components/AdminClases";

export default async function AdminClasesPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  if (!(await isAdmin())) {
    redirect("/admin");
  }

  const [config, ingresos] = await Promise.all([getClasesConfig(), getIngresos()]);

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
            Clases con el profesor Miguel
          </h1>
          <p className="mt-3 max-w-xl text-sm text-text-soft">
            El link de Zoom de la semana y el día de la clase abierta del plan
            básico. Quién tiene acceso a las clases (y a quién se le venció)
            se ve en la columna &ldquo;Clases con el profesor Miguel&rdquo; de{" "}
            <Link href="/admin" className="text-gold hover:underline">
              Personas registradas
            </Link>
            .
          </p>
        </section>

        <AdminClases initialConfig={config} initialIngresos={ingresos} />
      </main>
    </div>
  );
}
