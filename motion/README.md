# Typographie & animations — série « 100 premiers jours »

Re-lettrage des quatre plans du reel avec le système typographique de la marque.

## Le problème que ça résout

Les quatre rushes arrivent avec une typo *placeholder* **incrustée dans les pixels**
(un serif générique, et une faute : `LÉGITIMATE` au lieu de `LÉGITIMITÉ`). On ne peut
donc pas se contenter de poser un calque par-dessus : il faut d'abord reconstruire le
fond là où l'ancien texte était gravé, puis re-composer proprement.

Le pipeline fait les deux, image par image :

1. **Réparation du fond** — le rectangle qui contenait l'ancien texte est reconstruit.
2. **Re-lettrage** — le nouveau bloc typo est animé selon la charte ci-dessous.

## Système typographique

| Rôle | Fonte | Usage |
|---|---|---|
| Titres principaux | **Switzer Black** | capitales, `MANAGER`, `100 PREMIERS JOURS`, `100` |
| Accroches / mots d'accent | **Script** (voir note) | italique naturelle, `on te nomme`, `tes`, `commente` |
| Labels & petits textes | **Switzer Medium** | `LÉGITIMITÉ` / `ÉQUIPE` / `RÉSULTATS` |

**Règle de composition** — le mot script est toujours *au-dessus*, *plus petit*,
*légèrement décalé*, et *chevauche un peu* le titre Switzer en dessous.

Le script n'est pas dimensionné au corps mais à la **hauteur d'œil rendue** (`script_ratio`,
fraction de la hauteur d'encre du titre). Le corps serait trompeur : `tes`, tout en bas-de-casse,
rendrait beaucoup plus petit que `on te nomme` au même corps.

### ⚠️ Note sur la fonte script

La charte demande **Tempting**. C'est une fonte commerciale, absente de ce dépôt.
Le rendu actuel utilise **Ephesis** (SIL OFL) comme doublure : même registre — script
calligraphique à fort contraste, italique naturelle.

**Pour passer à la vraie Tempting** : déposer le fichier dans `fonts/` et changer une ligne
de `spec.json` :

```json
"fonts": { "script": "fonts/Tempting.otf" }
```

Rien d'autre à toucher — le dimensionnement est mesuré au rendu, donc la composition
se réadapte toute seule aux métriques de la nouvelle fonte.

## Répartition par plan

| Plan | Script | Titre |
|---|---|---|
| 1 | `on te nomme` — or | `MANAGER` — Switzer Black, crème |
| 2 | `tes` — or | `100 PREMIERS JOURS` — Switzer Black, noir |
| 3 | — | `LÉGITIMITÉ` / `ÉQUIPE` / `RÉSULTATS` — Switzer Medium, un par carte |
| 4 | `commente` — crème | `100` — Switzer Black, or |

## Animations

Sobres, aucune ne dépasse 0,6 s.

| Élément | Animation |
|---|---|
| Switzer | fade-in + montée de 20 px, ease-out, **0,4 s** |
| Script | masque révélé de gauche à droite, **0,6 s**, démarre **0,15 s avant** le titre |
| Mot en or | crème → or sur **0,2 s**, calé sur le temps fort de la voix |
| Sortie | fade-out **0,3 s**, démarrant **0,5 s avant** la fin du plan |

Les temps forts sont relevés sur l'enveloppe RMS de la bande son de chaque plan
(plan 1 → 4,12 s ; plan 2 → 2,08 s ; plan 4 → 4,21 s) et notés dans `gold_at`.

## Deux détails de fabrication

**Le plan 3 bouge.** Les cartes dérivent pendant tout le plan (léger recadrage).
Les positions ne sont donc pas figées : chaque image, les cartes sont détectées sur une
ligne de sondage, et le patch, le corps et le placement du label suivent leur échelle.

**Deux modes de réparation**, selon le fond :

- `harmonic` — résout une équation de Laplace dans le rectangle, avec l'anneau de pixels
  intacts autour comme condition au bord. Le fond hérite du dégradé des quatre côtés,
  donc un vignettage radial reste radial au lieu de s'aplatir en bande. Plans 1 et 4.
- `flat` — remplit avec la **médiane** de l'anneau. Sur le fond crème uni du plan 2, la
  médiane ignore le filet du cadre qui traverse l'anneau, là où une moyenne le baverait
  en gris. Sans plume : le remplissage est exact, et une plume ne ferait que laisser
  ressortir l'ancienne encre.

## Utilisation

```bash
python3 motion/render.py            # les 4 plans + le reel assemblé
python3 motion/render.py clip2      # un seul plan
python3 motion/render.py --stills   # planches contact seules, sans encodage
```

Sorties dans `motion/out/` : `clip1..4.mp4`, les planches contact `clipN_sheet.png`,
et `reel.mp4` (les quatre plans bout à bout, 32 s).

Tout le réglage — textes, couleurs, positions, timings, rectangles de réparation — vit
dans `spec.json`. `render.py` n'a rien de codé en dur.

Dépendances : `ffmpeg`, `ffprobe`, `Pillow`, `numpy`.
