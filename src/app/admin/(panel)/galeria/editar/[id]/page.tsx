import { notFound } from "next/navigation";
import TrabajoForm from "@/components/admin/TrabajoForm";
import { getTrabajoById } from "@/lib/galeria";
import { getAllProductsAdmin } from "@/lib/products";

/** Editar un trabajo ya cargado. */
export default async function EditarTrabajoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [trabajo, productos] = await Promise.all([
    getTrabajoById(id),
    getAllProductsAdmin(),
  ]);

  if (!trabajo) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-medium">Editar trabajo</h1>
      <TrabajoForm
        trabajo={trabajo}
        productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))}
      />
    </div>
  );
}
