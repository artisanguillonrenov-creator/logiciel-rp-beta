# Elyndor — Conversation V2 / passe de finition

Cette passe part de la conversation cinématique déjà fusionnée et vise uniquement la finition visuelle. Le moteur narratif, la mémoire, les sauvegardes, les fournisseurs IA, les branches et les outils ne sont pas modifiés.

## Objectifs

- conserver une lecture type roman plutôt qu'une messagerie ;
- borner la largeur de lecture sur tablette pour éviter les lignes trop longues ;
- renforcer la hiérarchie lieu → ambiance/période → récit ;
- rendre la zone de saisie plus éditoriale et moins formulaire ;
- garder l'or pour le récit et les décisions, le bleu pour l'IA et les états techniques ;
- conserver des cibles tactiles d'au moins 48 dp.

## Implémentation de cette passe

- cadre de lecture centré et limité à 980 px sur tablette ;
- liserés verticaux et filet doré très discret sur grand écran ;
- en-tête narratif compact avec marque Elyndor, lieu et ambiance/période ;
- suppression du libellé technique « Lecteur » au profit de « Récit » ;
- champ narratif sans label compact, sombre et focalisé en or ;
- aucune modification de la logique de génération ou de persistance.

## Suite visuelle

Les prochaines retouches pourront porter sur l'intégration des illustrations de scène et les derniers glyphes historiques encore directement présents dans ConversationScreen. Elles doivent rester isolées des composants moteur.