# illustrator-imposition

**Imposition.jsx** — imposition « step and repeat » avec traits de coupe pour Adobe Illustrator (ExtendScript, FR/EN).
*Step-and-repeat imposition with crop marks for Adobe Illustrator.*

> **Statut : non testé dans Illustrator.** La syntaxe ES3 a été vérifiée automatiquement (acorn) et la logique relue, mais le script n'a pas encore été exécuté dans Illustrator. Travaillez sur une **copie** de votre fichier.
> *Status: not tested in Illustrator. ES3 syntax checked (acorn) and logic reviewed only. Work on a copy of your file.*

## Pourquoi / Why

Mettre 21 ou 25 cartes de visite sur une feuille SRA3, des étiquettes sur un A3 ou des tickets sur un 13 × 19 in, avec les traits de coupe au bon endroit, se fait encore souvent à la main (Transformation répétée, Répétition en grille, puis traits de coupe un par un). Les scripts gratuits existants dupliquent bien en grille mais ne tracent pas les traits de coupe ; les outils qui le font sont souvent payants.

Ce script fait tout en une fois, à partir de l'objet sélectionné :

- **Format fini** lu depuis les limites de la sélection (moins le fond perdu indiqué) ou depuis le plan de travail actif ; modifiable à la main. Les groupes masqués sont mesurés d'après leur masque.
- **Feuille** : SRA3, SRA4, A3, A4, A5, 13 × 19 in, 12 × 18 in, Letter, Tabloid, format personnalisé ou plan de travail actif. Orientation portrait, paysage ou automatique.
- **Disposition** : *Remplir la feuille* (le plus d'exemplaires possible) ou *colonnes × rangées* imposées ; gouttières horizontale et verticale ; rotation des copies 0°, 90° ou automatique (à nombre égal, le script préfère sans rotation, puis portrait). Le bloc est centré.
- **Fond perdu** : chaque copie peut être masquée pour garder tout le fond perdu sur les bords extérieurs du bloc, et seulement la moitié de la gouttière entre deux copies (pas de chevauchement).
- **Traits de coupe** en couleur de repérage (longueur, décalage, épaisseur réglables), autour du bloc, sur un calque verrouillé ; **légende** facultative en bas de feuille (nom du fichier, nombre d'exemplaires, formats).
- Le nombre d'exemplaires s'affiche **en direct** dans la fenêtre avant de valider.

L'original n'est pas modifié : la feuille est construite sur un **nouveau plan de travail** placé à droite des autres (ou sur le plan de travail actif si vous le choisissez), avec deux calques dédiés : `Imposition N ex.` et `Traits de coupe`.

## Installation

- **Ponctuelle** : dans Illustrator, *Fichier > Scripts > Autre script…* (Ctrl+F12 / Cmd+F12), puis choisir `Imposition.jsx`.
- **Permanente** : copier `Imposition.jsx` dans le dossier `Presets/<langue>/Scripts` d'Illustrator, puis redémarrer Illustrator :
  - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\fr_FR\Scripts`
  - macOS : `/Applications/Adobe Illustrator <version>/Presets.localized/fr_FR/Scripts`

  Le script apparaît alors dans *Fichier > Scripts*.

Le fichier est en UTF-8 (avec BOM) pour que les accents s'affichent correctement ; gardez cet encodage si vous le modifiez.

## Utilisation / Usage

1. Ouvrez votre document (un message s'affiche si aucun document n'est ouvert) et faites-en une copie.
2. Sélectionnez avec l'outil Sélection (V) l'objet ou le groupe à imposer, fond perdu compris (un message s'affiche si rien n'est sélectionné). Astuce : groupez la carte et son fond perdu, ou masquez-la au format fond perdu.
3. Lancez le script. Vérifiez le format fini (indiquez le fond perdu inclus dans l'objet, 3 mm par défaut), choisissez la feuille, la marge, les gouttières et les traits de coupe. Le résultat (par ex. *25 exemplaires (5 × 5), copies pivotées de 90°*) s'affiche en bas de la fenêtre.
4. Cliquez sur **Imposer**. Un bilan s'affiche à la fin.
5. Pour revenir en arrière : Ctrl+Z / Cmd+Z, éventuellement plusieurs fois (ExtendScript ne permet pas de forcer une seule étape d'annulation dans Illustrator). Vous pouvez aussi simplement supprimer les deux calques et le plan de travail créés.

Exemple : carte 85 × 55 mm avec 3 mm de fond perdu, feuille SRA3, marge 12 mm, gouttière 0 → 3 × 7 = 21 cartes sans rotation, ou 5 × 5 = 25 cartes en paysage si l'orientation est automatique.

L'interface est en français si Illustrator est en français, sinon en anglais.

## Version ciblée / Target

Illustrator CC 2018 et versions plus récentes (ExtendScript ES3, ScriptUI). Pas d'UXP nécessaire.

## Limites connues / Known limits

- Non testé dans Illustrator : signalez tout problème dans les *Issues*.
- Recto seul : pas encore de recto/verso aligné (tourner-retourner).
- Pas de tracés de découpe (cut contour) en ton direct, pas de presets enregistrés.
- Les traits de coupe sont placés autour du bloc uniquement (pas de traits dans les gouttières).
- La création d'un nouveau plan de travail peut échouer si la zone de travail est pleine : choisissez alors *Plan de travail actif* comme feuille.
- Avec beaucoup de copies d'une illustration lourde, le script peut être lent.

## Projets similaires / Similar projects

Code 100 % original. D'autres outils existent, avec d'autres choix : `RepeatAfterMe.jsx` (joshbduncan/illustrator-scripts, répétition en grille avec aperçu, sans traits de coupe), *Step and Repeat* de prepress-adobe-scripts (hanggrian), *Step and Repeat PowerScript* d'O2 Creative (payant). Celui-ci est gratuit, bilingue FR/EN, calcule seul la meilleure disposition et trace les traits de coupe.

## Confidentialité / Privacy

Aucun appel réseau, aucune collecte de données, aucun fichier écrit.

## Licence

MIT — © 2026 Amirouche Amwanes. Voir `LICENSE`.
