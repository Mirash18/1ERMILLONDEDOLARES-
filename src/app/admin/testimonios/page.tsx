import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { getTestimonials } from "@/lib/testimonials";
import { AdminTestimonialsManager } from "@/components/AdminTestimonialsManager";

export default async function AdminTestimoniosPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  if (!(await isAdmin())) {
    redirect("/admin");
  }

  const testimonials = await getTestimonials();

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
            Testimonios
          </h1>
          <p className="mt-3 max-w-xl text-sm text-text-soft">
            Lo que subas acá aparece en el carrusel del homepage. Se puede ir
            agregando de a poco, imagen o video, con un testimonio corto.
          </p>
        </section>

        <AdminTestimonialsManager initial={testimonials} />
      </main>
    </div>
  );
}
