import { archiveProduct, loadStarterColors, saveProduct, saveSettings } from "@/app/actions";
import { loadProducts, loadSettings, schemaReady } from "@/lib/data";
import { MARKET_LABEL, productLabel } from "@/lib/inventory";
import { cop } from "@/lib/format";
import { ProductForm } from "@/components/product-form";
import { SetupNotice, Swatch } from "@/components/ui";

export default async function ProductsPage() {
  if (!(await schemaReady())) return <SetupNotice />;
  const [all, settings] = await Promise.all([loadProducts(true), loadSettings()]);
  const active = all.filter((p) => p.active);
  const archived = all.filter((p) => !p.active);
  const target = active.filter((p) => !p.on_demand).reduce((a, p) => a + p.target, 0);
  const brands = [...new Set(all.map((p) => p.brand).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      <datalist id="materials">{["PLA", "PLA+", "PLA seda", "PLA mate", "PLA alta velocidad", "PETG", "TPU", "ABS", "Estándar", "Lavable en agua", "ABS-like"].map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">Productos</h1>
        <span className="text-sm text-zinc-500">{active.length} activos · meta total {target}</span>
        {all.length === 0 && <form action={loadStarterColors} className="ml-auto"><button className="btn-ghost" type="submit">Cargar 16 colores base de PLA</button></form>}
      </div>

      <details className="card" open={all.length === 0}>
        <summary className="cursor-pointer text-sm font-medium text-brand">Agregar producto</summary>
        <div className="mt-3"><ProductForm action={saveProduct.bind(null, null)} submitLabel="Agregar" /></div>
      </details>

      <div className="card divide-y divide-zinc-100 p-0">
        {active.map((p) => (
          <details key={p.id} className="px-4 py-2">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
              <Swatch hex={p.hex} size={24} />
              <span className="font-medium">{productLabel(p)}</span>
              <span className="text-xs text-zinc-500">
                meta {p.on_demand ? "a pedido" : p.target} · mercado {MARKET_LABEL[p.market].toLowerCase()} · costo {cop(p.cost)} · precio {cop(p.default_price)}
              </span>
              <span className="ml-auto text-xs text-brand">Editar</span>
            </summary>
            <div className="space-y-2 py-3">
              <ProductForm action={saveProduct.bind(null, p.id)} product={p} submitLabel="Guardar" />
              <form action={archiveProduct.bind(null, p.id, false)}>
                <button className="text-xs text-zinc-400 hover:text-red-600" type="submit">Archivar (deja de aparecer; sus ventas se conservan)</button>
              </form>
            </div>
          </details>
        ))}
        {active.length === 0 && <p className="p-4 text-sm text-zinc-500">Todavía no hay productos.</p>}
      </div>

      {archived.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium">Archivados ({archived.length})</summary>
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {archived.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Swatch hex={p.hex} size={20} />{productLabel(p)}
                <form action={archiveProduct.bind(null, p.id, true)} className="ml-auto"><button className="text-xs text-brand" type="submit">Reactivar</button></form>
              </li>
            ))}
          </ul>
        </details>
      )}

      <form id="proveedor" action={saveSettings} className="card grid grid-cols-2 gap-3 sm:grid-cols-3">
        <h2 className="h2 col-span-2 sm:col-span-3">Proveedor y reglas del pedido</h2>
        <div><label className="label">Proveedor</label><input className="input" name="supplier_name" defaultValue={settings.supplier_name ?? ""} /></div>
        <div><label className="label">WhatsApp del proveedor</label><input className="input" name="supplier_whatsapp" inputMode="tel" defaultValue={settings.supplier_whatsapp ?? ""} placeholder="300 123 4567" /></div>
        <div><label className="label">Días que tarda en llegar</label><input className="input" name="lead_days" type="number" min={0} defaultValue={settings.lead_days} /></div>
        <div><label className="label">Días de margen</label><input className="input" name="safety_days" type="number" min={0} defaultValue={settings.safety_days} /></div>
        <div><label className="label">Pedido mínimo (unidades)</label><input className="input" name="min_order" type="number" min={0} defaultValue={settings.min_order} /></div>
        <div><label className="label">Meses que debe cubrir el pedido</label><input className="input" name="coverage_months" type="number" min={0.5} step={0.5} defaultValue={settings.coverage_months} /></div>
        <div className="col-span-2 flex justify-end sm:col-span-3"><button className="btn" type="submit">Guardar</button></div>
      </form>
    </div>
  );
}
