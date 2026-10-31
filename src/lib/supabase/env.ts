export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL (veja o SETUP.md).");
  return value;
}

export function supabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw new Error("Configure NEXT_PUBLIC_SUPABASE_ANON_KEY (veja o SETUP.md).");
  return value;
}

export function supabaseServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY (veja o SETUP.md).");
  return value;
}
