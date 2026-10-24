import Link from "next/link";
import { getCobranzas } from "@/lib/gestion";
import { formatPrecio } from "@/lib/constants";

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(
    new Date(iso),
  );
}

/**
 * Pasa un teléfono argentino al formato que pide wa.me (549 + área + número).
 * Devuelve null si no hay un número usable.
 */
function telefonoWhatsApp(tel: string): string | null {
  let d = tel.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  // Cargado con el 15 (ej. 351 15 1234567): se saca, WhatsApp no lo usa.
  if (d.length === 12) {
    const corte = [2, 3, 4].find((a) => d.slice(a, a + 2) === "15");
    if (corte !== undefined) d = d.slice(0, corte) + d.slice(corte + 2);
  }
  if (d.length !== 10) return null;
  return `549${d}`;
}

/** Recordatorio de saldo, ya escrito para mandar por WhatsApp. */
function linkRecordatorio(tel: string, cliente: string, saldo: number) {
  const numero = telefonoWhatsApp(tel);
  if (!numero) return null;
  const nombre = cliente.split(" ")[0];
  const texto =
    `¡Hola ${nombre}! Te escribimos de SAINT 👋\n\n` +
    `Te recordamos que te queda un saldo pendiente de ${formatPrecio(saldo)}.\n` +
    `Podés abonarlo por transferencia al alias *saint.prendas* o en efectivo.\n\n` +
    `¡Muchas gracias!`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * Cobranzas: toda la plata que entró (cobros de ventas manuales + ventas web
 * pagadas) y, arriba, la cuenta corriente con lo que falta cobrar.
 */
export default async function CobranzasPage() {
  const { cobros, pendientes } = await getCobranzas();

  const totalCobrado = cobros.reduce((a, c) => a + c.monto, 0);
  const totalPendiente = pendientes.reduce((a, p) => a + p.saldo, 0);
  const ventasPendientes = pendientes.reduce((a, p) => a + p.ventas, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Cobranzas</h1>
        <p className="mt-1 text-neutral-500">
          {cobros.length} {cobros.length === 1 ? "cobro" : "cobros"} ·{" "}
          {formatPrecio(totalCobrado)} cobrado
        </p>
      </div>

      {/* Cuenta corriente: lo que falta cobrar */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">Pendiente de cobrar</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">
            {formatPrecio(totalPendiente)}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {ventasPendientes} {ventasPendientes === 1 ? "venta" : "ventas"} ·{" "}
            {pendientes.length}{" "}
            {pendientes.length === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">Total cobrado</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">
            {formatPrecio(totalCobrado)}
          </p>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Cuenta corriente
          </h2>
          <ul className="divide-y divide-neutral-100 text-sm">
            {pendientes.map((p) => {
              const wa = linkRecordatorio(p.telefono, p.cliente, p.saldo);
              return (
                <li
                  key={`${p.cliente}-${p.telefono}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
                >
                  <span className="text-neutral-800">
                    {p.cliente}{" "}
                    <span className="text-neutral-400">
                      ({p.ventas} {p.ventas === 1 ? "venta" : "ventas"})
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-700"
                      >
                        Avisar por WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-neutral-400">
                        Sin teléfono
                      </span>
                    )}
                    <span className="font-medium text-amber-700">
                      {formatPrecio(p.saldo)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Todo lo cobrado */}
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Medio</th>
              <th className="px-4 py-3 font-medium">Nota</th>
              <th className="px-4 py-3 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {cobros.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  Todavía no hay cobros registrados.
                </td>
              </tr>
            ) : (
              cobros.map((c) => (
                <tr key={`${c.canal}-${c.id}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                    {formatFecha(c.fecha)}
                  </td>
                  <td className="px-4 py-3 text-neutral-900">
                    {c.venta_id ? (
                      <Link
                        href={`/admin/ventas?cobrar=${c.venta_id}`}
                        className="hover:underline"
                      >
                        {c.cliente}
                      </Link>
                    ) : (
                      c.cliente
                    )}
                    {c.canal === "online" && (
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                        Web
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{c.medio_pago}</td>
                  <td className="px-4 py-3 text-neutral-500">{c.notas}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-emerald-700">
                    {formatPrecio(c.monto)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
