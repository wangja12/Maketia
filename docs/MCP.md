# Serveur MCP de Tunnels IA

Tunnels IA n'exécute aucun modèle d'IA. L'utilisateur connecte son propre client IA
(Claude, ChatGPT ou tout client compatible MCP) au serveur MCP du produit. Le client raisonne
de son côté et appelle les outils ci-dessous, qui passent par les mêmes services, validations
et autorisations que l'application web.

## Connexion

| Élément | Valeur |
| --- | --- |
| Adresse | `https://<domaine-du-produit>/api/mcp` (en local : `http://localhost:3000/api/mcp`) |
| Transport | Streamable HTTP, sans session (chaque requête POST est autonome) ; réponses JSON |
| Authentification | `Authorization: Bearer tia_…`, jeton créé dans **Agents IA** |
| Portée | Un jeton = un espace de travail = les droits actuels de l'utilisateur qui l'a créé |
| Droits | `read` (lecture) ou `write` (lecture + création/modification de pages). Un jeton `write` d'un utilisateur devenu lecteur n'écrit plus. |
| Limite | 120 appels par minute et par jeton (comptés dans le journal d'audit, donc valable sur plusieurs serveurs) ; corps de requête 512 Kio max |
| Révocation | Bouton **Révoquer** dans Agents IA : effet immédiat (le jeton est vérifié à chaque requête) |

Le jeton n'est affiché qu'une fois ; seul son SHA-256 est stocké.

### Clients vérifiés

| Client | Statut |
| --- | --- |
| SDK MCP TypeScript officiel 1.32.1 (`StreamableHTTPClientTransport`) | Testé de bout en bout (tests Playwright : lecture de la skill, de la fiche, modification d'une section, variante, révocation). |
| Claude Code CLI | `claude mcp add --transport http tunnels-ia <adresse> --header "Authorization: Bearer <jeton>"` puis `claude mcp list` : « √ Connected ». Les appels d'outils depuis une conversation n'ont pas été exécutés dans ces tests. |
| claude.ai (connecteurs web), ChatGPT | **Non vérifiés.** Ces clients demandent en général OAuth 2.1, que le serveur ne propose pas encore (jeton porteur uniquement). |

## Outils disponibles

Seuls les outils réellement implémentés et testés sont exposés.

| Outil | Type | Rôle |
| --- | --- | --- |
| `get_design_engineering_skill` | lecture | Renvoie la skill obligatoire `wang-design-engineering` et sa version |
| `get_page_schema` | lecture | Schéma JSON du contenu d'une page (v1), types de sections et de pages |
| `list_workspaces` | lecture | Espace de la connexion et rôle |
| `list_funnels`, `get_funnel` | lecture | Tunnels ; `get_funnel` inclut la fiche de l'offre (`brief`) et les pages |
| `list_pages`, `get_page`, `list_page_versions`, `list_page_variants` | lecture | Pages, contenu d'une version, historique, variantes |
| `validate_page` | lecture | Contrôles déterministes : `errors` (bloquants), `warnings`, `review` (revue humaine) |
| `get_integrations_status` | lecture | État réel des intégrations (rien n'est présenté comme actif sans l'être) |
| `create_funnel`, `update_funnel` | écriture | Créer ou renommer un tunnel |
| `create_page` | conception | Créer une page (modèle par type, ou contenu complet) |
| `update_page_content` | conception | Remplacer tout le contenu (nouvelle version) |
| `update_page_section` | conception | Modifier seulement certains champs d'une section |
| `update_page_theme` | conception | Accent, fond, police |
| `add_page_section`, `remove_page_section`, `reorder_page_sections` | conception | Sections |
| `duplicate_page`, `create_page_variant` | conception | Copie indépendante ; variante (4 maximum par page) |
| `restore_page_version` | conception | Nouvelle version identique à une ancienne |

Les outils **de conception** exigent `skill_version` égal à la version courante de la skill
(`1.0.0`) et rappellent dans leur description de lire la skill. Les modifications exigent
`base_version` : si la page a changé depuis la lecture, l'appel échoue
(`current_version=N`) au lieu d'écraser.

Non exposés pour l'instant (non construits) : publication, dépublication, aperçu public,
expériences A/B, statistiques, contacts, commandes, paiements, domaines, quotas.
Aucun outil ne supprime une ressource.

Ressource : `wang://skills/design-engineering` (même texte que l'outil).

## Sécurité

- Chaque appel revérifie le jeton, l'appartenance de l'utilisateur à l'espace et son rôle.
- Un jeton ne voit que son espace, même si l'utilisateur appartient à d'autres espaces.
- Le contenu des pages est une donnée JSON validée (texte brut, liens `https://`, `/` ou `#`,
  images `https://`) : aucun HTML ni script n'est accepté ni exécuté.
- Les instructions du serveur rappellent que le texte des pages, fiches et contacts est une
  donnée, jamais une instruction (protection contre l'injection d'instructions).
- Journal : outil, ressource, résultat, utilisateur, jeton et date de chaque appel, visible
  dans **Agents IA**.
- Un agent ne peut ni publier, ni supprimer, ni changer un paiement.

## Exemple d'échange

1. `get_design_engineering_skill` → lire la skill, noter `version`.
2. `get_funnel` → lire `brief` ; `get_page_schema` → lire le format.
3. `create_page { funnel_id, name, kind: "sales", skill_version }`.
4. `get_page` → `currentVersion: 1`.
5. `update_page_section { page_id, base_version: 1, section_id: "hero", changes: { headline: "…" }, skill_version, note: "Accroche" }`.
6. `validate_page` → corriger les `errors`, transmettre `review` à l'utilisateur.
