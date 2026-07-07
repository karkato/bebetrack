// Production credentials are injected at build time by CI/CD.
// For Vercel: set SUPABASE_URL and SUPABASE_ANON_KEY as environment variables,
// then generate this file in the build script before `ng build`.
// SUPABASE_ANON_KEY is the public anon key — safe to use client-side (protected by RLS).
export const environment = {
  production: true,
  supabaseUrl: '',
  supabaseAnonKey: '',
};
