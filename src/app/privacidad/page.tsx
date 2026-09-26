import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Política de privacidad — 1er Millón de Dólares",
};

const CONTACTO = "contacto@1ermillondedolares.com";
const ACTUALIZADA = "26 de septiembre de 2026";

/**
 * Política de privacidad (26 sept. 2026). Hacía falta para publicar el
 * "Entrar con Google" (Google pide una URL de política de privacidad) y la
 * exige la ley colombiana de datos (Ley 1581 de 2012). Describe SOLO lo que
 * la plataforma hace de verdad — revisado contra el código: cuentas en
 * Clerk, favoritas / pagos / ingresos a clases en Redis, pagos procesados por
 * Bold, dibujos solo en el navegador, sin herramientas de rastreo ni
 * publicidad. Si se agrega algo que recoja datos nuevos (p. ej. los correos
 * de recordatorio de clases), hay que actualizar esta página.
 *
 * Es un texto base: no reemplaza la revisión de un abogado.
 */
export default function Privacidad() {
  return (
    <div className="flex flex-1 flex-col bg-bg">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <p className="mb-2 font-sans text-xs uppercase tracking-[0.14em] text-gold">Legal</p>
        <h1 className="font-display text-4xl font-medium leading-tight text-text">
          Política de privacidad
        </h1>
        <p className="mt-3 text-sm text-text-soft">Última actualización: {ACTUALIZADA}.</p>

        <div className="mt-10 flex flex-col gap-8 text-[15px] leading-relaxed text-text-soft [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-text [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-text">
          <section>
            <p>
              En <strong>1er Millón de Dólares</strong> (la &ldquo;plataforma&rdquo;, en{" "}
              <strong>1ermillondedolares.com</strong>) tratamos tus datos personales conforme a la
              Ley 1581 de 2012 de Colombia y sus normas reglamentarias. Aquí te contamos qué datos
              recogemos, para qué los usamos y cómo puedes ejercer tus derechos.
            </p>
          </section>

          <section>
            <h2>1. Qué datos recogemos</h2>
            <ul className="flex flex-col gap-2">
              <li>
                <strong>Datos de tu cuenta:</strong> nombre, correo electrónico y, si entras con
                Google, la foto de perfil que Google comparte. Si creas la cuenta con correo y
                contraseña, la contraseña la gestiona nuestro proveedor de cuentas y nosotros nunca
                la vemos.
              </li>
              <li>
                <strong>Datos de tu plan:</strong> qué plan compraste, el monto, la fecha del pago y
                hasta cuándo tienes acceso a la Sala de Trading y a las clases.
              </li>
              <li>
                <strong>Datos de pago:</strong> los pagos los procesa <strong>Bold</strong>. Los
                datos de tu tarjeta los recibe Bold directamente: la plataforma no los ve ni los
                guarda.
              </li>
              <li>
                <strong>Uso de las clases:</strong> cuando usas &ldquo;Entrar a la clase&rdquo;,
                registramos tu nombre, tu correo y la fecha y hora del ingreso.
              </li>
              <li>
                <strong>Tus favoritas:</strong> la lista de acciones que guardas en la Sala de
                Trading.
              </li>
              <li>
                <strong>En tu propio navegador:</strong> tus dibujos sobre los gráficos y cómo
                dejaste la pantalla (por ejemplo, dividida) se guardan solo en tu dispositivo, no en
                nuestros servidores.
              </li>
            </ul>
            <p className="mt-3">
              No usamos herramientas de rastreo publicitario ni vendemos tus datos a nadie.
            </p>
          </section>

          <section>
            <h2>2. Para qué los usamos</h2>
            <ul className="flex flex-col gap-2">
              <li>Crear y mantener tu cuenta, y permitirte iniciar sesión.</li>
              <li>Darte acceso a la Sala de Trading y a las clases según tu plan, y avisarte cuando se va a vencer.</li>
              <li>Confirmar tus pagos con Bold.</li>
              <li>Controlar el acceso a las clases en vivo.</li>
              <li>Atender tus preguntas y solicitudes.</li>
            </ul>
          </section>

          <section>
            <h2>3. Con quién los compartimos</h2>
            <p>
              Solo con los proveedores que necesitamos para que la plataforma funcione, y únicamente
              para eso:
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              <li>
                <strong>Clerk</strong> — gestión de cuentas e inicio de sesión (incluido &ldquo;Entrar con Google&rdquo;).
              </li>
              <li>
                <strong>Bold</strong> — procesamiento de pagos.
              </li>
              <li>
                <strong>Vercel</strong> y <strong>Upstash</strong> — alojamiento de la plataforma y almacenamiento de datos.
              </li>
              <li>
                <strong>Zoom</strong> — las clases en vivo se dictan por Zoom; al entrar, aplica también la política de privacidad de Zoom.
              </li>
            </ul>
            <p className="mt-3">
              Algunos de estos proveedores guardan información fuera de Colombia. Al usar la
              plataforma autorizas esa transferencia, que se hace solo con los fines descritos aquí.
            </p>
          </section>

          <section>
            <h2>4. Cuánto tiempo los guardamos</h2>
            <p>
              Mientras tengas una cuenta activa, y después el tiempo que la ley exija para registros
              de pagos. Si pides que borremos tu cuenta, eliminamos tus datos salvo los que debamos
              conservar por obligación legal.
            </p>
          </section>

          <section>
            <h2>5. Tus derechos</h2>
            <p>Como titular de tus datos puedes, en cualquier momento:</p>
            <ul className="mt-2 flex flex-col gap-2">
              <li>Conocer qué datos tenemos sobre ti.</li>
              <li>Actualizarlos o corregirlos.</li>
              <li>Pedir que los eliminemos o revocar tu autorización.</li>
              <li>Pedir prueba de la autorización que nos diste.</li>
              <li>
                Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) si
                consideras que no respetamos tus derechos.
              </li>
            </ul>
            <p className="mt-3">
              Para ejercerlos, escríbenos a{" "}
              <a href={`mailto:${CONTACTO}`} className="text-gold hover:underline">
                {CONTACTO}
              </a>
              . Respondemos las consultas en un máximo de 10 días hábiles y los reclamos en un
              máximo de 15 días hábiles, como indica la ley.
            </p>
          </section>

          <section>
            <h2>6. Cambios a esta política</h2>
            <p>
              Si cambiamos esta política lo publicaremos en esta misma página, con la fecha de la
              última actualización.
            </p>
          </section>

          <section>
            <h2>7. Contacto</h2>
            <p>
              <a href={`mailto:${CONTACTO}`} className="text-gold hover:underline">
                {CONTACTO}
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center font-sans text-[11px] text-text-soft">
        1er Millón de Dólares — contenido educativo, no es asesoría financiera.
      </footer>
    </div>
  );
}
