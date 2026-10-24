import MermasList from "@/components/admin/MermasList";
import { getOrdenesProduccion } from "@/lib/produccion";
import { formatPrecio, labelMotivoMerma } from "@/lib/constants";

/**
 * Mermas: órdenes de producción que se perdieron (prenda rota, bordado mal
 * hecho…). Cuánto costaron, por qué pasan y en qué quedó cada caso.
 */
export default async function MermasPage() {
  const ordenes = await getOrdenesProduccion();

  const mermas = ordenes
    .filter((o) => o.estado === "perdido")
    .sort(
      (a, b) =>
        new Date(b.fecha_merma ?? b.updated_at).getTime() -
        new Date(a.fecha_merma ?? a.updated_at).getTime(),
    );

  // Número de la orden que reemplazó a cada merma rehecha.
  const numeroPorId = new Map(ordenes.map((o) => [o.id, o.numero]));

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const delMes = mermas.filter(
    (m) => new Date(m.fecha_merma ?? m.updated_at) >= inicioMes,
  );

  const costo = (lista: typeof mermas) =>
    lista.reduce((a, m) => a + (Number(m.costo_total) || 0), 0);
  const unidades = mermas.reduce((a, m) => a + (m.cantidad || 1), 0);
  const abiertas = mermas.filter(
    (m) => (m.merma_estado ?? "abierta") === "abierta",
  ).length;

  // Por qué se pierde: el motivo que más se repite es el que hay que atacar.
  const porMotivo = new Map<string, { casos: number; costo: number }>();
  for (const m of mermas) {
    const k = labelMotivoMerma(m.merma_motivo);
    const prev = porMotivo.get(k) ?? { casos: 0, costo: 0 };
    porMotivo.set(k, {
      casos: prev.casos + 1,
      costo: prev.costo + (Number(m.costo_total) || 0),
    });
  }
  const motivos = [...porMotivo.entries()].sort(
    (a, b) => b[1].casos - a[1].casos,
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Mermas</h1>
        <p className="mt-1 text-neutral-500">
          Órdenes perdidas en producción: prendas rotas, bordados que salieron
          mal. Para marcar una, elegí “Perdido” en la tarjeta de Producción.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          titulo="Abiertas"
          valor={String(abiertas)}
          detalle="Sin rehacer ni cerrar"
          tono={abiertas > 0 ? "rojo" : undefined}
        />
        <Indicador
          titulo="Costo perdido este mes"
          valor={formatPrecio(costo(delMes))}
          detalle={`${delMes.length} ${delMes.length === 1 ? "caso" : "casos"}`}
        />
        <Indicador
          titulo="Costo perdido total"
          valor={formatPrecio(costo(mermas))}
          detalle={`${mermas.length} ${mermas.length === 1 ? "caso" : "casos"}`}
        />
        <Indicador
          titulo="Unidades perdidas"
          valor={String(unidades)}
          detalle="Desde que se registran"
        />
      </div>

      {motivos.length > 0 && (
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Por motivo
          </h2>
          <ul className="divide-y divide-neutral-100 text-sm">
            {motivos.map(([motivo, d]) => (
              <li
                key={motivo}
                className="flex items-center justify-between gap-4 py-2"
              >
                <span className="text-neutral-800">
                  {motivo}{" "}
                  <span className="text-neutral-400">
                    ({d.casos} {d.casos === 1 ? "caso" : "casos"})
                  </span>
                </span>
                <span className="font-medium text-red-700">
                  {formatPrecio(d.costo)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MermasList
        mermas={mermas.map((m) => ({
          ...m,
          rehecha_numero: m.rehecha_orden_id
            ? numeroPorId.get(m.rehecha_orden_id) ?? null
            : null,
        }))}
      />
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  detalle,
  tono,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  tono?: "rojo";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        tono === "rojo"
          ? "border-red-200 bg-red-50"
          : "border-neutral-200 bg-white"
      }`}
    >
      <p className="text-sm text-neutral-500">{titulo}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tono === "rojo" ? "text-red-700" : "text-neutral-900"
        }`}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs text-neutral-500">{detalle}</p>
    </div>
  );
}
