"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Proveedor, ProveedorInput } from "@/lib/types";
import { createProveedor, updateProveedor } from "@/app/admin/gestion-actions";

/** Formulario para crear o editar un proveedor. */
export default function ProveedorForm({ initial }: { initial?: Proveedor }) {
  const esEdicion = Boolean(initial);
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [cuit, setCuit] = useState(initial?.cuit ?? "");
  const [notas, setNotas] = useState(initial?.notas ?? "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: ProveedorInput = { nombre, telefono, email, cuit, notas };
    startTransition(async () => {
      const res = esEdicion
        ? await updateProveedor(initial!.id, input)
        : await createProveedor(input);
      if (res?.error) setError(res.error);
    });
  }

  const labelClase = "mb-1.5 block text-sm font-medium text-neutral-700";
  const inputClase =
    "w-full rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <label htmlFor="nombre" className={labelClase}>
            Nombre del proveedor *
          </label>
          <input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={inputClase}
            placeholder="Ej: Textiles del Sur"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="telefono" className={labelClase}>
              Teléfono
            </label>
            <input
              id="telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className={inputClase}
              placeholder="Ej: 11 5555-5555"
            />
          </div>
          <div>
            <label htmlFor="email" className={labelClase}>
              Email
            </label>
            <input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClase}
              placeholder="Ej: ventas@proveedor.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="cuit" className={labelClase}>
            CUIT (opcional)
          </label>
          <input
            id="cuit"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            className={inputClase}
            placeholder="Ej: 30-12345678-9"
          />
        </div>

        <div>
          <label htmlFor="notas" className={labelClase}>
            Notas
          </label>
          <textarea
            id="notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className={inputClase}
            placeholder="Lo que quieras recordar de este proveedor…"
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/admin/proveedores"
          className="rounded-xl border border-neutral-300 px-6 py-3 font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-xl bg-neutral-900 px-8 py-3 text-base font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {guardando
            ? "Guardando…"
            : esEdicion
              ? "Guardar cambios"
              : "Crear proveedor"}
        </button>
      </div>
    </form>
  );
}
