import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    // Un fallo aquí deja la página sin cargar; mejor seguir y que la página muestre el error.
    console.error("middleware", error);
    return NextResponse.next({ request });
  }
}

export const config = {
  // Node.js en vez de Edge: en Edge, Vercel cortaba el middleware con MIDDLEWARE_INVOCATION_FAILED.
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
