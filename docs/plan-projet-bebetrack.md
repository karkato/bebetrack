# Plan projet — « BébéTrack » : suivi bébé partagé entre deux parents

> Document à passer à Claude Code, à exécuter via l'orchestrateur multi-agents (`~/.claude/`).
> Mode d'emploi : traiter les tickets **un par un**, dans l'ordre, via `/tache "<titre du ticket>"` en fournissant la section du ticket comme contexte. Respecter les 3 checkpoints du pipeline (plan → dev → review) pour chaque ticket. Ne jamais commencer un ticket si le précédent n'est pas mergé.

---

## 1. Vision produit

Application PWA de suivi d'un nouveau-né, utilisée par **deux parents sur deux téléphones**, synchronisée en temps réel.

Fonctions :
- **Tétées** : enregistrement rapide (sein G/D ou biberon + quantité), durée, et affichage permanent de « dernière tétée il y a X ».
- **Couches** : enregistrement en 1 tap (pipi / selle / mixte).
- **Stock** : compteurs par produit (couches, lait, liniment…), décrément rapide, seuils d'alerte, décrément auto d'une couche à chaque change.
- **Rappels partagés** : créés par un parent, visibles par les deux, déclenchant une **notification push sur les deux téléphones** (ex. « vitamine D à 19h », récurrence possible).
- **Nudges** : messages prédéfinis contextuels envoyés d'un téléphone à l'autre en push (ex. « 📢 plus que 8 couches ») — **pas de chat**, pas de saisie libre.
- **Historique** : timeline du jour + rythme sur 7 jours.

Contraintes UX non négociables :
- Utilisable **d'une main, en 2 taps max, dans le noir** (dark mode par défaut, gros boutons).
- Les actions courantes (tétée, couche) ne passent par **aucun formulaire**.
- Offline-first : un enregistrement fonctionne sans réseau et se synchronise ensuite.

---

## 2. Stack technique (V1)

| Couche | Choix | Notes |
|---|---|---|
| Runtime | Node.js 26 (`.nvmrc` = `26`) | via nvm-windows |
| Front | Angular 22 (v22.0.x) | signal-first : Signal Forms, `httpResource`/`resource`, OnPush par défaut (ne PAS déclarer `changeDetection`), zoneless, control flow `@if/@for/@defer` |
| UI | Angular Material (M3) + CDK | bottom sheets, listes, dialogs, snackbars, badges. **Écran principal en CSS custom**, hors Material |
| BDD / Auth / Realtime | Supabase | RLS par foyer, Realtime pour la synchro entre téléphones |
| Push | Web Push API (VAPID) + Supabase Edge Functions | cron pour les rappels ; iOS : PWA installée requise (iOS ≥ 16.4) |
| PWA | @angular/pwa (service worker) | + service worker custom pour l'événement `push` |
| Déploiement | Vercel | preview par branche |
| V2 (hors scope) | Backend Go remplaçant Supabase | API REST + WebSockets + PostgreSQL |

**Note pour les agents (APIs récentes)** : Angular 22 est sorti le 3 juin 2026. Signal Forms (`FormField`, `SignalFormControl`…), Resource API et les défauts v22 sont récents : en cas de doute sur une API, l'Analyste consulte angular.dev via WebFetch plutôt que de supposer. Interdiction d'utiliser les Reactive Forms classiques, `NgModule`, ou Zone.js.

---

## 3. Modèle de données (Supabase / PostgreSQL)

```
households        (id, name, created_at)
household_members (household_id, user_id, role)        -- 2 parents par foyer
babies            (id, household_id, name, birth_date)

feedings          (id, baby_id, started_at, ended_at, type: 'breast_left'|'breast_right'|'bottle',
                   amount_ml nullable, created_by)
diapers           (id, baby_id, at, kind: 'wet'|'dirty'|'mixed', created_by)

stock_items       (id, household_id, label, quantity, alert_threshold,
                   auto_decrement_on_diaper boolean)
stock_movements   (id, stock_item_id, delta, reason, at, created_by)

reminders         (id, household_id, label, due_at, recurrence nullable (RRULE simplifiée),
                   done_at nullable, created_by)
nudges            (id, household_id, template_key, payload jsonb, sent_by, sent_at)
push_subscriptions(id, user_id, household_id, endpoint, keys jsonb, created_at)
```

