import Link from "next/link";
import { notFound } from "next/navigation";
import ClienteForm from "@/components/admin/ClienteForm";
import { getClienteById } from "@/lib/clientes";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cliente = await getClienteById(id);
  if (!cliente) notFound();

  return (
    <div>
      <Link
        href="/admin/clientes"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a clientes
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Editar cliente
      </h1>
      <ClienteForm initial={cliente} />
    </div>
  );
}
