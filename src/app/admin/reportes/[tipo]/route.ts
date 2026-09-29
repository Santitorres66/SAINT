import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  libroABuffer,
  reporteCompras,
  reporteStock,
  reporteVentas,
} from "@/lib/reportes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /admin/reportes/{ventas|compras|stock}?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
 *
 * Devuelve el reporte como archivo de Excel. El middleware ya corta a quien no
 * está logueado, pero se vuelve a verificar acá: un archivo con clientes y
 * montos no puede salir por un descuido de configuración.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { tipo } = await params;
  const rango = {
    desde: request.nextUrl.searchParams.get("desde") ?? undefined,
    hasta: request.nextUrl.searchParams.get("hasta") ?? undefined,
  };

  const libro =
    tipo === "ventas"
      ? await reporteVentas(rango)
      : tipo === "compras"
        ? await reporteCompras(rango)
        : tipo === "stock"
          ? await reporteStock()
          : null;

  if (!libro) {
    return NextResponse.json({ error: "Reporte inexistente" }, { status: 404 });
  }

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const periodo =
    tipo !== "stock" && (rango.desde || rango.hasta)
      ? `_${rango.desde ?? "inicio"}_a_${rango.hasta ?? hoy}`
      : `_${hoy}`;
  const archivo = `SAINT_${tipo}${periodo}.xlsx`;

  return new NextResponse(new Uint8Array(await libroABuffer(libro)), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
