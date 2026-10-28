import Link from "next/link";
import { loadLines, loadProducts, schemaReady } from "@/lib/data";
import { todayCO } from "@/lib/dates";
import { MONTHS, monthSeries, periodRange, productLabel, shiftMonths, summarize, type Totals } from "@/lib/inventory";
import { CHANNEL_LABEL, PAYMENT_LABEL, cop } from "@/lib/format";
import { SetupNotice, Stat, Swatch } from "@/components/ui";

const PERIODS = [["mes", "Este mes"], ["pasado", "Mes pasado"], ["3m", "3 meses"], ["6m", "6 meses"]] as const;

function Breakdown({ title, data, labels }: { title: string; data: Record<string, Totals>; labels?: Record<string, string> }) {
  const rows = Object.entries(data).sort((a, b) => b[1].revenue - a[1].revenue);
  if (!rows.length) return null;
  return (
    <section className="card space-y-2">
      <h2 className="h2">{title}</h2>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-zinc-100">
          {rows.map(([k, t]) => (
            <tr key={k}><td className="py-1.5">{labels?.[k] ?? k}</td><td className="py-1.5 text-right tabular-nums text-zinc-500">{t.units} u.</td><td className="py-1.5 text-right font-medium tabular-nums">{cop(t.revenue)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  if (!(await schemaReady())) return <SetupNotice />;
  const sp = await searchParams;
  const period = PERIODS.some(([k]) => k === sp.periodo) ? sp.periodo! : "mes";
  const today = todayCO();
  const [products, lines] = await Promise.all([loadProducts(true), loadLines(`${shiftMonths(today.slice(0, 7), -5)}-01`)]);
  const range = periodRange(period, today);
  const s = summarize(lines, range.from, range.to);
  const months = monthSeries(lines, today, 6);
  const maxUnits = Math.max(1, ...months.map((m) => m.units));

  const ranked = products
    .filter((p) => (p.active && !p.on_demand) || s.byProduct[p.id])
    .map((p) => ({ p, t: s.byProduct[p.id] ?? { units: 0, revenue: 0, cost: 0, profit: 0 } }))
    .sort((a, b) => b.t.units - a.t.units || b.t.revenue - a.t.revenue);
  const maxRank = Math.max(1, ...ranked.map((r) => r.t.units));
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const margin = s.total.revenue > 0 ? Math.round((s.total.profit / s.total.revenue) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">Métricas de {range.label}</h1>
        <nav className="ml-auto inline-flex flex-wrap gap-1 rounded-md bg-zinc-100 p-1 text-sm" aria-label="Periodo">
          {PERIODS.map(([k, t]) => (
            <Link key={k} href={`/metricas?periodo=${k}`} className={`rounded px-3 py-1.5 font-medium ${period === k ? "bg-white shadow-sm" : "text-zinc-500"}`}>{t}</Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Vendido" value={cop(s.total.revenue)} />
        <Stat label="Unidades" value={String(s.total.units)} />
        <Stat label="Ganancia" value={cop(s.total.profit)} hint={margin === null ? undefined : `margen ${margin}%`} />
        <Stat label="Costo de lo vendido" value={cop(s.total.cost)} />
      </div>
      {s.missingCost && <p className="text-xs text-amber-700">Algunos productos no tienen costo de compra, así que la ganancia sale más alta de lo real. Ponles el costo en Productos.</p>}

      {s.total.units === 0 ? (
        <div className="card text-sm text-zinc-500">No hay ventas anotadas en este periodo. <Link href="/vender" className="text-brand underline">Anota las ventas del día</Link> y aquí verás el más y el menos vendido.</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["Más vendido", best], ["Menos vendido", worst]].map(([label, r]) => {
              const x = r as (typeof ranked)[number];
              return (
                <div key={label as string} className="card flex items-center gap-3">
                  <Swatch hex={x.p.hex} size={40} />
                  <div>
                    <div className="text-xs text-zinc-500">{label as string}</div>
                    <div className="font-semibold">{productLabel(x.p)}</div>
                    <div className="text-sm tabular-nums text-zinc-500">{x.t.units} unidades · {cop(x.t.revenue)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <section className="card overflow-x-auto">
            <h2 className="h2 mb-3">Ranking por producto</h2>
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-zinc-500"><tr><th className="py-1">#</th><th className="py-1">Producto</th><th className="w-2/5 py-1" /><th className="py-1 text-right">Unidades</th><th className="py-1 text-right">Vendido</th><th className="py-1 text-right">Ganancia</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {ranked.map((r, i) => (
                  <tr key={r.p.id}>
                    <td className="py-1.5 tabular-nums text-zinc-400">{i + 1}</td>
                    <td className="py-1.5"><div className="flex items-center gap-2"><Swatch hex={r.p.hex} size={18} />{productLabel(r.p)}</div></td>
                    <td className="py-1.5 pr-3"><div className="h-3 rounded bg-zinc-100"><div className="h-3 rounded ring-1 ring-zinc-300" style={{ width: `${(r.t.units / maxRank) * 100}%`, background: r.p.hex }} /></div></td>
                    <td className="py-1.5 text-right tabular-nums">{r.t.units}</td>
                    <td className="py-1.5 text-right tabular-nums">{cop(r.t.revenue)}</td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-500">{cop(r.t.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="card">
        <h2 className="h2 mb-1">Últimos 6 meses</h2>
        <p className="mb-3 text-xs text-zinc-500">Unidades vendidas por mes. El mes en curso va más claro porque no ha terminado.</p>
        <div className="grid h-44 grid-cols-6 items-end gap-2">
          {months.map((m, i) => (
            <div key={m.month} className="flex h-full flex-col justify-end gap-1 text-center">
              <span className="text-xs font-medium tabular-nums">{m.units}</span>
              <div className={`rounded-t ${i === months.length - 1 ? "bg-brand/40" : "bg-brand"}`} style={{ height: `${(m.units / maxUnits) * 100}%`, minHeight: 2 }} />
              <span className="text-xs text-zinc-500">{MONTHS[Number(m.month.slice(5)) - 1].slice(0, 3)}</span>
              <span className="text-[11px] tabular-nums text-zinc-400">{cop(m.revenue)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <Breakdown title="Por canal" data={s.byChannel} labels={CHANNEL_LABEL} />
        <Breakdown title="Por forma de pago" data={s.byPayment} labels={PAYMENT_LABEL} />
        <Breakdown title="Por persona" data={s.bySeller} />
      </div>
    </div>
  );
}
