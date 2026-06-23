# Backend notifications Winess Hub

## Synchronisation Supabase

1. Ouvrir Supabase > SQL Editor.
2. Coller et exécuter `supabase-schema.sql`.
3. Recharger Winess Hub : l'indicateur doit afficher `Temps réel`.

Les tables `hub_tasks` et `hub_activity` sont accessibles en mode pilote avec la clé publique. Ajouter Supabase Auth et remplacer les politiques `pilot_*` avant de stocker des données clients sensibles.

## Notifications push

1. `npm install`
2. Copier `.env.example` vers `.env`
3. `npm run vapid`
4. Copier les clés dans `.env`
5. Exécuter `supabase-schema.sql` dans Supabase
6. `npm start`

La clé VAPID privée reste uniquement dans le backend.
