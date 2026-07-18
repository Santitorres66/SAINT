import Logo from "./Logo";
import { WHATSAPP_URL, INSTAGRAM_URL } from "@/lib/constants";

/**
 * Footer sobrio: logo, tagline y enlaces de contacto (WhatsApp e Instagram
 * son placeholders — cambiar los números/usuarios en src/lib/constants.ts).
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-saint-line/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-16 text-center">
        <Logo size="md" tagline />

        <div className="flex items-center gap-8 text-xs uppercase tracking-wide2 text-saint-gray">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-300 hover:text-saint-white"
          >
            WhatsApp
          </a>
          <span className="h-3 w-px bg-saint-line" aria-hidden />
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-300 hover:text-saint-white"
          >
            Instagram
          </a>
        </div>

        <p className="text-[11px] uppercase tracking-wide2 text-saint-gray/60">
          © {year} SAINT · Cada pieza, única e irrepetible
        </p>
      </div>
    </footer>
  );
}
