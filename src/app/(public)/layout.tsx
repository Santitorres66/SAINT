import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/cart/CartDrawer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { CartProvider } from "@/lib/cart/CartContext";

/**
 * Layout de la web pública: envuelve todas las páginas visibles con la
 * navegación, el footer y el carrito. El panel /admin queda fuera de este grupo.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
      <CartDrawer />
      <WhatsAppFloat />
    </CartProvider>
  );
}
