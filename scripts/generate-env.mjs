import { writeFileSync } from 'node:fs';

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_ANON_KEY'];

if (!url || !key) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set.');
  process.exit(1);
}

const content = `export const environment = {
  production: true,
  supabaseUrl: '${url}',
  supabaseAnonKey: '${key}',
};
`;

// Angular fileReplacements needs environment.ts to exist as the "source" file.
// In production builds it is replaced by environment.prod.ts — both get prod values.
writeFileSync('src/environments/environment.ts', content);
writeFileSync('src/environments/environment.prod.ts', content);
console.log('environment.ts and environment.prod.ts generated.');
