"use client";

import { useMemo, useState, useTransition } from "react";
import { registerSale, type SaleInput } from "@/app/actions";
import { productLabel } from "@/lib/inventory";
import { cop } from "@/lib/format";
import { Swatch } from "@/components/ui";
import type { Customer, Product } from "@/lib/types";

type Line = { product_id: string; qty: number; price: string };

const CHANNELS = [["local", "Local"], ["whatsapp", "WhatsApp"]] as const;
const PAYMENTS = [["efectivo", "Efectivo"], ["nequi", "Nequi"], ["transferencia", "Transferencia"]] as const;

function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="inline-flex flex-wrap gap-1 rounded-md bg-zinc-100 p-1" role="group" aria-label={label}>
        {options.map(([v, t]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${value === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SaleForm({ products, customers, lastPrice, today }: { products: Product[]; customers: Customer[]; lastPrice: Record<string, number>; today: string }) {
  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<SaleInput["channel"]>("local");
  const [payment, setPayment] = useState<SaleInput["payment"]>("efectivo");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shown = products.filter((p) => !filter || productLabel(p).toLowerCase().includes(filter.toLowerCase()));
  const total = lines.reduce((a, l) => a + l.qty * (Number(l.price) || 0), 0);
  const units = lines.reduce((a, l) => a + l.qty, 0);

  function add(p: Product) {
    setMsg(null);
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product_id === p.id);
      if (i >= 0) return ls.map((l, k) => (k === i ? { ...l, qty: l.qty + 1 } : l));
      const price = lastPrice[p.id] ?? p.default_price;
      return [...ls, { product_id: p.id, qty: 1, price: price ? String(price) : "" }];
    });
  }
  function update(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)).filter((l) => l.qty > 0));
  }
  function pickName(v: string) {
    setName(v);
    const c = customers.find((x) => x.name.toLowerCase() === v.trim().toLowerCase());
    if (c?.phone && !phone) setPhone(c.phone);
  }
  function save() {
    start(async () => {
      const res = await registerSale({
        sale_date: date, channel, payment, customer_name: name, customer_phone: phone, notes,
        items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, unit_price: Number(l.price) || 0 })),
      });
      if (res.ok) {
        setMsg({ ok: true, text: `Venta guardada: ${units} ${units === 1 ? "unidad" : "unidades"} por ${cop(total)}.` });
        setLines([]); setName(""); setPhone(""); setNotes("");
      } else setMsg({ ok: false, text: res.error });
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="h2">Productos</h2>
          <input className="input ml-auto max-w-56" placeholder="Buscar color o marca" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar producto" />
        </div>
        {products.length === 0 && <p className="text-sm text-zinc-500">No hay productos todavía. Agrégalos en Productos.</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((p) => {
            const inCart = lines.find((l) => l.product_id === p.id)?.qty ?? 0;
            return (
              <button key={p.id} type="button" onClick={() => add(p)}
                className={`flex items-center gap-2 rounded-lg border p-2 text-left ${inCart ? "border-brand bg-brand-soft" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}>
                <Swatch hex={p.hex} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.color}</span>
                  <span className="block truncate text-xs text-zinc-500">{[p.kind === "resina" ? "Resina" : p.material, p.brand].filter(Boolean).join(" · ")} · quedan {p.stock}</span>
                </span>
                {inCart > 0 && <span className="rounded-full bg-brand px-2 text-xs font-semibold text-white">{inCart}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card space-y-4 lg:sticky lg:top-20 lg:self-start">
        <h2 className="h2">Venta</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="sale-date">Fecha</label>
            <input id="sale-date" className="input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value || today)} />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="sale-name">Cliente</label>
            <input id="sale-name" className="input" list="customers" placeholder="Nombre (opcional)" value={name} onChange={(e) => pickName(e.target.value)} />
            <datalist id="customers">{customers.map((c) => <option key={c.id} value={c.name}>{c.phone ?? ""}</option>)}</datalist>
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="sale-phone">Teléfono</label>
            <input id="sale-phone" className="input" type="tel" inputMode="tel" placeholder="Opcional" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <Toggle label="Canal" value={channel} options={CHANNELS} onChange={setChannel} />
        <Toggle label="Pago" value={payment} options={PAYMENTS} onChange={setPayment} />

        <div className="space-y-2">
          {lines.length === 0 && <p className="text-sm text-zinc-500">Toca los productos que se vendieron.</p>}
          {lines.map((l, i) => {
            const p = byId.get(l.product_id)!;
            return (
              <div key={l.product_id} className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 border-t border-zinc-100 pt-2">
                <Swatch hex={p.hex} size={22} />
                <span className="truncate text-sm font-medium">{productLabel(p)}</span>
                <div className="col-span-2 flex items-center gap-2">
                  <button type="button" className="btn-ghost w-9 px-0 py-1" onClick={() => update(i, { qty: l.qty - 1 })} aria-label="Quitar uno">−</button>
                  <span className="w-6 text-center tabular-nums">{l.qty}</span>
                  <button type="button" className="btn-ghost w-9 px-0 py-1" onClick={() => update(i, { qty: l.qty + 1 })} aria-label="Sumar uno">+</button>
                  <label className="ml-auto flex items-center gap-1 text-xs text-zinc-500">
                    c/u $
                    <input className="input w-28 py-1 text-right" inputMode="numeric" value={l.price} onChange={(e) => update(i, { price: e.target.value.replace(/[^0-9]/g, "") })} aria-label={`Precio de ${productLabel(p)}`} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <label className="label" htmlFor="sale-notes">Nota</label>
          <input id="sale-notes" className="input" placeholder="Opcional" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
          <div>
            <div className="text-xs text-zinc-500">{units} {units === 1 ? "unidad" : "unidades"}</div>
            <div className="text-xl font-semibold tabular-nums">{cop(total)}</div>
          </div>
          <button type="button" className="btn" disabled={pending || lines.length === 0} onClick={save}>{pending ? "Guardando…" : "Guardar venta"}</button>
        </div>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
        {lines.some((l) => !Number(l.price)) && <p className="text-xs text-amber-700">Hay productos sin precio: se guardarán en $0.</p>}
      </section>
    </div>
  );
}
