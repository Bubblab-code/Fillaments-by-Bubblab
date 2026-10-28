// Cálculos del inventario: demanda, pedido sugerido, alertas y métricas.
// Funciones puras (sin base de datos) para poder probarlas.
import type { Market, Product, Settings } from "./types.ts";

export type Line = {
  product_id: string;
  qty: number;
  unit_price: number;
  unit_cost: number | null;
  sale_date: string;
  channel: string;
  payment: string;
  created_by: string | null;
};

const DAY = 86_400_000;
const MONTH_DAYS = 30.4;

// Mientras no hay ventas propias, el pedido se reparte según lo que más se vende en el mercado.
export const MARKET_FACTOR: Record<Market, number> = { alta: 1, media: 0.8, baja: 0.5 };
export const MARKET_LABEL: Record<Market, string> = { alta: "Alta", media: "Media", baja: "Baja" };

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);
}

export function shiftMonths(month: string, k: number): string {
  let [y, m] = month.split("-").map(Number);
  m += k;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export type Demand = {
  /** Unidades promedio por mes de cada producto (últimos 6 meses). */
  monthly: Record<string, number>;
  /** Días con ventas anotadas dentro de la ventana (desde la primera venta). */
  days: number;
  /** Cuánto pesan las ventas propias frente al mercado: 0 sin datos, 1 con 6 meses. */
  ownWeight: number;
};

export function demand(lines: Line[], today: string): Demand {
  const since = shiftDate(today, -182);
  const inWindow = lines.filter((l) => l.sale_date >= since && l.sale_date <= today);
  if (!inWindow.length) return { monthly: {}, days: 0, ownWeight: 0 };
  const first = inWindow.reduce((a, l) => (l.sale_date < a ? l.sale_date : a), today);
  const days = daysBetween(first, today) + 1;
  const months = Math.min(6, Math.max(days, 14) / MONTH_DAYS);
  const monthly: Record<string, number> = {};
  for (const l of inWindow) monthly[l.product_id] = (monthly[l.product_id] ?? 0) + l.qty;
  for (const k of Object.keys(monthly)) monthly[k] = monthly[k] / months;
  const ownWeight = days < 14 ? 0 : Math.min(1, days / MONTH_DAYS / 6);
  return { monthly, days, ownWeight };
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Cuántos conviene tener de un producto: mezcla la meta (ajustada al mercado) con lo que realmente se vende. */
export function objective(p: Pick<Product, "id" | "target" | "market">, d: Demand, coverageMonths: number): number {
  const marketTarget = p.target * MARKET_FACTOR[p.market];
  const own = Math.min(p.target, Math.ceil((d.monthly[p.id] ?? 0) * coverageMonths));
  return Math.round((1 - d.ownWeight) * marketTarget + d.ownWeight * own);
}

export type OrderRow = {
  product: Product;
  objective: number;
  qty: number;
  monthly: number;
  lowSeller: boolean;
};

export function suggestedOrder(products: Product[], d: Demand, s: Pick<Settings, "coverage_months" | "min_order">): OrderRow[] {
  const rows = products
    .filter((p) => p.active && !p.on_demand)
    .map((p) => {
      const obj = objective(p, d, s.coverage_months);
      return {
        product: p,
        objective: obj,
        qty: Math.max(0, obj - Math.max(0, p.stock)),
        monthly: d.monthly[p.id] ?? 0,
        lowSeller: obj < p.target,
      };
    });
  const total = rows.reduce((a, r) => a + r.qty, 0);
  // Pedido mínimo del proveedor: completar con lo que más se vende (o lo que más falta).
  if (total > 0 && total < s.min_order) {
    const best = [...rows].sort((a, b) => b.monthly - a.monthly || b.qty - a.qty)[0];
    best.qty += s.min_order - total;
  }
  return rows;
}

export type StockLevel = "agotado" | "pide-ya" | "muy-bajo" | "bajo" | "bien" | "a-pedido";

export const LEVEL_LABEL: Record<StockLevel, string> = {
  agotado: "Agotado",
  "pide-ya": "Pide ya",
  "muy-bajo": "Muy bajo",
  bajo: "Bajo",
  bien: "Bien",
  "a-pedido": "A pedido",
};

export function stockStatus(p: Product, d: Demand, s: Pick<Settings, "lead_days" | "safety_days">): { level: StockLevel; daysLeft: number | null } {
  const rate = (d.monthly[p.id] ?? 0) / MONTH_DAYS;
  const daysLeft = rate > 0 ? Math.max(0, p.stock) / rate : null;
  if (p.on_demand) return { level: "a-pedido", daysLeft };
  if (p.stock <= 0) return { level: "agotado", daysLeft: 0 };
  if (daysLeft !== null && daysLeft <= s.lead_days + s.safety_days) return { level: "pide-ya", daysLeft };
  if (p.target > 0 && p.stock < p.target * 0.35) return { level: "muy-bajo", daysLeft };
  if (p.target > 0 && p.stock < p.target * 0.75) return { level: "bajo", daysLeft };
  return { level: "bien", daysLeft };
}

export function productLabel(p: Pick<Product, "material" | "brand" | "color" | "kind">): string {
  return [p.kind === "resina" ? "Resina" : p.material, p.brand, p.color].filter(Boolean).join(" ");
}

export function orderMessage(rows: OrderRow[], dateLabel: string, supplier: string | null): string {
  const items = rows.filter((r) => r.qty > 0);
  const total = items.reduce((a, r) => a + r.qty, 0);
  const lines = items.map((r) => `• ${productLabel(r.product)}: ${r.qty} ${r.product.kind === "resina" ? "L" : "rollos"}`);
  return [`Hola${supplier ? ` ${supplier}` : ""}, este es el pedido de Bubblab del ${dateLabel}:`, "", ...lines, "", `Total: ${total} unidades. ¡Gracias!`].join("\n");
}

export type Totals = { units: number; revenue: number; cost: number; profit: number };
const zero = (): Totals => ({ units: 0, revenue: 0, cost: 0, profit: 0 });

function add(t: Totals, l: Line) {
  const revenue = l.qty * l.unit_price;
  const cost = l.qty * (l.unit_cost ?? 0);
  t.units += l.qty;
  t.revenue += revenue;
  t.cost += cost;
  t.profit += revenue - cost;
}

export function summarize(lines: Line[], from: string, to: string) {
  const total = zero();
  const byProduct: Record<string, Totals> = {};
  const byChannel: Record<string, Totals> = {};
  const byPayment: Record<string, Totals> = {};
  const bySeller: Record<string, Totals> = {};
  let missingCost = false;
  for (const l of lines) {
    if (l.sale_date < from || l.sale_date > to) continue;
    add(total, l);
    add((byProduct[l.product_id] ??= zero()), l);
    add((byChannel[l.channel] ??= zero()), l);
    add((byPayment[l.payment] ??= zero()), l);
    add((bySeller[l.created_by ?? "Sin usuario"] ??= zero()), l);
    if (l.unit_cost === null) missingCost = true;
  }
  return { total, byProduct, byChannel, byPayment, bySeller, missingCost };
}

/** Unidades y pesos por mes, de los últimos `months` meses (incluido el actual). */
export function monthSeries(lines: Line[], today: string, months: number) {
  const now = today.slice(0, 7);
  const out: { month: string; units: number; revenue: number }[] = [];
  for (let k = months - 1; k >= 0; k--) out.push({ month: shiftMonths(now, -k), units: 0, revenue: 0 });
  const idx = new Map(out.map((m, i) => [m.month, i]));
  for (const l of lines) {
    const i = idx.get(l.sale_date.slice(0, 7));
    if (i === undefined) continue;
    out[i].units += l.qty;
    out[i].revenue += l.qty * l.unit_price;
  }
  return out;
}

export function periodRange(period: string, today: string): { from: string; to: string; label: string } {
  const now = today.slice(0, 7);
  if (period === "pasado") {
    const m = shiftMonths(now, -1);
    return { from: `${m}-01`, to: `${m}-31`, label: `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` };
  }
  if (period === "3m") return { from: `${shiftMonths(now, -2)}-01`, to: today, label: "los últimos 3 meses" };
  if (period === "6m") return { from: `${shiftMonths(now, -5)}-01`, to: today, label: "los últimos 6 meses" };
  return { from: `${now}-01`, to: today, label: `${MONTHS[Number(now.slice(5)) - 1]} ${now.slice(0, 4)}` };
}

export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}
