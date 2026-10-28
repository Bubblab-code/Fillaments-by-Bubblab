import { LEVEL_LABEL, type StockLevel } from "@/lib/inventory";

/** Rollo de filamento: anillo de color con el hueco del carrete. */
export function Swatch({ hex, size = 28 }: { hex: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full ring-1 ring-zinc-300"
      style={{ width: size, height: size, background: `radial-gradient(circle, #fff 0 24%, #d4d4d8 25% 30%, ${hex} 31% 100%)` }}
    />
  );
}

const LEVEL_TONE: Record<StockLevel, string> = {
  agotado: "bg-red-100 text-red-700",
  "pide-ya": "bg-red-100 text-red-700",
  "muy-bajo": "bg-orange-100 text-orange-800",
  bajo: "bg-amber-100 text-amber-800",
  bien: "bg-emerald-100 text-emerald-800",
  "a-pedido": "bg-zinc-100 text-zinc-600",
};

export function LevelBadge({ level }: { level: StockLevel }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_TONE[level]}`}>{LEVEL_LABEL[level]}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function SetupNotice() {
  return (
    <div className="card space-y-2 border-amber-300 bg-amber-50 text-sm text-amber-900">
      <p className="font-semibold">Falta un paso en la base de datos</p>
      <p>
        En Supabase → SQL Editor, pega el archivo <code>supabase/migrations/0001_inventario.sql</code> de este repositorio y dale Run. Es el mismo
        proyecto de Bubblab Intelligence; solo agrega tablas nuevas que empiezan por <code>inv_</code>.
      </p>
    </div>
  );
}
