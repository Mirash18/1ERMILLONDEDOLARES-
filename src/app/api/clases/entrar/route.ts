import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getAccesoClase } from "@/lib/subscription";
import { getClasesConfig, hoyColombia, registrarIngreso } from "@/lib/clases";

/**
 * "Entrar a la clase" (ver /clases). El link de Zoom NUNCA va en el HTML de
 * la página: el botón apunta aquí, el servidor revisa si la persona puede
 * entrar hoy, anota el ingreso y recién ahí la manda a Zoom. Así quien no
 * tiene acceso no puede sacar el link mirando el código de la página. (Quien
 * sí entra puede compartirlo — Alejo lo sabe y lo acepta por ahora; el
 * registro de ingresos sirve para notarlo.)
 */
export async function GET(request: Request) {
  const config = await getClasesConfig();
  const acceso = await getAccesoClase(config.fechaClaseAbierta, hoyColombia());
  const volver = (motivo: string) =>
    NextResponse.redirect(new URL(`/clases?aviso=${motivo}`, request.url), 303);

  if (!acceso.allowed || !acceso.via) return volver("sin-acceso");
  if (!config.zoomUrl) return volver("sin-link");

  const user = await currentUser();
  if (user) {
    await registrarIngreso({
      userId: user.id,
      nombre: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      email: user.primaryEmailAddress?.emailAddress ?? null,
      fecha: Date.now(),
      via: acceso.via,
    });
  }

  return NextResponse.redirect(config.zoomUrl, 303);
}
