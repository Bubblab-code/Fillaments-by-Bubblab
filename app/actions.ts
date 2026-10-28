"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, currentUserEmail } from "@/lib/supabase/server";
import { todayCO } from "@/lib/dates";
import type { Market } from "@/lib/types";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function refreshAll() {
  revalidatePath("/", "layout");
}

// ---------- Sesión ----------

export async function signIn(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(fd, "email") ?? "",
    password: (fd.get("password") as string) ?? "",
  });
  if (error) redirect("/login?error=1");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- Productos ----------

function productFields(fd: FormData) {
  const color = str(fd, "color");
  if (!color) throw new Error("El color es obligatorio");
  const kind = str(fd, "kind") === "resina" ? "resina" : "filamento";
  const market = (["alta", "media", "baja"].includes(str(fd, "market") ?? "") ? str(fd, "market") : "media") as Market;
  return {
    kind,
    material: str(fd, "material") ?? (kind === "resina" ? "Estándar" : "PLA"),
    brand: str(fd, "brand"),
    color,
    hex: /^#[0-9a-fA-F]{6}$/.test(str(fd, "hex") ?? "") ? str(fd, "hex")! : "#888888",
    unit: kind === "resina" ? "litro" : "rollo 1 kg",
    cost: num(fd, "cost"),
    default_price: num(fd, "default_price"),
    target: Math.max(0, Math.round(num(fd, "target") ?? 0)),
    market,
    on_demand: fd.get("on_demand") === "on",
    active: fd.get("active") !== "off",
  };
}

export async function saveProduct(id: string | null, fd: FormData) {
  const supabase = await createClient();
  const fields = productFields(fd);
  if (id) await supabase.from("inv_products").update(fields).eq("id", id);
  else await supabase.from("inv_products").insert({ ...fields, stock: Math.max(0, Math.round(num(fd, "stock") ?? 0)) });
  refreshAll();
}

export async function archiveProduct(id: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("inv_products").update({ active }).eq("id", id);
  refreshAll();
}

// Colores base para empezar: los que más se venden en el mercado van con demanda alta.
const STARTER: [string, string, Market, number][] = [
  ["Negro", "#1b1b1d", "alta", 50], ["Blanco", "#f7f7f5", "alta", 50], ["Gris", "#8a8f98", "media", 20],
  ["Plata", "#c4c8cf", "media", 20], ["Dorado", "#c49a2c", "media", 20], ["Rojo", "#d0262c", "media", 20],
  ["Azul", "#2459c9", "media", 20], ["Azul cielo", "#6fb6ec", "media", 20], ["Amarillo", "#f5cf1f", "media", 20],
  ["Verde", "#2e9e48", "media", 20], ["Naranja", "#f07a1a", "media", 20], ["Morado", "#6c3fb0", "baja", 20],
  ["Rosado", "#f39ac0", "baja", 20], ["Café", "#6b4226", "baja", 20], ["Piel", "#efc8a8", "baja", 20],
  ["Transparente", "#dfe9ee", "baja", 20],
];

export async function loadStarterColors() {
  const supabase = await createClient();
  const { count } = await supabase.from("inv_products").select("id", { count: "exact", head: true });
  if (count) return;
  await supabase.from("inv_products").insert(
    STARTER.map(([color, hex, market, target]) => ({ kind: "filamento", material: "PLA", color, hex, market, target, unit: "rollo 1 kg" })),
  );
  refreshAll();
}

export async function saveSettings(fd: FormData) {
  const supabase = await createClient();
  await supabase
    .from("inv_settings")
    .update({
      supplier_name: str(fd, "supplier_name"),
      supplier_whatsapp: str(fd, "supplier_whatsapp")?.replace(/[^0-9]/g, "") || null,
      lead_days: Math.max(0, Math.round(num(fd, "lead_days") ?? 4)),
      safety_days: Math.max(0, Math.round(num(fd, "safety_days") ?? 3)),
      min_order: Math.max(0, Math.round(num(fd, "min_order") ?? 2)),
      coverage_months: Math.max(0.5, num(fd, "coverage_months") ?? 2),
    })
    .eq("id", 1);
  refreshAll();
}

// ---------- Ventas ----------

export type SaleInput = {
  sale_date: string;
  channel: "local" | "whatsapp";
  payment: "efectivo" | "nequi" | "transferencia";
  customer_name: string;
  customer_phone: string;
  notes: string;
  items: { product_id: string; qty: number; unit_price: number }[];
};

export async function registerSale(input: SaleInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const items = input.items.filter((i) => i.product_id && i.qty > 0);
  if (!items.length) return { ok: false, error: "Agrega al menos un producto con cantidad." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sale_date) || input.sale_date > todayCO()) return { ok: false, error: "La fecha no es válida." };
  const supabase = await createClient();
  const author = await currentUserEmail();
  const { error } = await supabase.rpc("inv_register_sale", { p: { ...input, items }, author });
  if (error) return { ok: false, error: "No se pudo guardar la venta. Revisa la conexión e inténtalo de nuevo." };
  refreshAll();
  return { ok: true };
}

export async function deleteSale(id: string) {
  const supabase = await createClient();
  await supabase.rpc("inv_delete_sale", { p_sale: id, author: await currentUserEmail() });
  refreshAll();
}

// ---------- Existencias ----------

function itemsFrom(fd: FormData, prefix: string) {
  const items: { product_id: string; qty: number }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith(prefix) || typeof v !== "string" || v.trim() === "") continue;
    const qty = Math.round(Number(v));
    if (Number.isFinite(qty)) items.push({ product_id: k.slice(prefix.length), qty });
  }
  return items;
}

export async function saveCount(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("inv_adjust_stock", { items: itemsFrom(fd, "q_"), mode: "conteo", ref: null, author: await currentUserEmail() });
  refreshAll();
  redirect("/?contado=1");
}

// ---------- Pedidos ----------

export async function createOrder(fd: FormData) {
  const supabase = await createClient();
  const raw = str(fd, "items");
  const items = raw ? (JSON.parse(raw) as { product_id: string; qty: number; label: string }[]).filter((i) => i.qty > 0) : [];
  if (!items.length) return;
  await supabase.from("inv_orders").insert({ items, message: str(fd, "message"), created_by: await currentUserEmail() });
  refreshAll();
}

export async function receiveOrder(id: string, fd: FormData) {
  const supabase = await createClient();
  const items = itemsFrom(fd, "q_").filter((i) => i.qty > 0);
  await supabase.rpc("inv_adjust_stock", { items, mode: "entrada", ref: id, author: await currentUserEmail() });
  await supabase.from("inv_orders").update({ status: "recibido", received_at: new Date().toISOString() }).eq("id", id);
  refreshAll();
}

export async function cancelOrder(id: string) {
  const supabase = await createClient();
  await supabase.from("inv_orders").update({ status: "cancelado" }).eq("id", id);
  refreshAll();
}
