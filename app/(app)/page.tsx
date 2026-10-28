import Link from "next/link";
import { saveCount, loadStarterColors } from "@/app/actions";
import { loadLines, loadProducts, loadSettings, schemaReady } from "@/lib/data";
import { addDays, todayCO } from "@/lib/dates";
import { demand, productLabel, stockStatus } from "@/lib/inventory";
import { LevelBadge, SetupNotice, Stat, Swatch } from "@/components/ui";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ contar?: string; contado?: string }> }) {
  if (!(await schemaReady())) return <SetupNotice />;
  const sp = await searchParams;
  const today = todayCO();
  const [products, settings, lines] = await Promise.all([loadProducts(), loadSettings(), loadLines(addDays(today, -182))]);
  const d = demand(lines, today);
  const rows = products.map((p) => ({ p, ...stockStatus(p, d, settings) }));
  const counting = sp.contar === "1";

  if (!products.length) {
    return (
      <div className="card mx-auto max-w-lg space-y-3 text-center">
        <h1 className="h1">Aún no hay productos</h1>
        <p className="text-sm text-zinc-500">
          Agrega tus filamentos y resinas en Productos, o carga 16 colores base de PLA para empezar (negro y blanco con meta de 50, el resto de 20). Después
          les cambias la marca, el color y la meta.
        </p>
        <div className="flex justify-center gap-2">
          <form action={loadStarterColors}><button className="btn" type="submit">Cargar colores base</button></form>
          <Link href="/productos" className="btn-ghost">Ir a Productos</Link>
        </div>
      </div>
    );
  }

  const tracked = rows.filter((r) => !r.p.on_demand);
  const units = tracked.reduce((a, r) => a + Math.max(0, r.p.stock), 0);
  const target = tracked.reduce((a, r) => a + r.p.target, 0);
  const missing = tracked.reduce((a, r) => a + Math.max(0, r.p.target - Math.max(0, r.p.stock)), 0);
  const urgent = rows.filter((r) => r.level === "agotado" || r.level === "pide-ya");
  const order: Record<string, number> = { agotado: 0, "pide-ya": 1, "muy-bajo": 2, bajo: 3, bien: 4, "a-pedido": 5 };
  rows.sort((a, b) => order[a.level] - order[b.level] || a.p.color.localeCompare(b.p.color));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">Inventario</h1>
        {sp.contado && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Conteo guardado</span>}
        <div className="ml-auto flex gap-2">
          {counting ? <Link href="/" className="btn-ghost">Cancelar conteo</Link> : <Link href="/?contar=1" className="btn-ghost">Contar inventario</Link>}
          <Link href="/vender" className="btn">Anotar ventas</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="En bodega" value={String(units)} hint="rollos y litros" />
        <Stat label="Meta total" value={String(target)} />
        <Stat label="Faltan para la meta" value={String(missing)} />
        <Stat label="Para pedir ya" value={String(urgent.length)} hint={urgent.length ? "agotados o sin margen" : "todo con margen"} />
      </div>

      {urgent.length > 0 && !counting && (
        <div className="card flex flex-wrap items-center gap-3 border-red-200 bg-red-50 text-sm text-red-800">
          <span>
            <b>Pide ya:</b> {urgent.map((r) => productLabel(r.p)).join(", ")}. El pedido tarda {settings.lead_days} días en llegar.
          </span>
          <Link href="/pedido" className="btn ml-auto">Armar pedido</Link>
        </div>
      )}

      <form action={saveCount} className="card overflow-x-auto p-0">
        {counting && (
          <p className="border-b border-zinc-200 px-4 py-3 text-sm text-zinc-600">
            Escribe cuántos hay físicamente de cada producto. Lo que dejes igual no cambia. Al guardar, el conteo reemplaza las existencias.
          </p>
        )}
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2 text-right">Hay</th>
              <th className="px-4 py-2 text-right">Meta</th>
              <th className="px-4 py-2">Nivel</th>
              <th className="px-4 py-2 text-right">Alcanza para</th>
              <th className="px-4 py-2 text-right">Vende/mes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map(({ p, level, daysLeft }) => (
              <tr key={p.id}>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Swatch hex={p.hex} />
                    <div>
                      <div className="font-medium">{p.color}</div>
                      <div className="text-xs text-zinc-500">{[p.kind === "resina" ? "Resina" : p.material, p.brand].filter(Boolean).join(" · ")}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {counting ? (
                    <input className="input w-20 text-right" type="number" min={0} inputMode="numeric" name={`q_${p.id}`} defaultValue={Math.max(0, p.stock)} aria-label={`Hay de ${productLabel(p)}`} />
                  ) : (
                    <b>{p.stock}</b>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-500">{p.on_demand ? "—" : p.target}</td>
                <td className="px-4 py-2"><LevelBadge level={level} /></td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-500">{daysLeft === null ? "—" : `${Math.floor(daysLeft)} días`}</td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-500">{(d.monthly[p.id] ?? 0).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {counting && (
          <div className="flex justify-end border-t border-zinc-200 px-4 py-3">
            <button className="btn" type="submit">Guardar conteo</button>
          </div>
        )}
      </form>
      <p className="text-xs text-zinc-500">
        "Alcanza para" usa el promedio de ventas de los últimos 6 meses. "Pide ya" sale cuando no alcanza para los {settings.lead_days} días del pedido más{" "}
        {settings.safety_days} de margen.
      </p>
    </div>
  );
}
