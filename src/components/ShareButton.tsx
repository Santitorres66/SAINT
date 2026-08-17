"use client";

import { useState } from "react";
import { formatPrecio } from "@/lib/constants";

/**
 * Compartir el producto tal como lo está mirando la persona.
 *
 * En el celular abre el menú nativo (WhatsApp, Instagram, mail…); en la
 * computadora, que no lo tiene, copia el link al portapapeles.
 *
 * El link se arma con el talle y el color elegidos, así quien lo recibe abre
 * exactamente la misma combinación y no un producto genérico.
 */
export default function ShareButton({
  nombre,
  precio,
  talle,
  color,
}: {
  nombre: string;
  precio: number;
  talle: string | null;
  color: string | null;
}) {
  const [estado, setEstado] = useState<"idle" | "copiado" | "error">("idle");

  function armarUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("talle");
    url.searchParams.delete("color");
    if (talle) url.searchParams.set("talle", talle);
    if (color) url.searchParams.set("color", color);
    return url.toString();
  }

  async function compartir() {
    const url = armarUrl();
    const detalle = [talle && `talle ${talle}`, color]
      .filter(Boolean)
      .join(" · ");
    const texto = `${nombre}${detalle ? ` (${detalle})` : ""} — ${formatPrecio(
      precio,
    )}`;

    // 1) Menú nativo del celular
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${nombre} · SAINT`, text: texto, url });
        return;
      } catch (e) {
        // Si lo cerró a propósito, no pasa nada: no insistimos copiando.
        if ((e as Error)?.name === "AbortError") return;
      }
    }

    // 2) Sin menú nativo (o falló): al portapapeles
    try {
      await navigator.clipboard.writeText(url);
      setEstado("copiado");
      setTimeout(() => setEstado("idle"), 2500);
    } catch {
      setEstado("error");
      setTimeout(() => setEstado("idle"), 4000);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={compartir}
        className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wide2 text-saint-gray transition-colors duration-300 hover:text-saint-white"
      >
        {estado === "copiado" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
            <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
          </svg>
        )}
        {estado === "copiado" ? "Link copiado" : "Compartir"}
      </button>

      {estado === "error" && (
        <p className="text-[11px] text-saint-gray">
          No se pudo copiar. Copiá la dirección de la barra del navegador.
        </p>
      )}
    </div>
  );
}
