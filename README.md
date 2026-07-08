# Bebetrack

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Database

BébéTrack uses Supabase (PostgreSQL + RLS) hosted in the cloud. No local Docker setup required.

### Apply migrations

Migrations are versioned SQL files in `supabase/migrations/`. Apply them **in order** via the [Supabase SQL Editor](https://app.supabase.com/project/_/sql):

1. `20260708000001_extensions_and_helpers.sql`
2. `20260708000002_households.sql`
3. `20260708000003_feedings_and_diapers.sql`
4. `20260708000004_stock.sql`
5. `20260708000005_reminders_and_nudges.sql`

### Seed dev data

1. Create two test users in **Supabase Auth dashboard** (Authentication > Users)
2. Copy their UUIDs into `supabase/seed.sql` (replace the placeholder UUIDs)
3. Run `supabase/seed.sql` in the SQL Editor

### Test RLS isolation

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... \
USER_A_EMAIL=... USER_A_PASSWORD=... \
USER_B_EMAIL=... USER_B_PASSWORD=... \
npm run test:rls
```

Verifies that a user from household B cannot read or write data from household A.
