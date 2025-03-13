# Contribuer à Link & Image Checker

Tout d'abord, merci de votre intérêt pour contribuer à Link & Image Checker ! C'est grâce à des personnes comme vous que cette extension continue de s'améliorer.

Ce document présente les lignes directrices pour contribuer au projet. En suivant ces directives, nous nous assurons que le processus de contribution est efficace et agréable pour tous.

## Table des matières

- [Code de conduite](#code-de-conduite)
- [Comment puis-je contribuer ?](#comment-puis-je-contribuer-)
  - [Signaler des bugs](#signaler-des-bugs)
  - [Suggérer des améliorations](#suggérer-des-améliorations)
  - [Contribuer au code](#contribuer-au-code)
- [Style de code et normes](#style-de-code-et-normes)
- [Processus de développement](#processus-de-développement)
  - [Configuration de l'environnement](#configuration-de-lenvironnement)
  - [Tests](#tests)
  - [Pull Requests](#pull-requests)
- [Organisation du projet](#organisation-du-projet)

## Code de conduite

Ce projet adhère à un code de conduite qui attend de tous les participants qu'ils se respectent mutuellement. Veuillez lire le [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) avant de contribuer.

## Comment puis-je contribuer ?

### Signaler des bugs

Les bugs sont suivis comme des [issues GitHub](https://github.com/Artkabis/link-image-checker/issues).

Avant de créer une issue pour un bug :

1. **Vérifiez si le bug a déjà été signalé** en recherchant dans les issues existantes.
2. Si vous ne trouvez pas d'issue ouverte correspondante, créez-en une nouvelle.

Lorsque vous créez une issue pour un bug, incluez :

- **Un titre clair et descriptif**
- **Des étapes précises pour reproduire le problème**
  - Soyez le plus détaillé possible
  - Fournissez des exemples spécifiques (URLs de test si possible)
- **Comportement attendu**
- **Comportement observé**
- **Screenshots** si applicable
- **Informations sur votre environnement**:
  - Version de l'extension
  - Navigateur et version
  - Système d'exploitation
  - Autres extensions installées qui pourraient interagir

### Suggérer des améliorations

Les suggestions d'amélioration sont également suivies comme des issues GitHub.

Lorsque vous suggérez une amélioration, incluez :

- **Un titre clair et descriptif**
- **Une description détaillée de l'amélioration** et pourquoi elle serait utile
- **Exemples de cas d'utilisation** spécifiques
- **Maquettes ou esquisses** si applicable

### Contribuer au code

1. **Forkez le dépôt** sur GitHub.
2. **Créez une branche** pour votre modification.
   - Utilisez une branche dédiée pour chaque fonctionnalité ou correction
   - Nommez-la de manière descriptive (ex: `fix-cors-detection` ou `add-export-html`)
3. **Développez vos modifications** en suivant les [normes de code](#style-de-code-et-normes).
4. **Testez vos modifications** en suivant les [directives de test](#tests).
5. **Soumettez une Pull Request** en suivant le [processus PR](#pull-requests).

## Style de code et normes

Maintenir un style de code cohérent est important pour la lisibilité et la maintenance du projet.

### JavaScript

- Utilisez les fonctionnalités ES6+
- Utilisez la syntaxe des modules JavaScript (import/export)
- Suivez les conventions de nommage :
  - camelCase pour les variables et fonctions
  - PascalCase pour les classes
  - UPPER_CASE pour les constantes
- Documentez votre code avec des commentaires JSDoc
- Évitez les fonctions trop longues (max ~50 lignes)
- Utilisez des noms de variables descriptifs

### CSS

- Suivez une approche composant par composant
- Utilisez des noms de classes descriptifs et spécifiques
- Évitez les sélecteurs trop génériques
- Organisez le CSS par composant/fonctionnalité

### HTML

- Utilisez du HTML sémantique
- Assurez l'accessibilité des éléments (attributs ARIA, etc.)
- Maintenez une indentation cohérente

### Documentation

- Documentez toutes les nouvelles fonctionnalités
- Mettez à jour la documentation existante si nécessaire
- Écrivez dans un style clair et concis

## Processus de développement

### Configuration de l'environnement

Pour configurer l'environnement de développement :

1. Clonez votre fork du dépôt :
   ```bash
   git clone https://github.com/VOTRE-USERNAME/link-image-checker.git
   cd link-image-checker
   ```

2. Créez une branche pour vos modifications :
   ```bash
   git checkout -b nom-de-votre-branche
   ```

3. Installez l'extension localement dans Chrome :
   - Ouvrez Chrome et accédez à `chrome://extensions/`
   - Activez le "Mode développeur"
   - Cliquez sur "Charger l'extension non empaquetée"
   - Sélectionnez le dossier du projet

### Tests

Testez soigneusement vos modifications avant de soumettre une Pull Request.

#### Tests manuels

1. Testez sur différents types de pages web
2. Vérifiez différents types de liens et d'images
3. Assurez-vous que l'interface utilisateur fonctionne correctement
4. Vérifiez les cas particuliers (CORS, protocoles spéciaux, etc.)
5. Testez les fonctionnalités d'exportation

#### Vérification de la compatibilité

Assurez-vous que vos modifications sont compatibles avec :
- Chrome (différentes versions si possible)
- Différents systèmes d'exploitation
- Différentes tailles d'écran

### Pull Requests

1. Poussez vos modifications vers votre fork :
   ```bash
   git push origin nom-de-votre-branche
   ```

2. Ouvrez une Pull Request sur GitHub.

3. Dans votre Pull Request, incluez :
   - Une description claire de ce que vos modifications font
   - Références aux issues que cette PR résout (si applicable)
   - Captures d'écran ou vidéos pour les changements d'interface
   - Toute information supplémentaire qui pourrait être utile aux reviewers

4. Un mainteneur examinera votre PR, pourra demander des modifications, et finalement l'approuvera ou la rejettera.

## Organisation du projet

Comprendre la structure du projet vous aidera à contribuer plus efficacement :

```
link-image-checker/
├── manifest.json           # Configuration de l'extension
├── background/
│   └── background.js       # Script d'arrière-plan pour les vérifications
├── content/
│   └── content.js          # Script de contenu pour l'interaction avec la page
├── popup/
│   ├── popup.html          # Interface utilisateur du popup
│   ├── popup.js            # Logique d'interface et gestion des événements
│   └── popup.css           # Styles et mise en page
├── scripts/
│   ├── utils.js            # Fonctions utilitaires partagées
│   ├── checkLinks.js       # Module de vérification des liens
│   ├── checkImages.js      # Module de vérification des images
│   └── index.js            # Point d'entrée des modules
├── images/                 # Icônes et ressources graphiques
└── docs/                   # Documentation
```

### Points d'entrée principaux

- **popup/popup.js** : Interface utilisateur et interactions
- **background/background.js** : Logique principale de vérification
- **scripts/utils.js** : Fonctions utilitaires réutilisables
- **scripts/checkLinks.js** et **scripts/checkImages.js** : Modules spécialisés

---

Merci encore pour votre intérêt à contribuer à Link & Image Checker !

Si vous avez des questions ou besoin d'aide, n'hésitez pas à contacter les mainteneurs ou à ouvrir une issue de discussion sur GitHub.