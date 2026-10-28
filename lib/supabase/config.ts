// Valores públicos del proyecto Supabase (la clave publishable es pública por diseño).
// Las variables de entorno solo se usan si tienen el formato correcto, para que un
// valor mal pegado en Vercel no tumbe la app.
const DEFAULT_URL = "https://nbvdvaumgoldeioqhalu.supabase.co";
const DEFAULT_KEY = "sb_publishable__OXmqngmGE6SH-rSRehqpg_P8B2jpvZ";

function validUrl(v: string | undefined) {
  const s = v?.trim().replace(/\/+$/, "");
  return s && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(s) ? s : undefined;
}

function validKey(v: string | undefined) {
  const s = v?.trim();
  return s && /^(sb_publishable_|eyJ)[A-Za-z0-9._-]+$/.test(s) ? s : undefined;
}

export const SUPABASE_URL = validUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? DEFAULT_URL;
export const SUPABASE_KEY =
  validKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
  validKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
  DEFAULT_KEY;
