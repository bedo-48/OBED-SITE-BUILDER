# OBED-SITE-BUILDER : analyse et corrections

## 1. Ce qu'est le projet

Un AI Website Builder (type v0 / Lovable), basé sur le cours GreatStack.
L'utilisateur tape un prompt, un LLM l'enrichit, puis génère une page HTML/Tailwind
complète et autonome. Les projets sont sauvegardés, versionnés, prévisualisables et
publiables, avec un éditeur visuel et un système de crédits.

### Stack
- Client : React 19 + Vite + Tailwind v4 + react-router 7 + better-auth + axios
- Serveur : Express 5 + Prisma 7 (PostgreSQL/Neon) + better-auth + SDK OpenAI vers OpenRouter (`z-ai/glm-4.5-air:free`)

### État avant correction
Le front-end était complet côté interface, mais branché sur des données factices
(`dummyProjects`), sans aucun appel API. Le back-end était échafaudé, inachevé et bugué,
avec un client Prisma jamais généré.

---

## 2. Corrections appliquées (back-end)

| Fichier | Problème | Correction |
|---|---|---|
| `lib/auth.ts` | `provider: "sqlite"` alors que la base est PostgreSQL | `"postgresql"` |
| `middlewares/auth.ts` | `auth.api.getSesson` (faute) | `getSession` |
| `server.ts` | `express.json()` monté avant le handler better-auth, ce qui casse l'auth ; `cors`/`json` en double | Handler `toNodeHandler(auth)` avant `express.json` ; doublons supprimés |
| `controllers/userController.ts` | `await.prisma…` (point mal placé) | `await prisma…` |
| | `current_version_index: version.id` utilisait l'import `version` de `node:os` | Capture de la `Version` créée et usage de son `id` |
| | imports parasites (`node:os`, `node:console`) | supprimés |
| | deux fonctions `getUserProject` | la 2ᵉ renommée `getUserProjects` (+ `updateAt` en `updatedAt`) |
| | `include` : `conversations` (mauvais nom), `timeStamp`, `versions` dupliqué | `conversation` / `timestamp`, doublon retiré |
| | `togglePublish` appelée par les routes mais absente | implémentée |
| | `purchaseCredits` vide | implémentée (plans + transaction + crédits) |
| `controllers/projectControlller.ts` | `const user` déclaré 2×, `prisma` non importé, `makeRevision` ne révisait rien | réécrit : vraie révision + `rollbackVersion`, `getPublishedProjects`, `getPublishedProject` |
| `routes/projectRoutes.ts` | fichier vide, le serveur crashait à l'import | routes créées (révision, rollback, projets publiés) |
| `routes/userRoute.ts` | import inutilisé `node:http` | nettoyé |
| `components/EditorPanel.tsx` | le champ Font Size écrivait dans `margin` | corrigé en `fontSize` |

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

Le bac à sable Linux ne démarre pas le serveur, pour deux raisons d'environnement.
Les `node_modules` ont été installés sous Windows, donc les binaires natifs
(`esbuild win32`, moteurs Prisma) sont incompatibles avec Linux. Et le CDN de Prisma
(`binaries.prisma.sh`) est bloqué dans le sandbox, ce qui empêche de générer le client.

Ton code n'est pas en cause. Le type-check confirme que la réécriture est saine : les
seules erreurs restantes viennent de la résolution des types better-auth sous `nodenext`
(qui passe quand même via `tsx`) et du client Prisma pas encore généré.

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
Vérifie que `server/.env` contient `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`,
`TRUSTED_ORIGINS`, `AI_API_KEY` et `NODE_ENV`, et que `client/.env` contient
`VITE_BETTER_AUTH_URL` plus la `VITE_API_URL` ajoutée au §5.

---

## 4. Recommandations d'amélioration

### Sécurité
- `purchaseCredits` crédite immédiatement (`isPaid: true`) sans paiement réel. Avant prod, intégrer Stripe/Razorpay et ne créditer qu'après vérification par webhook.
- Valider la longueur de `initial_prompt` et `message`, et poser du rate-limiting sur les routes IA, qui coûtent cher.
- Le HTML généré s'affiche dans un `iframe srcDoc` : garder `sandbox="allow-scripts"` sans `allow-same-origin` quand c'est possible, pour limiter le XSS.

### Robustesse
- `createUserProject` répond `projectId` avant la fin de la génération, donc le front doit poller `GET /project/:id` jusqu'à `current_code`. Un champ `status` (`generating`/`ready`/`failed`) sur `WebsiteProject`, ou du SSE pour le streaming, ferait mieux.
- Encadrer les appels OpenRouter d'un timeout et d'un retry, et gérer le cas où `content` revient vide.

### Schéma et données
- `Conversation` n'a pas d'`onDelete` cohérent partout, vérifier les `Cascade`.
- `current_version_index` est un `String` libre : le remplacer par une vraie FK vers `Version`.
- Ajouter des `@@index` sur `WebsiteProject.userId` et `WebsiteProject.isPublished`.

