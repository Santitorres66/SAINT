import Link from "next/link";
import MatrizForm from "@/components/admin/MatrizForm";

export default function NuevaMatrizPage() {
  return (
    <div>
      <Link
        href="/admin/produccion/matrices"
        className="mb-6 inline-block text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        ← Volver a la biblioteca
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
        Nueva matriz
      </h1>
      <MatrizForm />
    </div>
  );
}
