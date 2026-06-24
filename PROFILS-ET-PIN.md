# Profils et PIN Winess Hub

## Fonctionnement

- Chaque appareil choisit une fois David, Zac, Valerie, Steven ou Theo.
- Le profil cree ou verifie un PIN personnel a quatre chiffres.
- L'appareil memorise le profil valide pendant 30 jours dans son stockage local.
- Le bouton `Changer` efface cette association locale et exige le PIN du nouveau profil.
- Les creations, changements de statut, relances et notifications utilisent toujours le profil valide.

## Securite

Le PIN n'est jamais stocke en clair. La fonction Supabase `profile-pin` calcule une empreinte HMAC-SHA-256 avec le secret serveur `PIN_PEPPER`. Le hash et les informations de controle ne sont pas lisibles par le frontend. Apres cinq erreurs, le profil est verrouille pendant 15 minutes.

Ce PIN reste une identification legere adaptee a la V1 interne. Il ne remplace pas une authentification forte. Une future version manipulant davantage de donnees sensibles devra utiliser Supabase Auth, des comptes individuels et des politiques RLS liees aux utilisateurs authentifies.

## Rappels automatiques

La fonction `process-reminders` est lancee par Supabase Cron toutes les 15 minutes. Elle envoie les rappels 4h ou quotidiens, enregistre l'envoi dans la tache et dans l'activite, puis desactive implicitement les rappels des taches terminees.