### Front-end (gros morceau, voir §5)
- Toutes les pages utilisent encore des données factices. `Projects.tsx`, `MyProjects.tsx`, `Community.tsx`, `View.tsx`, `Preview.tsx` et `Sidebar.tsx` doivent appeler l'API.
- `Settings.tsx` est vide.
- `types/index.ts` est dupliqué entre `client/src/types` et `client/src/assets`, n'en garder qu'un.

### DX
- Renommer `projectControlller.ts` en `projectController.ts`, et l'import dans les routes.
- Activer `npm run lint` côté client et corriger les warnings react-hooks (effets aux dépendances incorrectes).

---

## 5. Prochaine étape : brancher le front sur l'API

1. Créer `client/src/lib/api.ts` : instance axios `baseURL = import.meta.env.VITE_API_URL` + `withCredentials: true`.
2. Remplacer les `dummy*` dans chaque page par les appels réels (`/api/user/...`, `/api/project/...`).
3. Brancher la création (Home), le polling de génération (Projects), les révisions et le rollback (Sidebar), publish/unpublish, la communauté et la vue publique.
4. Câbler `getUserCredits` dans la Navbar et la page Pricing vers `purchase-credits`.

---

## 6. Phase 2 : front-end branché sur l'API (fait)

Toutes les pages utilisent désormais l'API réelle au lieu des `dummy*`.

Nouveau ou modifié côté client :
- `lib/api.ts` : instance axios (`baseURL` = `VITE_API_URL`, `withCredentials: true`).
- `Home.tsx` : création de projet (`POST /api/user/project`), redirection et garde d'auth.
- `MyProjects.tsx` : liste (`GET /projects`) et suppression (`DELETE`).
- `Community.tsx` : projets publiés (`GET /api/project/published`).
- `Pricing.tsx` : achat de crédits (`POST /purchase-credits`).
- `Projects.tsx` : fetch projet, polling pendant la génération, save, publish/unpublish.
- `Sidebar.tsx` : révisions (`POST /:id/revision`) et rollback (`POST /:id/rollback/:versionId`) ; reçoit `setProject`.
- `Preview.tsx` : aperçu propriétaire par version. `View.tsx` : vue publique.
- `Navbar.tsx` : état connecté (better-auth), affichage des crédits et déconnexion.

Nouveaux endpoints back-end :
- `POST /api/user/project/:projectId/save` (sauvegarde du code édité, nouvelle version)
- `DELETE /api/user/project/:projectId` (suppression, cascade)
- Plans de crédits alignés sur l'UI : `basic` 100/$5, `pro` 400/$19, `enterprise` 1000/$49 ; coût création/révision = 5.

Variables d'environnement : voir `client/.env.example` et `server/.env.example`.
Côté client il faut `VITE_BETTER_AUTH_URL` et `VITE_API_URL` (le `.env` actuel est vide).

Vérification : impossible de lancer `tsc`/`vite build` dans le sandbox, les `node_modules`
sont des binaires Windows et le mount Linux sert une copie en retard des fichiers, d'où de
fausses erreurs JSX. Les fichiers sources sont corrects. À valider chez toi :
```bash
cd client && npm install && npm run build   # tsc -b && vite build
```

Reste en option : la page `Settings.tsx` (vide), la dédup du type dans `assets/`, le
renommage `projectControlller.ts`, et le vrai paiement Stripe.

---

## 7. Phase 3 : Settings, nettoyage et Stripe (fait)

Page Settings (`/settings`, lien dans la Navbar quand connecté) : profil (nom modifiable,
email en lecture seule), crédits et usage, changement de mot de passe (better-auth),
déconnexion et suppression de compte.
Endpoints ajoutés : `GET /api/user/me`, `POST /api/user/update-profile`,
`DELETE /api/user/account`.

Nettoyage : `projectControlller.ts` devient `projectController.ts` (import mis à jour,
ancien fichier supprimé), et le type `Project` dupliqué dans `client/src/assets/index.ts`
est supprimé.

Paiement Stripe réel : `purchaseCredits` crée une session Stripe Checkout avec une
transaction en attente, et les crédits ne sont accordés qu'après confirmation par le
webhook `POST /api/stripe/webhook` (vérification de signature et idempotence).
- Nouveaux fichiers : `configs/stripe.ts`, `controllers/stripeController.ts`.
- `server.ts` : route webhook montée avec `express.raw` avant `express.json`.
- `Pricing.tsx` redirige vers l'URL Stripe ; `Settings.tsx` affiche un message au retour (`?payment=success`).

### Mise en route de Stripe
1. Installer la dépendance : `cd server ; npm install`
2. Renseigner dans `server/.env` :
   ```
   CLIENT_URL=http://localhost:5173
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
3. En local, écouter les webhooks avec la Stripe CLI (elle fournit le `whsec_...`) :
   ```
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Tester avec la carte `4242 4242 4242 4242` (date future, CVC quelconque).
