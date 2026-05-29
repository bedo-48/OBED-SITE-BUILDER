# OBED-SITE-BUILDER — Analyse & corrections

## 1. Ce qu'est le projet

Un **AI Website Builder** (type v0 / Lovable), basé sur le cours GreatStack.
L'utilisateur tape un prompt → un LLM **enrichit** le prompt puis **génère une page
HTML/Tailwind complète et autonome**. Les projets sont sauvegardés, versionnés,
prévisualisables, éditables (éditeur visuel), publiables, avec un système de **crédits**.

**Stack**
- Client : React 19 + Vite + Tailwind v4 + react-router 7 + better-auth + axios
- Serveur : Express 5 + Prisma 7 (PostgreSQL/Neon) + better-auth + SDK OpenAI → OpenRouter (`z-ai/glm-4.5-air:free`)

**État avant correction**
- Front-end : interface complète mais branchée sur des **données factices** (`dummyProjects`…). Aucun appel API réel.
- Back-end : échafaudé mais **inachevé et bugué**. Client Prisma non généré.

---

## 2. Corrections appliquées (back-end)

| Fichier | Problème | Correction |
|---|---|---|
| `lib/auth.ts` | `provider: "sqlite"` alors que la base est PostgreSQL | → `"postgresql"` |
| `middlewares/auth.ts` | `auth.api.getSesson` (faute) | → `getSession` |
| `server.ts` | `express.json()` monté **avant** le handler better-auth (casse l'auth) ; `cors`/`json` en double | Handler `toNodeHandler(auth)` avant `express.json` ; doublons supprimés |
| `controllers/userController.ts` | `await.prisma…` (point mal placé) | `await prisma…` |
| | `current_version_index: version.id` utilisait l'import `version` de `node:os` | Capture de la `Version` créée et usage de son `id` |
| | imports parasites (`node:os`, `node:console`) | supprimés |
| | **deux fonctions** `getUserProject` | la 2ᵉ renommée `getUserProjects` (+ `updateAt`→`updatedAt`) |
| | `include` : `conversations` (mauvais nom), `timeStamp`, `versions` dupliqué | → `conversation` / `timestamp`, doublon retiré |
| | `togglePublish` appelée par les routes mais **absente** | implémentée |
| | `purchaseCredits` **vide** | implémentée (plans + transaction + crédits) |
| `controllers/projectControlller.ts` | `const user` déclaré 2×, `prisma` non importé, `makeRevision` ne révisait rien | réécrit : vraie révision + `rollbackVersion`, `getPublishedProjects`, `getPublishedProject` |
| `routes/projectRoutes.ts` | **fichier vide** → le serveur crashait à l'import | routes créées (révision, rollback, projets publiés) |
| `routes/userRoute.ts` | import inutilisé `node:http` | nettoyé |
| `components/EditorPanel.tsx` | le champ *Font Size* écrivait dans `margin` | corrigé en `fontSize` |

### Endpoints disponibles après correction
```
GET  /api/user/credits                         (protégé)
POST /api/user/project                          (protégé)  body: { initial_prompt }
GET  /api/user/project/:projectId               (protégé)
GET  /api/user/projects                          (protégé)
GET  /api/user/publish-toggle/:projectId         (protégé)
POST /api/user/purchase-credits                  (protégé)  body: { planId }
POST /api/project/:projectId/revision            (protégé)  body: { message }
POST /api/project/:projectId/rollback/:versionId (protégé)
GET  /api/project/published                       (public)
GET  /api/project/published/:projectId            (public)
```

---

## 3. Pourquoi je n'ai pas pu le lancer ici

Le bac à sable Linux ne peut pas démarrer le serveur, pour deux raisons **d'environnement** (pas de bug dans ton code) :
1. Les `node_modules` ont été installés sous **Windows** → binaires natifs (`esbuild win32`, moteurs Prisma) incompatibles avec Linux.
2. Le CDN de Prisma (`binaries.prisma.sh`) est **bloqué** dans le sandbox → impossible de générer le client Prisma.

Le type-check confirme que le code réécrit est sain : les seules erreurs restantes sont la résolution des types `better-auth` sous `nodenext` (qui passe quand même via `tsx`) et le client Prisma pas encore généré.

### Pour lancer chez toi (Windows)
```bash
# 1. Back-end
cd server
npm install
npx prisma generate
npx prisma migrate deploy      # ou: npx prisma db push
npm run server                 # nodemon + tsx → http://localhost:3000

# 2. Front-end (autre terminal)
cd client
npm install
npm run dev
```
Vérifie que `server/.env` contient bien : `DATABASE_URL`, `BETTER_AUTH_URL`,
`BETTER_AUTH_SECRET`, `TRUSTED_ORIGINS`, `AI_API_KEY`, `NODE_ENV` — et que
`client/.env` contient `VITE_BETTER_AUTH_URL` (+ une `VITE_API_URL` à ajouter, voir §5).

---

## 4. Recommandations d'amélioration

**Sécurité**
- `purchaseCredits` crédite immédiatement (`isPaid: true`) sans paiement réel. Avant prod : intégrer Stripe/Razorpay et ne créditer **qu'après** vérification par webhook.
- Valider/segmenter les entrées (longueur de `initial_prompt`, `message`) et ajouter du rate-limiting sur les routes IA (coûteuses).
- Le code HTML généré est affiché via `iframe srcDoc` ; garder `sandbox="allow-scripts"` (sans `allow-same-origin` quand c'est possible) pour limiter le XSS.

**Robustesse**
- `createUserProject` répond `projectId` **avant** la génération. Le front doit donc *poller* `GET /project/:id` jusqu'à `current_code`. Alternative plus propre : SSE/websocket pour le streaming, ou un champ `status` (`generating`/`ready`/`failed`) sur `WebsiteProject`.
- Encadrer les appels OpenRouter d'un timeout + retry, et gérer le cas `content` vide.

**Schéma / données**
- `Conversation` n'a pas d'`onDelete` cohérent partout — vérifier les `Cascade`.
- `current_version_index` est un `String` libre ; envisager une vraie relation FK vers `Version`.
- Ajouter des `@@index` sur `WebsiteProject.userId` et `WebsiteProject.isPublished`.

**Front-end (TODO majeur — voir §5)**
- Toutes les pages utilisent encore des données factices. `Projects.tsx`, `MyProjects.tsx`, `Community.tsx`, `View.tsx`, `Preview.tsx`, `Sidebar.tsx` doivent appeler l'API.
- `Settings.tsx` est **vide**.
- `types/index.ts` est dupliqué entre `client/src/types` et `client/src/assets` — n'en garder qu'un.

**DX**
- Renommer le fichier `projectControlller.ts` → `projectController.ts` (et l'import dans les routes).
- Activer `npm run lint` côté client et corriger les warnings react-hooks (effets sans dépendances correctes).

---

## 5. Prochaine étape proposée : brancher le front sur l'API

Plan suggéré (scope « front » que tu pourras lancer ensuite) :
1. Créer `client/src/lib/api.ts` : instance axios `baseURL = import.meta.env.VITE_API_URL` + `withCredentials: true`.
2. Remplacer les `dummy*` dans chaque page par les appels réels (`/api/user/...`, `/api/project/...`).
3. Brancher la création (Home), le polling de génération (Projects), les révisions et le rollback (Sidebar), publish/unpublish, la communauté et la vue publique.
4. Câbler `getUserCredits` dans la Navbar et la page Pricing → `purchase-credits`.

Dis-moi si on enchaîne sur cette partie.

---

## 6. Phase 2 — Front-end branché sur l'API (fait)

Toutes les pages utilisent désormais l'API réelle au lieu des `dummy*`.

**Nouveau / modifié côté client**
- `lib/api.ts` : instance axios (`baseURL` = `VITE_API_URL`, `withCredentials: true`).
- `Home.tsx` : création de projet (`POST /api/user/project`) + redirection, garde d'auth.
- `MyProjects.tsx` : liste (`GET /projects`) + suppression (`DELETE`).
- `Community.tsx` : projets publiés (`GET /api/project/published`).
- `Pricing.tsx` : achat de crédits (`POST /purchase-credits`).
- `Projects.tsx` : fetch projet + **polling** pendant la génération, save, publish/unpublish.
- `Sidebar.tsx` : révisions (`POST /:id/revision`) et rollback (`POST /:id/rollback/:versionId`) ; reçoit `setProject`.
- `Preview.tsx` : aperçu propriétaire (par version) ; `View.tsx` : vue publique.
- `Navbar.tsx` : état connecté (better-auth) + affichage des crédits + déconnexion.

**Nouveaux endpoints back-end ajoutés**
- `POST /api/user/project/:projectId/save` (sauvegarde du code édité → nouvelle version)
- `DELETE /api/user/project/:projectId` (suppression, cascade)
- Plans de crédits alignés sur l'UI : `basic` 100/$5, `pro` 400/$19, `enterprise` 1000/$49 ; coût création/révision = 5.

**Variables d'environnement** : voir `client/.env.example` et `server/.env.example`.
Côté client il faut **`VITE_BETTER_AUTH_URL`** et **`VITE_API_URL`** (le `.env` actuel est vide).

**Vérification** : impossible de lancer `tsc`/`vite build` dans le sandbox (les `node_modules`
sont des binaires Windows et le mount Linux sert une copie en retard des fichiers — d'où de
fausses erreurs JSX). Les fichiers sources sont corrects. À valider chez toi :
```bash
cd client && npm install && npm run build   # tsc -b && vite build
```

**Reste à faire (optionnel)** : page `Settings.tsx` (vide), dédup du type dans `assets/`,
renommage `projectControlller.ts` → `projectController.ts`, et le vrai paiement Stripe.

---

## 7. Phase 3 — Settings, nettoyage et Stripe (fait)

**Page Settings** (`/settings`, lien dans la Navbar quand connecté) : profil (nom modifiable,
email en lecture seule), crédits & usage, changement de mot de passe (better-auth),
déconnexion et suppression de compte.
Endpoints back-end ajoutés : `GET /api/user/me`, `POST /api/user/update-profile`,
`DELETE /api/user/account`.

**Nettoyage** : `projectControlller.ts` → `projectController.ts` (import mis à jour, ancien
fichier supprimé) ; type `Project` dupliqué (`client/src/assets/index.ts`) supprimé.

**Paiement Stripe (réel)** : `purchaseCredits` crée désormais une **session Stripe Checkout**
(transaction en attente), et les crédits ne sont accordés qu'après confirmation par le
**webhook** `POST /api/stripe/webhook` (vérification de signature + idempotence).
- Nouveaux fichiers : `configs/stripe.ts`, `controllers/stripeController.ts`.
- `server.ts` : route webhook montée avec `express.raw` **avant** `express.json`.
- `Pricing.tsx` redirige vers l'URL Stripe ; `Settings.tsx` affiche un message au retour
  (`?payment=success`).

### Mise en route de Stripe
1. Installer la dépendance : `cd server ; npm install`
2. Renseigner dans `server/.env` :
   ```
   CLIENT_URL=http://localhost:5173
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
3. En local, écouter les webhooks avec la **Stripe CLI** (fournit le `whsec_...`) :
   ```
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Tester avec la carte `4242 4242 4242 4242` (date future, CVC quelconque).
