import Link from "next/link";
import ClienteForm from "@/components/admin/ClienteForm";

export default function NuevoClientePage() {
  return (
    <div>
      <Link
        href="/admin/clientes"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a clientes
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Nuevo cliente
      </h1>
      <ClienteForm />
    </div>
  );
}
