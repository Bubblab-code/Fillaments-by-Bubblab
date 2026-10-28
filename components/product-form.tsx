import type { Product } from "@/lib/types";

export function ProductForm({ action, product, submitLabel }: { action: (fd: FormData) => Promise<void>; product?: Product; submitLabel: string }) {
  const p = product;
  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div>
        <label className="label">Tipo</label>
        <select className="input" name="kind" defaultValue={p?.kind ?? "filamento"}>
          <option value="filamento">Filamento (rollo 1 kg)</option>
          <option value="resina">Resina (litro)</option>
        </select>
      </div>
      <div>
        <label className="label">Material</label>
        <input className="input" name="material" list="materials" defaultValue={p?.material ?? "PLA"} />
      </div>
      <div>
        <label className="label">Marca</label>
        <input className="input" name="brand" list="brands" defaultValue={p?.brand ?? ""} placeholder="Sunlu, Creality…" />
      </div>
      <div>
        <label className="label">Color *</label>
        <div className="flex gap-2">
          <input className="h-9 w-10 shrink-0 rounded border border-zinc-300 p-0.5" type="color" name="hex" defaultValue={p?.hex ?? "#888888"} aria-label="Tono" />
          <input className="input" name="color" required defaultValue={p?.color ?? ""} />
        </div>
      </div>
      <div>
        <label className="label">Meta (cuántos tener)</label>
        <input className="input" name="target" type="number" min={0} inputMode="numeric" defaultValue={p?.target ?? 20} />
      </div>
      <div>
        <label className="label">Demanda en el mercado</label>
        <select className="input" name="market" defaultValue={p?.market ?? "media"}>
          <option value="alta">Alta (negro, blanco)</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
      </div>
      <div>
        <label className="label">Costo de compra (COP)</label>
        <input className="input" name="cost" inputMode="numeric" defaultValue={p?.cost ?? ""} placeholder="Para la ganancia" />
      </div>
      <div>
        <label className="label">Precio de venta usual (COP)</label>
        <input className="input" name="default_price" inputMode="numeric" defaultValue={p?.default_price ?? ""} placeholder="Se sugiere al vender" />
      </div>
      {!p && (
        <div>
          <label className="label">Hay ahora</label>
          <input className="input" name="stock" type="number" min={0} inputMode="numeric" defaultValue={0} />
        </div>
      )}
      <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="on_demand" defaultChecked={p?.on_demand ?? false} /> Solo a pedido (no se repone solo)
      </label>
      <div className="col-span-2 flex items-end justify-end sm:col-span-1 sm:col-start-4"><button className="btn w-full" type="submit">{submitLabel}</button></div>
    </form>
  );
}
