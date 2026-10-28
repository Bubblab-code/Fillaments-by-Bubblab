import { test } from "node:test";
import assert from "node:assert/strict";
import { demand, monthSeries, objective, orderMessage, periodRange, stockStatus, suggestedOrder, summarize, type Line } from "../lib/inventory.ts";
import type { Product } from "../lib/types.ts";

const settings = { lead_days: 4, safety_days: 3, min_order: 2, coverage_months: 2 };

function product(id: string, over: Partial<Product> = {}): Product {
  return { id, kind: "filamento", material: "PLA", brand: null, color: id, hex: "#000000", unit: "rollo 1 kg", cost: 50000, default_price: 80000, target: 20, market: "media", on_demand: false, active: true, stock: 0, ...over };
}

function sale(product_id: string, qty: number, sale_date: string, over: Partial<Line> = {}): Line {
  return { product_id, qty, unit_price: 80000, unit_cost: 50000, sale_date, channel: "local", payment: "efectivo", created_by: "a@b.co", ...over };
}

test("sin ventas, el pedido se reparte por demanda del mercado", () => {
  const d = demand([], "2026-10-28");
  assert.equal(d.ownWeight, 0);
  const rows = suggestedOrder([product("negro", { market: "alta", target: 50 }), product("rosado", { market: "baja" }), product("rojo", { stock: 10 })], d, settings);
  assert.deepEqual(rows.map((r) => r.qty), [50, 10, 6]);
});

test("con 6 meses de ventas manda lo que se vende y no se pide de lo que casi no sale", () => {
  const lines: Line[] = [];
  for (let m = 5; m <= 10; m++) {
    const mm = String(m).padStart(2, "0");
    lines.push(sale("negro", 15, `2026-${mm}-01`), sale("morado", 1, `2026-${mm}-02`));
  }
  const d = demand(lines, "2026-10-28");
  assert.ok(d.ownWeight > 0.95);
  const negro = product("negro", { target: 50, stock: 5 });
  const morado = product("morado", { stock: 4 });
  assert.equal(objective(negro, d, 2), 31);
  const rows = suggestedOrder([negro, morado], d, settings);
  assert.equal(rows[0].qty, 26);
  assert.equal(rows[1].qty, 0);
  assert.equal(rows[1].lowSeller, true);
});

test("respeta el pedido mínimo del proveedor", () => {
  const rows = suggestedOrder([product("gris", { target: 20, stock: 19, market: "alta" }), product("azul", { target: 20, stock: 20, market: "alta" })], demand([], "2026-10-28"), settings);
  assert.equal(rows.reduce((a, r) => a + r.qty, 0), 2);
});

test("lo que es a pedido no entra al pedido automático", () => {
  const rows = suggestedOrder([product("tpu", { on_demand: true })], demand([], "2026-10-28"), settings);
  assert.equal(rows.length, 0);
});

test("alerta 'pide ya' cuando no alcanza para lo que tarda el pedido", () => {
  const lines = [sale("negro", 60, "2026-09-28")]; // ~2 por día
  const d = demand(lines, "2026-10-28");
  assert.equal(stockStatus(product("negro", { stock: 10, target: 50 }), d, settings).level, "pide-ya");
  assert.equal(stockStatus(product("negro", { stock: 40, target: 50 }), d, settings).level, "bien");
  assert.equal(stockStatus(product("negro", { stock: 0 }), d, settings).level, "agotado");
  assert.equal(stockStatus(product("rojo", { stock: 5 }), d, settings).level, "muy-bajo");
});

test("métricas: unidades, pesos, ganancia y desgloses", () => {
  const lines = [sale("negro", 2, "2026-10-05"), sale("blanco", 1, "2026-10-06", { channel: "whatsapp", payment: "nequi", unit_price: 90000 }), sale("negro", 5, "2026-09-10")];
  const r = periodRange("mes", "2026-10-28");
  const s = summarize(lines, r.from, r.to);
  assert.deepEqual(s.total, { units: 3, revenue: 250000, cost: 150000, profit: 100000 });
  assert.equal(s.byChannel.whatsapp.revenue, 90000);
  assert.equal(s.byPayment.efectivo.units, 2);
  const months = monthSeries(lines, "2026-10-28", 6);
  assert.equal(months.length, 6);
  assert.equal(months[5].units, 3);
  assert.equal(months[4].units, 5);
});

test("mensaje del pedido para WhatsApp", () => {
  const rows = suggestedOrder([product("negro", { color: "Negro", brand: "Sunlu", market: "alta", stock: 48, target: 50 })], demand([], "2026-10-28"), settings);
  assert.equal(orderMessage(rows, "28 de octubre de 2026", "Don Carlos"), "Hola Don Carlos, este es el pedido de Bubblab del 28 de octubre de 2026:\n\n• PLA Sunlu Negro: 2 rollos\n\nTotal: 2 unidades. ¡Gracias!");
});
