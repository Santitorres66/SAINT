import Link from "next/link";
import ClientesList from "@/components/admin/ClientesList";
import { getClientes } from "@/lib/clientes";

/** Master de clientes. */
export default async function ClientesPage() {
  const clientes = await getClientes();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Clientes</h1>
          <p className="mt-1 text-neutral-500">
            {clientes.length}{" "}
            {clientes.length === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <Link
          href="/admin/clientes/nuevo"
          className="rounded-xl bg-neutral-900 px-6 py-3 text-base font-medium text-white transition hover:bg-neutral-700"
        >
          + Nuevo cliente
        </Link>
      </div>

      <ClientesList clientes={clientes} />
    </div>
  );
}
