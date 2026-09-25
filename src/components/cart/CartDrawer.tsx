"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart/CartContext";
import {
  PAGO_ONLINE_HABILITADO,
  formatPrecio,
  whatsappLink,
} from "@/lib/constants";
import { describirBordado } from "@/lib/bordado";

/**
 * Panel lateral (drawer) del carrito.
 *
 * Tiene dos finales posibles según `PAGO_ONLINE_HABILITADO`:
 *
 *  - Apagado (hoy): el pedido se manda por WhatsApp. El cliente deja su
 *    nombre, el pedido entra al tablero de Producción como pendiente y se le
 *    abre el chat con todo escrito. Se cobra después de charlar el bordado.
 *  - Encendido: vuelve el botón de Mercado Pago, que sigue intacto.
 */
export default function CartDrawer() {
  const { items, total, isOpen, closeCart, removeItem, setQty, clear } =
    useCart();
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos del pedido por WhatsApp
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  /** Cuando el pedido ya quedó armado: el link listo para abrir el chat. */
  const [enviado, setEnviado] = useState<{
    referencia: string;
    url: string;
    guardado: boolean;
  } | null>(null);

  /**
   * Arma el pedido: lo guarda en Producción y devuelve el mensaje escrito.
   *
   * No se abre WhatsApp solo: se muestra un botón para abrirlo. Una ventana
   * que se abre sola después de una espera es justo lo que bloquean los
   * navegadores, y ahí el pedido se perdería sin que nadie se entere.
   */
  async function enviarPorWhatsapp() {
    setError(null);

    if (!nombre.trim()) {
      setError("Escribí tu nombre para que sepamos de quién es el pedido.");
      return;
    }

    setPagando(true);
    try {
      const res = await fetch("/api/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: { nombre, telefono, notas },
          items: items.map((i) => ({
            productId: i.productId,
            talle: i.talle,
            color: i.color,
            cantidad: i.cantidad,
            bordado: i.bordado ?? null,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.mensaje) {
        setError(data.error ?? "No se pudo armar el pedido. Probá de nuevo.");
        setPagando(false);
        return;
      }

      setEnviado({
        referencia: data.referencia,
        url: whatsappLink(data.mensaje),
        guardado: Boolean(data.guardado),
      });
      // El pedido ya quedó anotado: el carrito cumplió su función.
      clear();
    } catch {
      setError("Hubo un problema de conexión. Probá de nuevo.");
    }
    setPagando(false);
  }

  /** Vuelve el carrito a cero al cerrarlo después de mandar un pedido. */
  function cerrar() {
    closeCart();
    if (enviado) {
      setEnviado(null);
      setNombre("");
      setTelefono("");
      setNotas("");
    }
  }

  async function pagar() {
    setError(null);
    setPagando(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            talle: i.talle,
            color: i.color,
            cantidad: i.cantidad,
            bordado: i.bordado ?? null,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.init_point) {
        setError(data.error ?? "No se pudo iniciar el pago. Probá de nuevo.");
        setPagando(false);
        return;
      }

      // Redirigimos a la pantalla de pago de Mercado Pago.
      window.location.href = data.init_point;
    } catch {
      setError("Hubo un problema de conexión. Probá de nuevo.");
      setPagando(false);
    }
  }

  return (
    <>
      {/* Fondo oscuro */}
      <div
        onClick={cerrar}
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-saint-black shadow-2xl transition-transform duration-300 ease-smooth ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Carrito de compras"
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-saint-line px-6 py-5">
          <h2 className="font-serif text-xl">Tu carrito</h2>
          <button
            onClick={cerrar}
            className="text-saint-gray transition-colors hover:text-saint-white"
            aria-label="Cerrar carrito"
          >
            ✕
          </button>
        </div>

        {/* Ítems */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            // Después de mandar un pedido el carrito queda vacío, pero decirle
            // "está vacío" a quien acaba de pedir sonaría a que no pasó nada.
            enviado ? (
              <p className="py-20 text-center text-sm uppercase tracking-wide2 text-saint-gray">
                Tu pedido está armado
              </p>
            ) : (
              <p className="py-20 text-center text-sm uppercase tracking-wide2 text-saint-gray">
                Tu carrito está vacío.
              </p>
            )
          ) : (
            <ul className="space-y-6">
              {items.map((i) => (
                <li key={i.key} className="flex gap-4">
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden bg-saint-ink">
                    {i.imagen ? (
                      <Image
                        src={i.imagen}
                        alt={i.nombre}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] text-saint-line">
                        SAINT
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="font-serif text-base">{i.nombre}</p>
                      <p className="mt-0.5 text-xs text-saint-gray">
                        {[i.talle, i.color].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="mt-1 text-sm text-saint-gray">
                        {formatPrecio(i.precio)}
                      </p>
                      {i.bordado && (
                        <p className="mt-1.5 border-l border-saint-line pl-2 text-[11px] leading-relaxed text-saint-gray">
                          Bordado: {describirBordado(i.bordado)}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      {/* Cantidad */}
                      <div className="flex items-center border border-saint-line">
                        <button
                          onClick={() => setQty(i.key, i.cantidad - 1)}
                          className="px-3 py-1 text-saint-gray transition-colors hover:text-saint-white"
                          aria-label="Restar uno"
                        >
                          −
                        </button>
                        <span className="min-w-[2rem] text-center text-sm">
                          {i.cantidad}
                        </span>
                        <button
                          onClick={() => setQty(i.key, i.cantidad + 1)}
                          disabled={
                            i.maxStock !== undefined && i.cantidad >= i.maxStock
                          }
                          className="px-3 py-1 text-saint-gray transition-colors hover:text-saint-white disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Sumar uno"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(i.key)}
                        className="text-xs uppercase tracking-wide2 text-saint-gray transition-colors hover:text-red-400"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pedido listo: solo falta abrir el chat */}
        {enviado && (
          <div className="space-y-4 border-t border-saint-line px-6 py-6">
            <p className="text-[11px] uppercase tracking-wide2 text-saint-gray">
              Pedido {enviado.referencia} · falta un paso
            </p>
            <p className="text-sm leading-relaxed">
              <span className="text-saint-white">Todavía no nos llegó.</span> El
              pedido está escrito y listo: tocá el botón y{" "}
              <span className="text-saint-white">mandanos el mensaje</span> por
              WhatsApp. Recién ahí lo recibimos y te confirmamos.
            </p>

            <a
              href={enviado.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 border border-[#25D366] bg-[#25D366]/10 px-6 py-3 text-xs uppercase tracking-wide2 text-saint-white transition-colors duration-300 hover:bg-[#25D366] hover:text-saint-black"
            >
              Abrir WhatsApp y mandar el pedido
            </a>

            {!enviado.guardado && (
              // Honestidad con el cliente: si no se pudo anotar de nuestro
              // lado, el mensaje es lo único que queda. Que no lo cierre.
              <p className="text-[11px] leading-relaxed text-amber-600">
                Importante: mandá el mensaje sí o sí — no pudimos guardar el
                pedido de nuestro lado.
              </p>
            )}
          </div>
        )}

        {/* Pie con total y cierre del pedido */}
        {items.length > 0 && !enviado && (
          <div className="space-y-4 border-t border-saint-line px-6 py-6">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide2 text-saint-gray">
                Total prendas
              </span>
              <span className="font-serif text-2xl">{formatPrecio(total)}</span>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {PAGO_ONLINE_HABILITADO ? (
              <>
                <button
                  onClick={pagar}
                  disabled={pagando}
                  className="btn-line w-full disabled:opacity-50"
                >
                  {pagando ? "Redirigiendo…" : "Pagar con Mercado Pago"}
                </button>

                <p className="text-center text-[11px] leading-relaxed text-saint-gray/60">
                  El pago es seguro y lo procesa Mercado Pago. Después
                  coordinamos tu bordado por WhatsApp: la vista previa es una
                  referencia y el bordado, hecho a mano, no queda idéntico al
                  dibujo.
                </p>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre *"
                    aria-label="Tu nombre"
                    className="w-full border-b border-saint-line bg-transparent py-2 text-sm outline-none placeholder:text-saint-gray focus:border-saint-white"
                  />
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Tu teléfono (opcional)"
                    aria-label="Tu teléfono"
                    className="w-full border-b border-saint-line bg-transparent py-2 text-sm outline-none placeholder:text-saint-gray focus:border-saint-white"
                  />
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={2}
                    placeholder="Algo que quieras aclarar del bordado (opcional)"
                    aria-label="Notas"
                    className="w-full resize-none border-b border-saint-line bg-transparent py-2 text-sm outline-none placeholder:text-saint-gray focus:border-saint-white"
                  />
                </div>

                <button
                  onClick={enviarPorWhatsapp}
                  disabled={pagando}
                  className="btn-line w-full disabled:opacity-50"
                >
                  {pagando ? "Armando el pedido…" : "Enviar pedido por WhatsApp"}
                </button>

                <p className="text-center text-[11px] leading-relaxed text-saint-gray/60">
                  Todavía no se paga acá. El precio ya incluye el bordado; solo
                  un diseño muy complejo puede tener un costo extra, y en ese
                  caso te lo decimos antes. La vista previa es una referencia:
                  el bordado se hace a mano y no queda idéntico al dibujo.
                  Coordinamos todo por WhatsApp.
                </p>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
