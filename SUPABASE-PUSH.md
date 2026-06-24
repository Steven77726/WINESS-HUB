# Notifications Push avec Supabase Edge Functions

Winess Hub utilise uniquement Supabase Edge Functions. Aucun service Render, Railway ou serveur Node externe n'est necessaire.

## Architecture

- `subscribe-push` enregistre l'abonnement du navigateur dans `push_subscriptions`.
- `notify-push` envoie la notification au bon profil et utilise `push_notification_events` pour eviter les doublons.
- `sw.js` affiche la notification et ouvre directement la fiche concernee.

URLs de production :

- `https://xzcshuoelidzdlihnwme.supabase.co/functions/v1/subscribe-push`
- `https://xzcshuoelidzdlihnwme.supabase.co/functions/v1/notify-push`

## 1. Installer et connecter Supabase CLI

Depuis le dossier du projet :

```bash
cd "/Users/stevenohayon/Documents/New project/WHUB"
npx supabase login
npx supabase link --project-ref xzcshuoelidzdlihnwme
```

La commande `login` ouvre le navigateur. Il ne faut transmettre aucun mot de passe ni aucune cle secrete a une autre personne.

## 2. Configurer les cles VAPID

Reutiliser les cles VAPID deja configurees dans Winess Hub. Changer de paire invaliderait les abonnements push deja crees.

Si aucune paire n'existe encore :

```bash
npx web-push generate-vapid-keys
```

Ajouter les secrets aux Edge Functions :

```bash
npx supabase secrets set \
  VAPID_PUBLIC_KEY="VOTRE_CLE_PUBLIQUE" \
  VAPID_PRIVATE_KEY="VOTRE_CLE_PRIVEE" \
  VAPID_SUBJECT="mailto:contact@winess.fr" \
  --project-ref xzcshuoelidzdlihnwme
```

Verifier leur presence sans afficher leur valeur :

```bash
npx supabase secrets list --project-ref xzcshuoelidzdlihnwme
```

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` et `SUPABASE_SECRET_KEYS` sont injectes automatiquement par Supabase dans les fonctions hebergees. Ne jamais placer la cle privee VAPID ni une cle Supabase serveur dans `app.js` ou GitHub.

## 3. Deployer les fonctions

```bash
npx supabase functions deploy subscribe-push \
  --project-ref xzcshuoelidzdlihnwme \
  --no-verify-jwt \
  --use-api

npx supabase functions deploy notify-push \
  --project-ref xzcshuoelidzdlihnwme \
  --no-verify-jwt \
  --use-api
```

Si un envoi echoue, consulter les journaux dans Supabase Dashboard > Edge Functions > `notify-push` > Logs.

## 4. Test sur iPhone

1. Ouvrir `https://steven77726.github.io/WINESS-HUB/` dans Safari.
2. Toucher Partager, puis Ajouter a l'ecran d'accueil.
3. Fermer Safari et ouvrir Winess Hub depuis sa nouvelle icone.
4. Selectionner son propre profil dans l'application.
5. Toucher Activer les notifications iPhone, puis Autoriser.
6. Verrouiller l'iPhone.
7. Depuis un autre appareil, attribuer une nouvelle tache a ce profil.
8. La notification doit apparaitre sur l'ecran verrouille. Un toucher ouvre la fiche correspondante.

Pour tester le retour au createur : attribuer une tache a Theo depuis Steven, la prendre en charge depuis Theo, puis la terminer. Steven doit recevoir les deux notifications de suivi.

## Depannage rapide

- Le bouton ne propose rien : verifier que l'app est ouverte depuis l'icone de l'ecran d'accueil, pas dans un onglet Safari.
- Aucun abonnement en base : verifier `push_subscriptions` et les logs de `subscribe-push`.
- Abonnement present mais aucun push : verifier les trois secrets VAPID et les logs de `notify-push`.
- Notification recue mais mauvaise page : verifier que le champ `url` contient une ancre de fiche valide.
- Apres changement de cles VAPID : supprimer puis reinstaller la PWA et reactiver les notifications.
