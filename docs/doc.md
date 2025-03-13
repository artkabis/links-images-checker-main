# Documentation : Link & Image Checker

## Table des matières

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Interface utilisateur](#interface-utilisateur)
4. [Utilisation de base](#utilisation-de-base)
5. [Fonctionnalités avancées](#fonctionnalités-avancées)
6. [Types de liens et statuts](#types-de-liens-et-statuts)
7. [Options de configuration](#options-de-configuration)
8. [Exportation des résultats](#exportation-des-résultats)
9. [Résolution des problèmes](#résolution-des-problèmes)
10. [Structure du code](#structure-du-code)
11. [FAQ](#faq)

## Introduction

Link & Image Checker est une extension Chrome puissante conçue pour vérifier les liens et les images sur une page web afin d'identifier les liens brisés, les redirections, les images manquantes et d'autres problèmes potentiels. Cet outil est essentiel pour les développeurs web, les responsables de contenu et les testeurs qui souhaitent garantir l'intégrité des ressources de leurs sites web.

### Principales caractéristiques

- Vérification simultanée des liens et des images
- Détection des liens brisés (404, 500, etc.)
- Identification des redirections
- Vérification des ancres internes
- Détection des images manquantes ou inaccessibles
- Gestion de cas particuliers (réseaux sociaux, CORS, etc.)
- Interface utilisateur intuitive avec filtrage et tri
- Options d'exportation vers JSON, CSV et HTML

## Installation

### Installation depuis le Chrome Web Store

1. Visitez la page de l'extension sur le Chrome Web Store
2. Cliquez sur le bouton "Ajouter à Chrome"
3. Confirmez l'installation lorsque vous y êtes invité

### Installation manuelle (pour les développeurs)

1. Téléchargez ou clonez le dépôt GitHub
2. Ouvrez Chrome et accédez à `chrome://extensions/`
3. Activez le "Mode développeur" en haut à droite
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier contenant l'extension

## Interface utilisateur

L'interface de Link & Image Checker est organisée en plusieurs sections pour une utilisation optimale :

### Barre d'en-tête
- Titre de l'extension
- Onglets de navigation (Tous, Liens, Images)
- Informations sur la dernière analyse

### Contrôles de filtrage
- Menu déroulant pour filtrer par statut (Tous, Erreurs, Avertissements, Réussis)
- Menu déroulant pour trier (Statut, URL, Type)
- Barre de recherche pour trouver des éléments spécifiques
- Boutons pour développer/réduire tous les résultats

### Contrôles principaux
- Bouton "Vérifier la page" pour lancer l'analyse
- Bouton "Arrêter" pour interrompre une analyse en cours
- Menu déroulant pour le format d'exportation (JSON, CSV, HTML)
- Bouton "Exporter" pour sauvegarder les résultats

### Barre de progression
- Indicateur visuel de l'avancement
- Texte informatif sur l'étape en cours
- Compteur d'éléments traités

### Résumé
- Statistiques globales (Total, Réussis, Avertissements, Erreurs)
- Représentation visuelle par code couleur

### Résultats
- Liste détaillée des liens et images vérifiés
- Indicateurs visuels de statut
- Options pour développer/réduire les détails
- Boutons d'action pour chaque élément

### Légende
- Explication des différents types de badges et statuts

### Options
- Paramètres de configuration avancés

## Utilisation de base

### Lancer une vérification

1. Ouvrez la page web que vous souhaitez analyser
2. Cliquez sur l'icône de l'extension dans la barre d'outils de Chrome
3. Dans le popup, cliquez sur le bouton "Vérifier la page"
4. Attendez que l'analyse se termine

### Interpréter les résultats

Les résultats sont classés en trois catégories principales :

- **Réussis (vert)** : Liens et images accessibles sans problème
- **Avertissements (orange)** : Éléments qui fonctionnent mais méritent attention (redirections, protocoles spéciaux, etc.)
- **Erreurs (rouge)** : Éléments problématiques nécessitant une correction (liens brisés, images manquantes, etc.)

Chaque élément peut être développé pour afficher des informations détaillées comme :
- Code de statut HTTP
- Type de contenu
- URL finale (en cas de redirection)
- Dimensions (pour les images)
- Messages d'erreur spécifiques

### Actions sur les résultats

Pour chaque élément vérifié, plusieurs actions sont disponibles :
- Cliquer sur l'élément pour développer/réduire les détails
- Utiliser le bouton "Ouvrir dans un nouvel onglet" pour visiter l'URL
- Utiliser le bouton "Copier l'URL" pour copier l'adresse dans le presse-papiers
- Utiliser le bouton "Mettre en évidence" pour localiser l'élément sur la page (si disponible)

## Fonctionnalités avancées

### Filtrage des résultats

Utilisez le menu déroulant "Filtrer" pour afficher uniquement :
- Tous les éléments
- Les erreurs uniquement
- Les avertissements uniquement
- Les éléments réussis uniquement

### Tri des résultats

Utilisez le menu déroulant "Trier par" pour organiser les résultats selon :
- Statut (erreurs d'abord, puis avertissements, puis réussis)
- URL (ordre alphabétique)
- Type (regrouper par type de ressource)

### Recherche

Utilisez la barre de recherche pour trouver rapidement des éléments spécifiques. La recherche s'effectue sur :
- L'URL
- Le message de statut
- Le type de contenu

### Mise en évidence sur la page

Pour les éléments disposant d'un sélecteur DOM, vous pouvez cliquer sur le bouton "Mettre en évidence" pour localiser visuellement l'élément sur la page. Un encadré coloré apparaîtra momentanément autour de l'élément correspondant.

## Types de liens et statuts

### Types de liens spéciaux

Link & Image Checker reconnaît et gère différemment les types de liens suivants :

- **Email** (`mailto:`) - Liens vers des adresses email
- **Téléphone** (`tel:`) - Liens vers des numéros de téléphone
- **JavaScript** (`javascript:`) - Liens exécutant du code JavaScript
- **Fragment** (`#`) - Ancres internes à la page
- **Facebook** - Liens vers Facebook (traitement spécial)
- **Instagram** - Liens vers Instagram (traitement spécial)
- **Twitter/X** - Liens vers Twitter/X (traitement spécial)
- **LinkedIn** - Liens vers LinkedIn (traitement spécial)
- **Data URL** - URLs encodées en base64
- **CORS** - Liens affectés par des restrictions cross-origin
- **Site protégé** - Domaines avec protection anti-scraping

### Statuts des vérifications

Les éléments vérifiés peuvent avoir les statuts suivants :

- **Success** (Réussi) - L'élément est accessible (code 2xx)
- **Redirect** (Redirection) - L'élément redirige vers une autre URL (code 3xx)
- **ClientError** (Erreur client) - Problème côté client (code 4xx)
- **ServerError** (Erreur serveur) - Problème côté serveur (code 5xx)
- **Warning** (Avertissement) - L'élément fonctionne mais mérite attention
- **Error** (Erreur) - Problème empêchant l'accès à l'élément
- **Invalid** (Invalide) - URL mal formée ou protocole non supporté
- **Skipped** (Ignoré) - Élément non vérifié selon les options

## Options de configuration

Link & Image Checker offre diverses options de configuration pour personnaliser son comportement :

### Requêtes simultanées
Définit le nombre de vérifications à effectuer en parallèle (1-10).
- **Valeur par défaut** : 5
- **Impact** : Une valeur plus élevée accélère l'analyse mais peut surcharger le réseau

### Délai d'attente (ms)
Définit le temps d'attente maximum pour chaque requête.
- **Valeur par défaut** : 10000 (10 secondes)
- **Impact** : Une valeur plus basse peut entraîner de faux positifs pour les sites lents

### User-Agent
Définit l'en-tête User-Agent utilisé pour les requêtes.
- **Options** : Chrome (par défaut), Firefox, Safari, Edge, Mobile, Googlebot, cURL
- **Impact** : Certains sites peuvent retourner des réponses différentes selon le User-Agent

### Vérifier les images
Active ou désactive la vérification des images.
- **Valeur par défaut** : Activé
- **Impact** : Désactiver peut accélérer l'analyse pour les pages avec beaucoup d'images

### Vérifier les liens externes
Active ou désactive la vérification des liens pointant vers d'autres domaines.
- **Valeur par défaut** : Activé
- **Impact** : Désactiver limite la vérification aux liens du même domaine

### Vérifier les ancres
Active ou désactive la vérification des ancres internes (#id).
- **Valeur par défaut** : Désactivé
- **Impact** : Activer ajoute une vérification de l'existence des ancres dans le HTML

### Suivre les redirections
Active ou désactive le suivi des redirections.
- **Valeur par défaut** : Activé
- **Impact** : Désactiver peut accélérer l'analyse mais ne vérifiera pas la destination finale

### Nombre max. de redirections
Définit le nombre maximum de redirections à suivre.
- **Valeur par défaut** : 5
- **Impact** : Une valeur trop basse peut ne pas atteindre la destination finale

## Exportation des résultats

Link & Image Checker permet d'exporter les résultats dans trois formats :

### JSON
Format complet contenant toutes les informations détaillées.
- **Cas d'usage** : Traitement automatisé, intégration avec d'autres outils
- **Structure** : Objet JSON avec métadonnées et résultats complets

### CSV
Format tabulaire compatible avec les tableurs et bases de données.
- **Cas d'usage** : Analyse dans Excel, Google Sheets, etc.
- **Structure** : Fichier CSV avec en-têtes et une ligne par élément vérifié

### HTML
Rapport formaté pour consultation humaine.
- **Cas d'usage** : Partage des résultats, documentation
- **Structure** : Page HTML avec styles intégrés, statistiques et résultats interactifs

## Résolution des problèmes

### Problèmes courants

#### L'extension ne trouve pas tous les liens
- Certains liens peuvent être générés dynamiquement par JavaScript
- Vérifiez que la page est complètement chargée avant l'analyse
- Essayez d'augmenter le délai d'attente dans les options

#### Faux positifs (liens marqués comme brisés alors qu'ils fonctionnent)
- Certains sites bloquent les requêtes automatisées
- Essayez de changer le User-Agent dans les options
- Les liens vers les réseaux sociaux sont souvent marqués avec un avertissement malgré leur fonctionnement correct

#### L'analyse est trop lente
- Réduisez le nombre de requêtes simultanées
- Désactivez la vérification des images
- Limitez l'analyse aux liens internes

#### Problèmes CORS
- Les restrictions CORS peuvent empêcher la vérification correcte de certaines ressources
- Ces éléments sont marqués avec un badge "CORS"
- Ils peuvent fonctionner correctement pour les utilisateurs malgré l'erreur de vérification

### Signaler un bug

Si vous rencontrez un problème non répertorié ici :
1. Vérifiez que vous utilisez la dernière version de l'extension
2. Consultez les issues GitHub pour voir si le problème est déjà connu
3. Créez une nouvelle issue avec :
   - Description détaillée du problème
   - Étapes pour reproduire
   - URL de test (si possible)
   - Captures d'écran (si pertinent)
   - Informations sur votre navigateur et système

## Structure du code

Link & Image Checker est organisé selon une architecture modulaire :

### Fichiers principaux

- **manifest.json** : Configuration de l'extension
- **popup/popup.html** : Interface utilisateur du popup
- **popup/popup.js** : Logique d'interface et gestion des événements
- **popup/popup.css** : Styles et mise en page
- **background/background.js** : Script d'arrière-plan pour les vérifications
- **content/content.js** : Script de contenu pour l'interaction avec la page
- **scripts/utils.js** : Fonctions utilitaires partagées
- **scripts/checkLinks.js** : Module de vérification des liens
- **scripts/checkImages.js** : Module de vérification des images

### Flux de données

1. L'utilisateur interagit avec l'interface (popup.js)
2. Les commandes sont envoyées au script d'arrière-plan (background.js)
3. Le script d'arrière-plan effectue les vérifications via les modules spécialisés
4. Les résultats sont renvoyés au popup pour affichage
5. Le script de contenu (content.js) est utilisé pour collecter les URLs et interagir avec le DOM

## FAQ

### Questions générales

**Q: Combien de liens/images l'extension peut-elle vérifier ?**  
R: Il n'y a pas de limite stricte, mais les performances peuvent diminuer avec des centaines d'éléments. L'extension a été testée avec succès sur des pages contenant jusqu'à 1000 éléments.

**Q: L'extension fonctionne-t-elle sur d'autres navigateurs que Chrome ?**  
R: Actuellement, l'extension est conçue pour Chrome. Des versions pour Firefox et Edge pourraient être développées à l'avenir.

**Q: Les résultats sont-ils sauvegardés entre les sessions ?**  
R: Les résultats de la dernière analyse sont sauvegardés localement et restaurés lors de la réouverture de l'extension sur la même page. Ils sont perdus si vous changez de page ou fermez le navigateur.

### Questions techniques

**Q: Comment l'extension détecte-t-elle les liens et images ?**  
R: L'extension utilise des sélecteurs DOM pour trouver les éléments `<a>` avec attribut `href` et les éléments `<img>` avec attribut `src`. Elle recherche également les images d'arrière-plan dans les styles CSS.

**Q: Comment l'extension vérifie-t-elle les liens ?**  
R: L'extension utilise l'API Fetch pour envoyer des requêtes HTTP et analyser les réponses. Elle tente d'abord une requête HEAD, puis une requête GET si nécessaire.

**Q: Les vérifications sont-elles effectuées depuis le navigateur ou un serveur ?**  
R: Toutes les vérifications sont effectuées directement depuis le navigateur. Aucune donnée n'est envoyée à des serveurs externes.

**Q: L'extension peut-elle vérifier les pages nécessitant une authentification ?**  
R: L'extension vérifie les ressources dans le contexte de l'onglet actif, donc si vous êtes authentifié sur la page, les vérifications bénéficieront de cette authentification pour les ressources du même domaine. Les ressources externes seront vérifiées sans authentification.

### Questions d'utilisation

**Q: Puis-je vérifier uniquement certains types de liens ?**  
R: Actuellement, l'extension vérifie tous les liens trouvés. Vous pouvez utiliser les filtres après l'analyse pour vous concentrer sur certains types ou statuts.

**Q: Comment interpréter les avertissements pour les réseaux sociaux ?**  
R: De nombreux réseaux sociaux emploient des mesures anti-scraping qui peuvent empêcher la vérification automatique. Un avertissement ne signifie pas nécessairement que le lien est invalide, mais qu'il n'a pas pu être vérifié de manière fiable.

**Q: Pourquoi certains éléments sont-ils marqués comme "CORS" ?**  
R: Les restrictions CORS (Cross-Origin Resource Sharing) peuvent empêcher le navigateur d'accéder à certaines ressources lors de la vérification. Ces ressources peuvent néanmoins fonctionner correctement pour les utilisateurs visitant directement la page.