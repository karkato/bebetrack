# BébéTrack — CLAUDE.md projet

## Stack & paradigmes

- **Runtime** : Node.js 26 — toujours faire `nvm use` avant de démarrer
- **Framework** : Angular 22, standalone uniquement (aucun NgModule)
- **State** : signals partout (`signal()`, `computed()`, `effect()`) — pas de BehaviorSubject côté UI
- **Forms** : Signal Forms (`FormField`, `SignalFormControl`) — pas de Reactive Forms classiques
- **Data fetching** : `resource()` / `httpResource()` — pas de pipe `async`
- **Change detection** : zoneless — ne pas déclarer `changeDetection` explicitement dans les composants (Angular 22 gère par défaut)
- **Control flow** : `@if`, `@for`, `@defer` uniquement — jamais `*ngIf`, `*ngFor`
- **UI** : Angular Material M3, dark par défaut — l'écran principal est en CSS custom (hors Material)
- **Backend** : Supabase (auth, RLS par foyer, Realtime)
- **Tests** : Vitest, une story par comportement utilisateur
- **PWA** : @angular/service-worker

## Conventions de code

- Composants standalone, `OnPush` implicite (pas de déclaration explicite)
- `inject()` function obligatoire — pas de constructeur DI
- Interfaces pour les modèles de données, pas de `any`
- Nommage fichiers : `kebab-case.component.ts`

## Variables d'environnement

`environment.ts` est **gitignorée**. Pour configurer Supabase en local :
1. `cp src/environments/environment.ts.example src/environments/environment.ts`
2. Renseigner `supabaseUrl` et `supabaseAnonKey` (clé anon publique depuis Supabase Dashboard)

En production (Vercel) : injecter `SUPABASE_URL` et `SUPABASE_ANON_KEY` comme variables d'environnement
et générer `environment.prod.ts` dans le build script avant `ng build`.

## Conventions Git

- **Commits** : Conventional Commits en anglais (`feat:`, `fix:`, `chore:`, `docs:`, etc.)
- **Branches** : `feat/<n°ticket>-<slug>` (ex. `feat/1-bootstrap`)
- Aucun push avant review validée (3 checkpoints orchestrateur)

## Commandes

```bash
nvm use          # Activer Node 26
npm start        # Serveur de dev (http://localhost:4200)
npm test         # Tests Vitest
npm run lint     # ESLint
npm run build    # Build de production
```

## Orchestrateur multi-agents

Ce projet utilise le pipeline `/tache` avec **3 checkpoints obligatoires** :
1. **Plan validé** — aucun fichier modifié avant accord explicite
2. **Diff inspecté** — aucune review avant accord explicite
3. **Review validée** — aucun push avant accord explicite

## Contrainte UX non négociable

> Toute nouvelle action courante (tétée, couche) doit rester **≤ 2 taps**. Aucun formulaire pour les actions fréquentes.
