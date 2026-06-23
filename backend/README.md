# Backend notifications Winess Hub

## Synchronisation Supabase

1. Ouvrir Supabase > SQL Editor.
2. Coller et exécuter `supabase-schema.sql`.
3. Recharger Winess Hub : l'indicateur doit afficher `Temps réel`.

Le script crée aussi `hub_profiles`, le bucket Storage public `avatars` et leurs règles Realtime.

Les tables `hub_tasks` et `hub_activity` sont accessibles en mode pilote avec la clé publique. Ajouter Supabase Auth et remplacer les politiques `pilot_*` avant de stocker des données clients sensibles.

## Notifications push

La version de production utilise la fonction `supabase/functions/push`.

1. Configurer `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` dans Supabase > Edge Functions > Secrets.
2. Déployer avec `npx supabase functions deploy push --project-ref xzcshuoelidzdlihnwme --no-verify-jwt`.
3. Installer Winess Hub sur l'écran d'accueil de l'iPhone, puis activer les notifications depuis `Mes tâches`.

Le serveur Node ci-dessous reste disponible pour les tests locaux.

1. `npm install`
2. Copier `.env.example` vers `.env`
3. `npm run vapid`
4. Copier les clés dans `.env`
5. Exécuter `supabase-schema.sql` dans Supabase
6. `npm start`

La clé VAPID privée reste uniquement dans le backend.
