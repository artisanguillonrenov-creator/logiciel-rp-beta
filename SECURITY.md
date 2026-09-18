# Sécurité

Merci de signaler les vulnérabilités de manière responsable. **Ne publie jamais une clé API, une histoire privée, un jeton GitHub ou une capture contenant des données sensibles dans une issue publique.**

Pour un signalement privé, utilise la fonction **Private vulnerability reporting** de GitHub si elle est activée sur le dépôt. À défaut, contacte le mainteneur par un canal privé associé au compte GitHub `artisanguillonrenov-creator` et indique :

- la version ou la révision concernée ;
- les étapes minimales pour reproduire le problème ;
- l’impact observé ;
- une proposition de correctif si tu en as une.

Le projet étant une application cliente, les signalements concernant l’exposition de clés, l’envoi involontaire de données à un fournisseur, les migrations destructrices, l’exécution de code importé ou un contournement des contrôles de contenu sont prioritaires.

Les clés API ne doivent jamais être ajoutées au dépôt. Si une clé a été exposée, révoque-la immédiatement auprès du fournisseur puis remplace-la dans l’application. Les tests et fixtures doivent utiliser des valeurs fictives.
