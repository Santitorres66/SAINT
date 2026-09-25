import Link from "next/link";
import GaleriaList from "@/components/admin/GaleriaList";
import { getTrabajosAdmin } from "@/lib/galeria";

/** Galería — las fotos de trabajos reales que se muestran en la web. */
export default async function GaleriaAdminPage() {
  const trabajos = await getTrabajosAdmin();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium">Galería</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Los bordados ya entregados. Es lo que prueba cómo queda una pieza de
            verdad — y lo que más vende.
          </p>
        </div>

        <Link
          href="/admin/galeria/nuevo"
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          Cargar trabajo
        </Link>
      </div>

      <GaleriaList trabajos={trabajos} />
    </div>
  );
}
