# Backend Web Push Winess Hub

Backend Node.js/Express chargé d'enregistrer les abonnements PWA et d'envoyer les notifications Web Push avec anti-doublon.

## Développement local

```bash
cd backend
npm ci
cp .env.example .env
npm run vapid
npm test
npm start
```

Commande officielle équivalente : `npx web-push generate-vapid-keys`.

Le serveur écoute `PORT` et expose :

- `GET /health`
- `POST /subscribe`
- `POST /notify`

Ne jamais committer `.env`, la clé Supabase secrète ou la clé VAPID privée.

## Variables d'environnement

```text
SUPABASE_URL=https://xzcshuoelidzdlihnwme.supabase.co
SUPABASE_SERVICE_ROLE_KEY=clé_secret_ou_service_role
VAPID_PUBLIC_KEY=clé_publique
VAPID_PRIVATE_KEY=clé_privée
VAPID_SUBJECT=mailto:contact@winess.fr
CORS_ORIGIN=https://steven77726.github.io,http://127.0.0.1:4177,http://localhost:4177
PORT=8787
```

`PORT` est fourni automatiquement par Render/Railway. La clé publique VAPID doit être identique à `VAPID_PUBLIC_KEY` dans `app.js`.

## Déploiement Render

1. Connecter le dépôt GitHub `Steven77726/WINESS-HUB` à Render.
2. Créer un Blueprint depuis le fichier `render.yaml` à la racine.
3. Renseigner les quatre variables marquées `sync: false` dans Render.
4. Attendre que `https://<service>.onrender.com/health` retourne `{"ok":true}`.
5. Copier l'URL publique sans slash final dans `PUSH_API_BASE` dans `app.js`.

Le Blueprint utilise `backend` comme `rootDir`, `npm ci`, `npm start` et `/health` comme health check.

## Déploiement Railway

1. Créer un projet Railway depuis le même dépôt GitHub.
2. Railway lira `railway.json` à la racine.
3. Ajouter les variables listées ci-dessus dans l'onglet Variables.
4. Générer un domaine public Railway.
5. Vérifier `https://<domaine-railway>/health` puis copier le domaine dans `PUSH_API_BASE`.

## Branchement frontend

Dans `app.js`, remplacer la chaîne vide de production :

```js
const PUSH_API_BASE = ["127.0.0.1", "localhost"].includes(location.hostname)
  ? "http://127.0.0.1:8787"
  : "https://winess-hub-push.onrender.com";
```

Utiliser l'URL réellement attribuée par Render ou Railway.

## Test iPhone

1. Ouvrir Winess Hub dans Safari sur iPhone.
2. Partager > Ajouter à l'écran d'accueil.
3. Ouvrir la PWA installée et choisir le bon profil dans `Mes tâches`.
4. Appuyer sur `Activer les notifications iPhone` et accepter.
5. Depuis un autre appareil, attribuer une tâche à ce profil.
6. Verrouiller l'iPhone et vérifier la réception.
7. Passer la tâche en `Pris en charge`, puis `Terminé`, et vérifier les notifications envoyées au créateur.

## Synchronisation Supabase

Le fichier `supabase-schema.sql` crée les tables et index nécessaires. Le backend utilise exclusivement la clé secrète côté serveur et contourne les règles RLS pour gérer les abonnements push.
