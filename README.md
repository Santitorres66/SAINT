# SAINT — Tienda online

> _lo sagrado en lo cotidiano_

Tienda de indumentaria con **bordado personalizado**. Incluye la **web pública**
y un **panel de administración** privado, conectados a una base de datos
**Supabase** compartida.

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + Supabase.
- **Deploy:** listo para Vercel.

---

## 🧭 Índice

1. [Qué hace](#qué-hace)
2. [Requisitos](#requisitos)
3. [Paso 1 — Crear el proyecto en Supabase](#paso-1--crear-el-proyecto-en-supabase)
4. [Paso 2 — Ejecutar el SQL](#paso-2--ejecutar-el-sql)
5. [Paso 3 — Crear tu usuario admin](#paso-3--crear-tu-usuario-admin)
6. [Paso 4 — Configurar `.env.local`](#paso-4--configurar-envlocal)
7. [Paso 5 — Correr en local](#paso-5--correr-en-local)
8. [Paso 6 — Deploy en Vercel](#paso-6--deploy-en-vercel)
9. [Cómo se usa el panel admin](#cómo-se-usa-el-panel-admin)
10. [Estructura del proyecto](#estructura-del-proyecto)
11. [Mercado Pago (a futuro)](#mercado-pago-a-futuro)

---

## Qué hace

**Web pública**

- **Home** (`/`): hero editorial con logo y tagline, sección que explica el
  bordado y grilla de productos destacados (leídos de Supabase).
- **Tienda** (`/tienda`): catálogo de productos activos con filtro por categoría.
- **Producto** (`/producto/[id]`): galería, selección de talle y color, bloque
  informativo del bordado y botón "Agregar al carrito" (preparado, sin pago aún).

**Panel admin** (`/admin`, protegido con login)

- Listado de todos los productos con editar / eliminar / mostrar-ocultar.
- Formulario simple para **crear** y **editar** productos, con **subida de
  imágenes** al Storage de Supabase.
- Todo pensado para uso **no técnico**: textos guía, botones grandes,
  confirmación antes de borrar. Los cambios se reflejan solos en la web pública.

---

## Requisitos

- **Node.js 18.18+** (recomendado 20+).
- Una cuenta gratuita en [supabase.com](https://supabase.com).
- (Para deploy) una cuenta en [vercel.com](https://vercel.com).

---

## Paso 1 — Crear el proyecto en Supabase

> Si ya tenés el proyecto creado (`pydaguoekpctkyymsyjd`), saltá al Paso 2.

1. Entrá a [supabase.com](https://supabase.com) e iniciá sesión.
2. **New project** → elegí un nombre (ej. `saint`), una contraseña para la base
   y una región cercana (ej. São Paulo).
3. Esperá ~1 minuto a que termine de crearse.

---

## Paso 2 — Ejecutar el SQL

Este script crea la tabla `products`, la seguridad (RLS) y el bucket de imágenes.

1. En tu proyecto de Supabase, menú izquierdo → **SQL Editor** (ícono `</>`).
2. Botón **+ New query**.
3. Abrí el archivo [`supabase/schema.sql`](./supabase/schema.sql) de este
   repositorio y **copiá y pegá todo su contenido** en el editor.
4. Click en **Run** (o `Ctrl/Cmd + Enter`). Debería decir _“Success”_.
5. Verificá:
   - **Table Editor** → aparece la tabla **`products`**.
   - **Storage** → aparece el bucket **`productos`**.

---

## Paso 3 — Crear tu usuario admin

El acceso al panel `/admin` es solo con usuarios de Supabase Auth.

1. Menú izquierdo → **Authentication** → **Users**.
2. **Add user** → **Create new user**.
3. Poné tu **email** y una **contraseña**.
4. Marcá **Auto Confirm User** (así podés entrar sin confirmar el mail).
5. Con ese email y contraseña vas a iniciar sesión en `/admin`.

---

## Paso 4 — Configurar `.env.local`

Las claves NUNCA van en el código: van en variables de entorno.

1. Copiá el archivo de ejemplo:

   ```bash
   cp .env.example .env.local
   ```

2. Completá `.env.local` con los datos de tu proyecto
   (**Supabase → Settings → API**):

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` → **Project URL**.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → la clave **anon / publishable**.

> ⚠️ La clave publishable/anon es segura de exponer en el navegador: los datos
> los protege RLS. La clave **secreta / service_role** NO se usa en este proyecto
> y no debe compartirse ni subirse nunca.

---

## Paso 5 — Correr en local

```bash
npm install     # instala dependencias (una sola vez)
npm run dev     # levanta el servidor de desarrollo
```

Abrí:

- **Web:** http://localhost:3000
- **Admin:** http://localhost:3000/admin

---

## Paso 6 — Deploy en Vercel

1. Subí el proyecto a un repositorio de GitHub.
2. Entrá a [vercel.com](https://vercel.com) → **Add New… → Project** → importá el repo.
3. Framework: Vercel detecta **Next.js** automáticamente.
4. En **Environment Variables**, agregá las mismas dos variables del `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Deploy**. En un par de minutos tenés la web online.

> Cada `git push` a la rama principal vuelve a deployar automáticamente.

---

## Cómo se usa el panel admin

1. Entrá a `/admin` e iniciá sesión con tu email y contraseña.
2. Vas a ver la **lista de productos**.
   - **+ Agregar producto**: crea uno nuevo.
   - **Editar**: cambia precio, stock, descripción, fotos, etc.
   - **Visible / Oculto**: muestra u oculta el producto en la web (sin borrarlo).
   - **Eliminar**: borra el producto (pide confirmación).
3. Al **crear/editar**, cargá los datos, subí las fotos (se guardan solas) y
   guardá. El cambio aparece **al instante** en la web pública.

---

## Estructura del proyecto

```
saint/
├── supabase/schema.sql          # SQL para crear tabla + storage
├── .env.example                 # nombres de las variables de entorno
└── src/
    ├── middleware.ts            # protege /admin y refresca la sesión
    ├── app/
    │   ├── layout.tsx           # layout raíz (fuentes + metadata)
    │   ├── (public)/            # WEB PÚBLICA (Navbar + Footer)
    │   │   ├── page.tsx         #   home
    │   │   ├── tienda/          #   catálogo
    │   │   └── producto/[id]/   #   detalle
    │   └── admin/               # PANEL PRIVADO
    │       ├── login/           #   inicio de sesión
    │       ├── actions.ts       #   crear / editar / borrar (server actions)
    │       └── (panel)/         #   páginas protegidas (dashboard, nuevo, editar)
    ├── components/              # UI pública + componentes de admin
    └── lib/
        ├── supabase/            # clientes de Supabase (browser / server / middleware)
        ├── products.ts          # lecturas de datos
        ├── types.ts             # tipos
        └── constants.ts         # categorías, contacto, formato de precio
```

---

## Pagos con Mercado Pago (Checkout Pro)

La tienda tiene **carrito** + **pago con Mercado Pago** + **órdenes y descuento
de stock automáticos**. Piezas:

- Carrito: [`src/lib/cart/CartContext.tsx`](./src/lib/cart/CartContext.tsx) +
  [`CartDrawer`](./src/components/cart/CartDrawer.tsx).
- Crear el pago: [`src/app/api/checkout/route.ts`](./src/app/api/checkout/route.ts)
  (recalcula precios desde la base — no confía en el navegador).
- Aviso de pago: [`src/app/api/webhooks/mercadopago/route.ts`](./src/app/api/webhooks/mercadopago/route.ts)
  (confirma la orden y descuenta stock, una sola vez).
- Órdenes en el admin: `/admin/ordenes`.

### 1) Correr el SQL de órdenes

En Supabase → **SQL Editor** → pegá
[`supabase/orders.sql`](./supabase/orders.sql) → **Run**. Crea la tabla `orders`
y la función que descuenta stock.

### 2) Conseguir las credenciales de Mercado Pago

1. Entrá a [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers)
   → **Tus integraciones** → creá una aplicación (o usá una existente).
2. En **Credenciales**, vas a ver dos juegos:
   - **Credenciales de prueba (TEST):** para probar sin dinero real.
   - **Credenciales de producción:** para vender de verdad.
3. Copiá el **Access Token** (empezá por el de **prueba**).

### 3) Conseguir la clave `service_role` de Supabase

Supabase → **Settings → API** → sección **Project API keys** → copiá la clave
**`service_role`** (la secreta). ⚠️ Solo va en el servidor, nunca en el navegador.

### 4) Completar el `.env.local`

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
MP_ACCESS_TOKEN=TEST-xxxxxxxx        # Access Token de Mercado Pago
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # clave secreta de Supabase
# MP_WEBHOOK_SECRET=...              # opcional (validación de firma del webhook)
```

En Vercel, cargá estas mismas variables en **Settings → Environment Variables**
(y poné `NEXT_PUBLIC_SITE_URL` con tu dominio real de Vercel).

### 5) Probar

- **Carrito y redirección a Mercado Pago:** funcionan en local.
- **El webhook (órdenes + stock automáticos) NO funciona en localhost**, porque
  Mercado Pago no puede alcanzar tu computadora. Se prueba **una vez deployado en
  Vercel**. Para probar en local podés usar un túnel (ej. `ngrok`) y poner esa URL
  en `NEXT_PUBLIC_SITE_URL`.
- Para pagos de prueba, usá las
  [tarjetas de prueba de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).

### 6) Configurar el webhook en Mercado Pago (para producción)

En **Tus integraciones → Webhooks**, configurá la URL:
`https://TU-DOMINIO.vercel.app/api/webhooks/mercadopago` y suscribite al evento
**Pagos**. (Opcional: copiá la clave secreta del webhook en `MP_WEBHOOK_SECRET`.)

---

Hecho con cuidado para SAINT — _cada pieza, única e irrepetible._
