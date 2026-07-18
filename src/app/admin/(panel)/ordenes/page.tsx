import { redirect } from "next/navigation";

/** La antigua página de órdenes ahora vive dentro de "Ventas". */
export default function OrdenesRedirect() {
  redirect("/admin/ventas");
}
