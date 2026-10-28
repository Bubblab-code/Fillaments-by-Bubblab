import { createClient } from "@/lib/supabase/server";
import type { Line } from "@/lib/inventory";
import type { Product, Settings } from "@/lib/types";

const DEFAULT_SETTINGS: Settings = { supplier_name: null, supplier_whatsapp: null, lead_days: 4, safety_days: 3, min_order: 2, coverage_months: 2 };

export async function loadProducts(includeArchived = false): Promise<Product[]> {
  const supabase = await createClient();
  let q = supabase.from("inv_products").select("*").order("kind").order("material").order("color").order("brand");
  if (!includeArchived) q = q.eq("active", true);
  const { data } = await q;
  return ((data ?? []) as Product[]).map((p) => ({
    ...p,
    cost: p.cost === null ? null : Number(p.cost),
    default_price: p.default_price === null ? null : Number(p.default_price),
  }));
}

export async function loadSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase.from("inv_settings").select("*").eq("id", 1).maybeSingle();
  return data ? { ...DEFAULT_SETTINGS, ...data, coverage_months: Number(data.coverage_months) } : DEFAULT_SETTINGS;
}

type Row = {
  product_id: string;
  qty: number;
  unit_price: number | string;
  unit_cost: number | string | null;
  inv_sales: { sale_date: string; channel: string; payment: string; created_by: string | null };
};

/** Renglones vendidos desde `since` (fecha YYYY-MM-DD), en páginas de 1000. */
export async function loadLines(since: string): Promise<Line[]> {
  const supabase = await createClient();
  const out: Line[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("inv_sale_items")
      .select("product_id, qty, unit_price, unit_cost, inv_sales!inner(sale_date, channel, payment, created_by)")
      .gte("inv_sales.sale_date", since)
      .range(from, from + 999);
    if (error || !data) break;
    for (const r of data as unknown as Row[]) {
      out.push({
        product_id: r.product_id,
        qty: r.qty,
        unit_price: Number(r.unit_price),
        unit_cost: r.unit_cost === null ? null : Number(r.unit_cost),
        sale_date: r.inv_sales.sale_date,
        channel: r.inv_sales.channel,
        payment: r.inv_sales.payment,
        created_by: r.inv_sales.created_by,
      });
    }
    if (data.length < 1000) break;
  }
  return out;
}

/** ¿Ya se corrió la migración en Supabase? */
export async function schemaReady(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("inv_settings").select("id").limit(1);
  return !error;
}
