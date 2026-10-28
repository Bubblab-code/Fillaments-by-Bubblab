import Link from "next/link";
import { cancelOrder, createOrder, receiveOrder } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { loadLines, loadProducts, loadSettings, schemaReady } from "@/lib/data";
import { addDays, todayCO } from "@/lib/dates";
import { demand, longDate, orderMessage, productLabel, suggestedOrder } from "@/lib/inventory";
import { CopyButton } from "@/components/copy-button";
import { SetupNotice, Swatch } from "@/components/ui";
import type { Order } from "@/lib/types";

export default async function OrderPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  if (!(await schemaReady())) return <SetupNotice />;
  const sp = await searchParams;
  const toMeta = sp.modo === "meta";
  const today = todayCO();
  const supabase = await createClient();
  const [products, settings, lines, { data: orderData }] = await Promise.all([
    loadProducts(),
    loadSettings(),
    loadLines(addDays(today, -182)),
    supabase.from("inv_orders").select("*").neq("status", "cancelado").order("created_at", { ascending: false }).limit(10),
  ]);
  const own = demand(lines, today);
  // "Llenar hasta la meta" ignora ventas y mercado: pide lo que falta para la meta de cada producto.
  const d = toMeta ? { ...own, ownWeight: 0 } : own;
  const base = toMeta ? products.map((p) => ({ ...p, market: "alta" as const })) : products;
  const rows = suggestedOrder(base, d, settings).sort((a, b) => b.qty - a.qty || a.product.color.localeCompare(b.product.color));
  const total = rows.reduce((a, r) => a + r.qty, 0);
  const message = orderMessage(rows, longDate(today), settings.supplier_name);
  const items = rows.filter((r) => r.qty > 0).map((r) => ({ product_id: r.product.id, qty: r.qty, label: productLabel(r.product) }));
  const orders = (orderData ?? []) as Order[];
  const open = orders.filter((o) => o.status === "pedido");
  const done = orders.filter((o) => o.status === "recibido").slice(0, 5);
  const wa = settings.supplier_whatsapp ? `https://wa.me/${settings.supplier_whatsapp.length === 10 ? "57" : ""}${settings.supplier_whatsapp}?text=${encodeURIComponent(message)}` : null;
  const ownPct = Math.round(own.ownWeight * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">Pedido al proveedor</h1>
        <div className="ml-auto inline-flex gap-1 rounded-md bg-zinc-100 p-1 text-sm">
          <Link href="/pedido" className={`rounded px-3 py-1.5 font-medium ${!toMeta ? "bg-white shadow-sm" : "text-zinc-500"}`}>Según lo que se vende</Link>
          <Link href="/pedido?modo=meta" className={`rounded px-3 py-1.5 font-medium ${toMeta ? "bg-white shadow-sm" : "text-zinc-500"}`}>Llenar hasta la meta</Link>
        </div>
      </div>
      <p className="text-sm text-zinc-500">
        {toMeta
          ? "Pide lo que falta para que cada producto quede en su meta."
          : own.ownWeight === 0
            ? "Todavía hay pocas ventas anotadas, así que el pedido se reparte según la demanda del mercado de cada color (alta, media o baja), sin pasar la meta."
            : `Cada producto se llena hasta lo que vendes en ${settings.coverage_months} meses, sin pasar la meta. Tus ventas pesan ${ownPct}% y la demanda del mercado ${100 - ownPct}%; a los 6 meses de datos mandan tus ventas.`}{" "}
        Mínimo del proveedor: {settings.min_order}. Tarda {settings.lead_days} días.
      </p>

      {open.map((o) => (
        <form key={o.id} action={receiveOrder.bind(null, o.id)} className="card space-y-3 border-brand/40">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="h2">Pedido en camino · {longDate(o.created_at.slice(0, 10))}</h2>
            <span className="text-xs text-zinc-500">Llega aprox. el {longDate(addDays(o.created_at.slice(0, 10), settings.lead_days))}</span>
          </div>
          <p className="text-sm text-zinc-500">Cuando llegue, revisa las cantidades y súmalas al inventario.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {o.items.map((i) => (
              <label key={i.product_id} className="flex items-center justify-between gap-2 text-sm">
                <span>{i.label}</span>
                <input className="input w-20 text-right" type="number" min={0} inputMode="numeric" name={`q_${i.product_id}`} defaultValue={i.qty} />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button formAction={cancelOrder.bind(null, o.id)} className="btn-ghost" type="submit">Cancelar pedido</button>
            <button className="btn" type="submit">Llegó: sumar al inventario</button>
          </div>
        </form>
      ))}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="card overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Hay</th><th className="px-4 py-2 text-right">Meta</th><th className="px-4 py-2 text-right">Tener</th><th className="px-4 py-2 text-right">Vende/mes</th><th className="px-4 py-2 text-right">Pedir</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.product.id} className={r.qty ? "" : "text-zinc-400"}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2"><Swatch hex={r.product.hex} size={20} /><span className={r.qty ? "font-medium text-zinc-900" : ""}>{productLabel(r.product)}</span>
                      {!toMeta && r.lowSeller && r.product.stock < r.product.target && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">se vende poco</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.product.stock}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.product.target}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.objective}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.monthly.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-base font-semibold tabular-nums">{r.qty || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-zinc-200"><tr><td className="px-4 py-2 font-medium" colSpan={5}>Total</td><td className="px-4 py-2 text-right text-base font-semibold tabular-nums">{total}</td></tr></tfoot>
          </table>
        </section>

        <section className="card space-y-3 lg:self-start">
          <h2 className="h2">Mensaje para WhatsApp</h2>
          {total === 0 ? (
            <p className="text-sm text-zinc-500">No hace falta pedir nada por ahora.</p>
          ) : (
            <>
              <pre className="whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm">{message}</pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={message} />
                {wa ? <a className="btn-ghost py-1 text-xs" href={wa} target="_blank" rel="noreferrer">Abrir WhatsApp del proveedor</a> : <Link className="text-xs text-brand underline" href="/productos#proveedor">Agregar WhatsApp del proveedor</Link>}
              </div>
              <form action={createOrder} className="border-t border-zinc-200 pt-3">
                <input type="hidden" name="items" value={JSON.stringify(items)} />
                <input type="hidden" name="message" value={message} />
                <button className="btn w-full" type="submit">Ya lo pedí: guardar pedido</button>
                <p className="mt-1 text-xs text-zinc-500">Queda "en camino" hasta que marques que llegó.</p>
              </form>
            </>
          )}
        </section>
      </div>

      {done.length > 0 && (
        <section className="card space-y-2">
          <h2 className="h2">Pedidos recibidos</h2>
          <ul className="divide-y divide-zinc-100 text-sm">
            {done.map((o) => (
              <li key={o.id} className="py-2">
                <span className="font-medium">{longDate((o.received_at ?? o.created_at).slice(0, 10))}</span>
                <span className="text-zinc-500"> · {o.items.reduce((a, i) => a + i.qty, 0)} unidades · {o.items.map((i) => `${i.label} ${i.qty}`).join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
