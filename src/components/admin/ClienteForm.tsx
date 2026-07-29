"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Cliente, ClienteInput } from "@/lib/types";
import { createCliente, updateCliente } from "@/app/admin/clientes-actions";

/** Formulario para crear o editar un cliente del master. */
export default function ClienteForm({ initial }: { initial?: Cliente }) {
  const esEdicion = Boolean(initial);
  const [guardando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState<ClienteInput>({
    nombre: initial?.nombre ?? "",
    apellido: initial?.apellido ?? "",
    telefono: initial?.telefono ?? "",
    email: initial?.email ?? "",
    domicilio: initial?.domicilio ?? "",
    localidad: initial?.localidad ?? "",
    provincia: initial?.provincia ?? "",
    observaciones: initial?.observaciones ?? "",
  });

  function set<K extends keyof ClienteInput>(k: K, v: ClienteInput[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = esEdicion
        ? await updateCliente(initial!.id, f)
        : await createCliente(f);
      if (res?.error) setError(res.error);
    });
  }

  const label = "mb-1.5 block text-sm font-medium text-neutral-700";
  const input =
    "w-full rounded-lg border border-neutral-300 px-4 py-3 text-base outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className={label}>Nombre *</label>
            <input
              value={f.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              className={input}
              placeholder="Ej: Juan"
            />
          </div>
          <div>
            <label className={label}>Apellido</label>
            <input
              value={f.apellido}
              onChange={(e) => set("apellido", e.target.value)}
              className={input}
              placeholder="Ej: Pérez"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className={label}>Teléfono</label>
            <input
              value={f.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              className={input}
              placeholder="Ej: 11 5555-5555"
            />
          </div>
          <div>
            <label className={label}>Email</label>
            <input
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
              className={input}
              placeholder="Ej: juan@correo.com"
            />
          </div>
        </div>

        <div>
          <label className={label}>Domicilio</label>
          <input
            value={f.domicilio}
            onChange={(e) => set("domicilio", e.target.value)}
            className={input}
            placeholder="Calle y número"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className={label}>Localidad</label>
            <input
              value={f.localidad}
              onChange={(e) => set("localidad", e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Provincia</label>
            <input
              value={f.provincia}
              onChange={(e) => set("provincia", e.target.value)}
              className={input}
            />
          </div>
        </div>

        <div>
          <label className={label}>Observaciones</label>
          <textarea
            value={f.observaciones}
            onChange={(e) => set("observaciones", e.target.value)}
            rows={3}
            className={input}
            placeholder="Notas del cliente…"
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/admin/clientes"
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
              : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
