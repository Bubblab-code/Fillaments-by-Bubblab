import Link from "next/link";
import { signOut } from "@/app/actions";
import { currentUserEmail } from "@/lib/supabase/server";

const NAV = [
  { href: "/", label: "Inventario" },
  { href: "/vender", label: "Vender" },
  { href: "/ventas", label: "Ventas y caja" },
  { href: "/pedido", label: "Pedido" },
  { href: "/metricas", label: "Métricas" },
  { href: "/productos", label: "Productos" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const email = await currentUserEmail();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-3 sm:py-3">
          <Link href="/" className="font-semibold tracking-tight">
            Fillaments <span className="text-brand">by Bubblab</span>
          </Link>
          <form action={signOut} className="ml-auto flex items-center gap-3 text-sm text-zinc-500 sm:order-last">
            <span className="hidden sm:inline">{email}</span>
            <button className="btn-ghost py-1" type="submit">Salir</button>
          </form>
          <nav className="-mx-4 flex w-full gap-1 overflow-x-auto px-4 pb-2 text-sm sm:mx-0 sm:w-auto sm:px-0 sm:pb-0">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="shrink-0 rounded-md px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
