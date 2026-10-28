import { createClient } from "@/lib/supabase/server";
import { loadLines, loadProducts, schemaReady } from "@/lib/data";
import { addDays, todayCO } from "@/lib/dates";
import { SaleForm } from "@/components/sale-form";
import { SetupNotice } from "@/components/ui";
import type { Customer } from "@/lib/types";

export default async function SellPage() {
  if (!(await schemaReady())) return <SetupNotice />;
  const supabase = await createClient();
  const today = todayCO();
  const [products, { data: customers }, recent] = await Promise.all([
    loadProducts(),
    supabase.from("inv_customers").select("id, name, phone").order("name"),
    loadLines(addDays(today, -90)),
  ]);
  // Último precio cobrado de cada producto, para sugerirlo.
  const lastPrice: Record<string, number> = {};
  const lastDate: Record<string, string> = {};
  for (const l of recent) {
    if (!lastDate[l.product_id] || l.sale_date >= lastDate[l.product_id]) {
      lastDate[l.product_id] = l.sale_date;
      lastPrice[l.product_id] = l.unit_price;
    }
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Anotar ventas</h1>
        <p className="text-sm text-zinc-500">Una venta por cliente. Al guardar se descuenta del inventario.</p>
      </div>
      <SaleForm products={products} customers={(customers ?? []) as Customer[]} lastPrice={lastPrice} today={today} />
    </div>
  );
}
