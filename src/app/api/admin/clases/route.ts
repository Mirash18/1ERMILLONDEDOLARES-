import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { esLinkValido, getClasesConfig, getIngresos, setClasesConfig } from "@/lib/clases";

/**
 * Admin de las clases con el profesor Miguel (ver src/lib/clases.ts).
 *
 * GET → `{ config, ingresos }`: el link de Zoom y la fecha de la clase
 * abierta vigentes, y quién le dio "Entrar a la clase" (lo más reciente
 * primero).
 *
 * PUT → body `{ zoomUrl: string | null, fechaClaseAbierta: string | null }`
 * (fecha AAAA-MM-DD). Reemplaza los dos.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const [config, ingresos] = await Promise.all([getClasesConfig(), getIngresos()]);
  return NextResponse.json({ config, ingresos });
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const zoomRaw = typeof body?.zoomUrl === "string" ? body.zoomUrl.trim() : "";
  const fechaRaw = typeof body?.fechaClaseAbierta === "string" ? body.fechaClaseAbierta : "";

  if (zoomRaw && !esLinkValido(zoomRaw)) {
    return NextResponse.json(
      { error: "El link debe empezar con https:// (cópialo completo desde Zoom)." },
      { status: 400 }
    );
  }
  if (fechaRaw && !/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }

  const config = { zoomUrl: zoomRaw || null, fechaClaseAbierta: fechaRaw || null };
  if (!(await setClasesConfig(config))) {
    return NextResponse.json({ error: "No se pudo guardar — intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, config });
}
