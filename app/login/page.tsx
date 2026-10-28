import { signIn } from "@/app/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={signIn} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="h1">Fillaments by Bubblab</h1>
          <p className="text-sm text-zinc-500">Entra con el mismo usuario de Bubblab Intelligence.</p>
        </div>
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        {error && <p className="text-sm text-red-600">Correo o contraseña incorrectos.</p>}
        <button className="btn w-full" type="submit">Entrar</button>
      </form>
    </main>
  );
}
