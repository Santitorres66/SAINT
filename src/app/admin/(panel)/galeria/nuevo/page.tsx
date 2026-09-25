import TrabajoForm from "@/components/admin/TrabajoForm";
import { getAllProductsAdmin } from "@/lib/products";
import { getClientes } from "@/lib/clientes";

/** Cargar un trabajo nuevo a la galería. */
export default async function NuevoTrabajoPage() {
  const [productos, clientes] = await Promise.all([
    getAllProductsAdmin(),
    getClientes(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-medium">Cargar trabajo</h1>
      <TrabajoForm
        productos={productos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          colores: p.colores,
        }))}
        clientes={clientes}
      />
    </div>
  );
}
