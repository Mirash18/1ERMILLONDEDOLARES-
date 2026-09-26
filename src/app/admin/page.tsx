import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { AdminUserTable } from "@/components/AdminUserTable";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  if (!(await isAdmin())) {
    // Antes esto mandaba de vuelta a la portada en silencio — si alguien
    // tiene más de una cuenta (como Alejo: la de pruebas y la admin) y
    // entra con la que no es, parecía que la página "no hacía nada". Ahora
    // se explica qué pasó y con qué correo está conectado.
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? "(sin correo)";
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-gold">
          Administración
        </p>
        <h1 className="mb-3 font-display text-2xl font-medium text-text">
          Esta cuenta no tiene acceso al panel
        </h1>
        <p className="max-w-sm text-sm text-text-soft">
          Estás conectado como <span className="text-text">{email}</span>.
          Cierra sesión y entra con la cuenta admin para ver esta página.
        </p>
        <Link
          href="/"
          className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
        >
          ← volver
        </Link>
      </div>
    );
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
          <div className="flex items-center gap-5">
            <Link
              href="/admin/clases"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
            >
              Clases con el profesor Miguel
            </Link>
            <Link
              href="/admin/testimonios"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
            >
              Testimonios
            </Link>
            <Link
              href="/"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-text"
            >
              ← volver
            </Link>
          </div>
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
