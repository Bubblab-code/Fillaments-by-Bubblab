import Link from "next/link";
import { deleteSale } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { loadProducts, schemaReady } from "@/lib/data";
import { addDays, todayCO } from "@/lib/dates";
import { longDate, productLabel } from "@/lib/inventory";
import { CHANNEL_LABEL, PAYMENT_LABEL, cop } from "@/lib/format";
import { SetupNotice, Stat, Swatch } from "@/components/ui";
import type { Sale } from "@/lib/types";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  if (!(await schemaReady())) return <SetupNotice />;
  const today = todayCO();
  const sp = await searchParams;
  const date = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) && sp.fecha <= today ? sp.fecha : today;
  const supabase = await createClient();
  const [{ data }, products] = await Promise.all([
    supabase
      .from("inv_sales")
      .select("*, inv_customers(name, phone), inv_sale_items(product_id, qty, unit_price, unit_cost)")
      .eq("sale_date", date)
      .order("created_at", { ascending: false }),
    loadProducts(true),
  ]);
  const sales = (data ?? []) as Sale[];
  const byId = new Map(products.map((p) => [p.id, p]));
  const units = sales.reduce((a, s) => a + (s.inv_sale_items ?? []).reduce((b, i) => b + i.qty, 0), 0);
  const total = sales.reduce((a, s) => a + Number(s.total), 0);
  const byPayment = (["efectivo", "nequi", "transferencia"] as const).map((k) => ({
    k,
    total: sales.filter((s) => s.payment === k).reduce((a, s) => a + Number(s.total), 0),
    count: sales.filter((s) => s.payment === k).length,
  }));
  const sellers = Object.entries(
    sales.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.created_by ?? "Sin usuario"]: (acc[s.created_by ?? "Sin usuario"] ?? 0) + Number(s.total) }), {}),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">Ventas del {longDate(date)}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link className="btn-ghost px-2" href={`/ventas?fecha=${addDays(date, -1)}`} aria-label="Día anterior">←</Link>
          <form className="flex gap-2">
            <input className="input" type="date" name="fecha" max={today} defaultValue={date} aria-label="Elegir día" />
            <button className="btn-ghost" type="submit">Ver</button>
          </form>
          {date < today && <Link className="btn-ghost px-2" href={`/ventas?fecha=${addDays(date, 1)}`} aria-label="Día siguiente">→</Link>}
          <Link className="btn" href="/vender">Anotar venta</Link>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="h2">Cierre de caja</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total del día" value={cop(total)} hint={`${sales.length} ventas · ${units} unidades`} />
          {byPayment.map((b) => <Stat key={b.k} label={PAYMENT_LABEL[b.k]} value={cop(b.total)} hint={`${b.count} ventas`} />)}
        </div>
        {sellers.length > 1 && (
          <p className="text-sm text-zinc-500">Por persona: {sellers.map(([who, v]) => `${who} ${cop(v)}`).join(" · ")}</p>
        )}
      </section>

      <section className="card overflow-x-auto p-0">
        {sales.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No hay ventas anotadas este día.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <tr><th className="px-4 py-2">Productos</th><th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Canal y pago</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2">Anotó</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sales.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="space-y-1 px-4 py-2">
                    {(s.inv_sale_items ?? []).map((i, k) => {
                      const p = byId.get(i.product_id);
                      return (
                        <div key={k} className="flex items-center gap-2">
                          {p && <Swatch hex={p.hex} size={18} />}
                          <span>{p ? productLabel(p) : "Producto borrado"} × {i.qty}</span>
                          <span className="text-xs text-zinc-500">{cop(Number(i.unit_price))} c/u</span>
                        </div>
                      );
                    })}
                    {s.notes && <div className="text-xs text-zinc-500">{s.notes}</div>}
                  </td>
                  <td className="px-4 py-2">{s.inv_customers?.name ?? <span className="text-zinc-400">—</span>}<div className="text-xs text-zinc-500">{s.inv_customers?.phone}</div></td>
                  <td className="px-4 py-2">{CHANNEL_LABEL[s.channel]}<div className="text-xs text-zinc-500">{PAYMENT_LABEL[s.payment]}</div></td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{cop(Number(s.total))}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">{s.created_by}</td>
                  <td className="px-4 py-2 text-right">
                    <details>
                      <summary className="cursor-pointer text-xs text-zinc-400 hover:text-red-600">Borrar</summary>
                      <form action={deleteSale.bind(null, s.id)} className="mt-1">
                        <button className="text-xs font-medium text-red-600" type="submit">Sí, borrar y devolver al inventario</button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
