# Compte et synchronisation (Supabase)

Repris de la V13 (`elyndor-cloud.js`), intégré à l'application : web,
Android et iOS partagent le même code (`src/cloud/`).

## Ce qui est synchronisé

| Emplacement (`slot_key`) | Contenu |
| --- | --- |
| `story:<id>` | L'histoire complète, au format de stockage (`HistoireStockee`) |
| `personas:v1` | Les personnages enregistrés |
| `settings:v1` | Les réglages partagés : modèles, profil de contenu, langue, images, mode concepteur |
| `manifest:v1` | Les suppressions (« pierres tombales ») fusionnées entre appareils |

Jamais envoyés : les clés API, et les réglages propres à l'appareil
(moteur d'inférence, adresse du serveur local, conservation des clés
dans le navigateur). Le format est celui de la V13 : un même compte peut
servir à la version web V13 et à l'application.

## Fonctionnement

- À l'ouverture et à la connexion : lecture des dates seules, puis
  téléchargement de ce qui est plus récent ailleurs et envoi de ce qui est
  plus récent ici. Une histoire supprimée ailleurs est supprimée ici.
- Ensuite : vérification locale toutes les 15 s, sans aucun appel réseau
  tant que rien n'a changé ; envoi quand l'application passe en arrière-plan.
- « Synchroniser maintenant » (écran Compte) relance une synchronisation
  complète.

## Schéma attendu

Les tables existent déjà sur le projet de la V13. Pour les recréer :

```sql
create table public.cloud_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_key text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot_key)
);
alter table public.cloud_saves enable row level security;
create policy "cloud_saves du propriétaire" on public.cloud_saves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  updated_at timestamptz
);
alter table public.profiles enable row level security;
create policy "profil du propriétaire" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
```

## Connexion Google (web)

Supabase ne renvoie vers l'application que si son adresse est autorisée :
dans Authentication → URL Configuration → Redirect URLs, ajouter
`https://artisanguillonrenov-creator.github.io/logiciel-rp-beta/` (et
l'adresse locale de développement si besoin). Sur Android et iOS, la
connexion se fait par e-mail et mot de passe.
