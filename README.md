# Fillaments by Bubblab

Inventario de materia prima de Bubblab (filamento por rollo de 1 kg y resina por litro): ventas del día, existencias por color, pedido al proveedor y métricas.

Uso del equipo de Bubblab, desde el celular o el computador. Se entra con el mismo usuario de Bubblab Intelligence.

## Qué hace

- **Inventario:** cuántos hay de cada producto (material + marca + color), la meta y el nivel: bien, bajo, muy bajo, agotado o **pide ya** (cuando, al ritmo de venta, no alcanza para los días que tarda el pedido más un margen). Botón para contar el inventario físico.
- **Vender:** al cierre del día se anota cada venta: productos, cantidad, precio (cambia por cliente; se sugiere el último cobrado), cliente con teléfono, canal (local o WhatsApp) y pago (efectivo, Nequi o transferencia). Se descuenta del inventario.
- **Ventas y caja:** las ventas de cualquier día, con cierre de caja por forma de pago y por persona. Borrar una venta mal anotada devuelve los productos al inventario.
- **Pedido:** cuánto pedir de cada producto, respetando el pedido mínimo del proveedor, con el mensaje listo para WhatsApp. Al llegar la mercancía se suma con un clic.
- **Métricas:** este mes, mes pasado, 3 y 6 meses: unidades, pesos, ganancia, el más y el menos vendido, ranking por color, ventas por mes y desglose por canal, pago y persona.
- **Productos:** colores, marcas, metas, costo de compra, precio usual y datos del proveedor.

### Cómo calcula el pedido

Cada producto tiene una meta y una **demanda en el mercado** (alta, media o baja), tomada de lo que más se vende en Amazon, Mercado Libre y tiendas colombianas: negro y blanco muy por encima del resto, luego los colores básicos y al final los especiales.

- Sin ventas anotadas, el pedido llena cada producto hasta su meta ajustada por esa demanda (alta 100 %, media 80 %, baja 50 %).
- A medida que se anotan ventas, pesan más las propias: cada producto se llena hasta lo que se vende en los meses de cobertura (2 por defecto), sin pasar la meta. A los 6 meses de datos mandan las ventas propias. Así no se pide de lo que casi no sale.
- La opción "Llenar hasta la meta" ignora todo eso y pide lo que falta para la meta.

Las reglas están en `lib/inventory.ts` y sus pruebas en `tests/inventory.test.ts`.

## Puesta en marcha (una sola vez)

### 1. Base de datos

Usa el mismo proyecto de Supabase de Bubblab Intelligence (así sirven los mismos usuarios). En Supabase → **SQL Editor**, pega `supabase/migrations/0001_inventario.sql` y dale **Run**. Solo crea tablas nuevas que empiezan por `inv_`; no toca nada de Intelligence. Se puede volver a correr sin problema.

### 2. Publicar en Vercel

1. En [vercel.com](https://vercel.com): **Add New → Project → Fillaments-by-Bubblab** → **Deploy**. No necesita variables: la conexión a Supabase ya está en `lib/supabase/config.ts`.
2. Vercel te da una dirección como `fillaments-by-bubblab.vercel.app`. Ábrela en el celular y agrégala a la pantalla de inicio.

### 3. Primeros datos

Entra, ve a **Productos** y carga los 16 colores base (o agrega los tuyos). Ponle a cada uno marca, costo y precio, y en **Inventario → Contar inventario** escribe cuántos hay hoy.

Para que entre alguien nuevo del equipo: Supabase → **Authentication → Users → Add user**.

## Desarrollo local

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # pruebas de los cálculos
```

Stack: Next.js 15 (App Router, Server Actions), Supabase (Postgres + Auth, con RLS: solo usuarios autenticados), Tailwind CSS 4.