Règles :
- **RLS sur toutes les tables** : accès uniquement aux lignes de son foyer.
- Toute écriture passe par des événements horodatés (`created_by` systématique) — base de l'offline et de la timeline.
- Le stock courant = somme des `stock_movements` (ou colonne `quantity` maintenue par trigger — décision à l'Analyste au ticket 2).

---

## 4. Bootstrap `CLAUDE.md` projet (à générer au ticket 1)

Contenu minimal :
- Stack du §2 + patterns v22 imposés (signals partout, Signal Forms, pas de `changeDetection` explicite, standalone only).
- Conventions : Conventional Commits en anglais, branches `feat/<n°ticket>-<slug>`, tests unitaires Vitest, une story de test par comportement utilisateur.
- Commandes : `nvm use`, `npm start`, `npm test`, `npm run lint`, `npm run build`.
- Rappel des 3 checkpoints de l'orchestrateur et de la règle « aucune écriture avant plan validé ».
- Contrainte UX : « toute nouvelle action courante doit rester ≤ 2 taps ».

---

## 5. Tickets

### Phase A — MVP utilisable (tickets 1 à 8)

**Ticket 1 — Bootstrap du projet**
Créer le projet Angular 22 (standalone, zoneless par défaut) avec : `.nvmrc` (26), Angular Material M3 (thème dark par défaut, palette douce lisible la nuit), ESLint + Prettier, Vitest, `@angular/pwa`, client Supabase configuré par variables d'environnement, déploiement Vercel branché, `CLAUDE.md` projet (§4).
✅ Critères : `npm start` fonctionne ; page d'accueil vide thémée M3 dark ; CI Vercel verte ; `CLAUDE.md` présent.

**Ticket 2 — Modèle de données + RLS**
Créer le schéma du §3 dans Supabase (migrations SQL versionnées dans le repo), RLS par foyer, seed de dev (1 foyer, 2 utilisateurs, 1 bébé, 3 stock_items).
✅ Critères : un utilisateur du foyer A ne peut lire/écrire aucune ligne du foyer B (tests SQL ou script de vérification) ; migrations rejouables.

**Ticket 3 — Auth + foyer**
Login Supabase (magic link email), création de foyer au premier login, invitation du second parent (lien d'invitation), garde de routes.
✅ Critères : deux comptes rejoignent le même foyer ; un compte sans foyer est redirigé vers l'onboarding.

**Ticket 4 — Écran principal custom**
L'écran d'accueil, en CSS maison (hors Material) : bandeau « dernière tétée il y a X (sein droit) » mis à jour à la minute (signal + interval), 3 gros boutons pleine largeur couche (pipi / selle / mixte) → enregistrement en 1 tap + snackbar d'annulation (undo 5 s), bouton « tétée » proéminent.
✅ Critères : enregistrer une couche = 1 tap ; annulation possible ; lisible en dark à luminosité minimale ; aucune navigation nécessaire.

**Ticket 5 — Flux tétée**
Bottom sheet Material : démarrer/arrêter un chrono, choix sein G/D (mémorise le dernier côté et propose l'autre), ou biberon avec quantité via **Signal Forms**. Tétée en cours persistée (survit à un refresh).
✅ Critères : démarrer une tétée = 2 taps ; le bandeau « dernière tétée » se met à jour ; une tétée en cours est visible et arrêtable.

**Ticket 6 — Synchro temps réel**
Supabase Realtime sur `feedings`, `diapers`, `stock_movements`, `reminders` : toute écriture d'un téléphone apparaît sur l'autre sans refresh.
✅ Critères : test avec deux navigateurs côte à côte — latence perçue < 2 s ; reconnexion propre après coupure réseau.

**Ticket 7 — Stock**
Liste Material des produits : quantité, badge d'alerte sous le seuil, boutons +/- (avec undo), décrément auto d'une couche à chaque change si `auto_decrement_on_diaper`. Ajout/édition de produit via dialog.
✅ Critères : enregistrer un change décrémente le stock de couches ; badge visible dès le seuil atteint.

**Ticket 8 — Timeline + rythme**
Vue « journée » (événements chronologiques mêlés : tétées, couches) + vue « 7 jours » (nombre de tétées/jour, intervalle moyen). Utiliser `resource`/`httpResource` pour le chargement.
✅ Critères : la timeline du jour reflète le temps réel ; les stats 7 jours sont correctes sur le seed.

> 🎯 **Fin de phase A : l'app est utilisable au quotidien.** La mettre sur les deux téléphones (via Vercel) et l'utiliser quelques jours avant la phase B — les frictions réelles alimenteront les tickets suivants.

### Phase B — Push, rappels partagés, nudges (tickets 9 à 12)

**Ticket 9 — PWA installable**
Manifest complet (icônes, nom, thème), service worker Angular, écran d'onboarding « installer l'app » avec instructions par OS (iOS : partage → Sur l'écran d'accueil ; Android : bannière d'installation).
✅ Critères : installable sur iOS et Android ; démarre en plein écran ; l'app shell se charge hors ligne.

**Ticket 10 — Infrastructure push**
Génération des clés VAPID, service worker custom gérant l'événement `push` (fusionné avec le SW Angular), demande de permission au bon moment (après installation, pas au premier chargement), enregistrement des subscriptions dans `push_subscriptions`, Edge Function `send-push` (envoi Web Push à toutes les subscriptions d'un foyer), bouton de test « m'envoyer une notification ».
✅ Critères : notification de test reçue sur Android (navigateur + PWA) et sur iOS (PWA installée) ; subscription supprimée si l'endpoint est expiré.

**Ticket 11 — Rappels partagés**
CRUD des rappels (Signal Forms), récurrence simple (quotidien / toutes les X heures / date unique), Edge Function planifiée (cron chaque minute) qui trouve les rappels échus et appelle `send-push` pour **tout le foyer**, marquage « fait » synchronisé (le parent qui traite le rappel le clôt pour les deux).
✅ Critères : un rappel créé sur le téléphone A sonne sur A **et** B ; « fait » sur B le clôt sur A ; la récurrence regénère l'échéance suivante.

**Ticket 12 — Nudges**
Boutons contextuels : depuis un produit en stock (« 📢 Prévenir : plus que N x »), depuis l'accueil (« 🍼 Peux-tu préparer un biberon ? » et 2-3 templates utiles). Envoi push à l'autre parent uniquement (pas à soi-même), historique des nudges du jour dans la timeline.
✅ Critères : nudge stock reçu sur l'autre téléphone avec la quantité réelle ; aucun champ de saisie libre.

### Phase C — Offline-first (ticket 13, à découper par l'Analyste)

**Ticket 13 — File d'événements offline**
Écritures locales dans IndexedDB quand le réseau est absent, file de synchronisation rejouée au retour du réseau, indicateur discret « en attente de synchro », stratégie de résolution simple (les événements horodatés ne se contredisent pas ; last-write-wins sur les entités éditables).
✅ Critères : mode avion → enregistrer 2 couches et 1 tétée → retour réseau → tout apparaît sur l'autre téléphone dans le bon ordre.
📌 Instruction à l'Analyste : produire d'abord un plan de découpage de ce ticket en 3-4 sous-tickets avant tout développement.

---

## 6. Hors scope V1 (ne pas implémenter, ne pas préparer « au cas où »)

- Backend Go (V2 : réécriture de la couche Supabase — API REST + WebSockets + PostgreSQL — une fois la V1 stable et utilisée).
- Courbes de poids/taille, sommeil, multi-bébés, export PDF, partage au-delà de 2 parents, chat.

## 7. Rappels pour l'orchestrateur

- Un ticket = un cycle complet du pipeline (Analyste → Anti-dup → ✋ → Développeur → Anti-dup → ✋ → Reviewer → ✋ → PR).
- L'agent Formateur produit sa note Logseq à chaque ticket ; sujets attendus notamment : Signal Forms vs Reactive Forms (ticket 5), Realtime et RLS (tickets 2/6), Web Push de bout en bout (ticket 10), offline-first (ticket 13).
- L'Anti-duplication doit être particulièrement vigilant sur : les composants « gros bouton », la logique d'undo (snackbar), et les appels Supabase (un service par table, pas de requêtes dispersées dans les composants).
- En cas d'API Angular 22 incertaine : vérifier sur angular.dev avant d'écrire le plan, ne jamais improviser une API.
