import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/brand"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const path = request.nextUrl.pathname;
  // Archivos públicos: el logo de la pantalla de entrada.
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return response;
  const isLogin = path.startsWith("/login");
  let user = null;
  try {
    const { data } = await withTimeout(supabase.auth.getUser(), 5000);
    user = data.user;
  } catch (error) {
    // Si Supabase no responde, no tumbar la app: se trata como sesión cerrada.
    console.error("updateSession", error);
  }
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

// Si Supabase tarda, no dejar la página colgada: se trata como sesión cerrada.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Supabase tardó más de ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
