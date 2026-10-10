<p align="center">
  <img src="public/logo.svg" width="84" alt="Rumbleback">
</p>

<h1 align="center">Rumbleback</h1>

<p align="center"><strong>Rejouez n'importe quel séisme. Voyez vos secondes.</strong></p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-TW.md">zh-TW</a> | <a href="README.zh-CN.md">zh-CN</a> | <a href="README.ja.md">ja</a> | <a href="README.ko.md">ko</a> | <a href="README.es.md">es</a> | <a href="README.fr.md">fr</a> | <a href="README.de.md">de</a> | <a href="README.pt-BR.md">pt-BR</a>
</p>

<p align="center">
  <img src="assets/demo.gif" alt="Le séisme de Hualien de 2024 (M7,4) rejoué : un anneau bleu pour l'onde P et un anneau orange pour l'onde S traversent Taïwan, les sismomètres et les accéléromètres s'allument à leur arrivée, et une épingle sur Taipei montre 20 secondes jusqu'à l'onde P et 36 jusqu'à l'onde S" width="100%">
</p>

**0,66 s d'erreur médiane face à 3 933 vraies lectures de l'onde P de 14 séismes.**
<sub>Arrivée observée moins la première arrivée P d'iasp91, stations jusqu'à 95 degrés, avec les lectures que l'USGS a utilisées pour localiser chaque séisme (M6,8 à M9,1). Reproductible avec `npm run validate`. Détails dans [docs/ACCURACY.md](docs/ACCURACY.md).</sub>

- **Pas une animation.** Chaque point est un vrai instrument, une lecture ou un témoignage de l'USGS. Les deux anneaux viennent d'un modèle de Terre publié que je compare à ObsPy sur 600 points au hasard et à de vraies lectures pour chaque séisme.
- **Pas une magnitude sur une carte.** Posez une épingle sur votre maison et lisez vos propres chiffres : quand l'onde P est arrivée, quand l'onde S est arrivée, la force de la secousse, et combien de secondes une alerte émise à n'importe quel moment vous aurait données.
- **Pas un serveur.** Une page statique. Aucun compte, aucune analyse, et votre épingle ne quitte jamais le navigateur.

## Essayer

Ouvrez la **[page en ligne](https://arthur031221.github.io/Rumbleback/)**. Elle démarre sur le séisme de Hualien de 2024 et se joue seule. Touchez la carte pour poser une épingle sur votre maison.

<details>
<summary><strong>Lancer en local (Node 22.18 ou plus récent)</strong></summary>

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install && npm run build && npm run serve
```

http://127.0.0.1:4173/

</details>

## Ce que vous obtenez

- **Ondes** : les premiers fronts P et S à la surface, en tenant compte de la profondeur, donc un séisme profond n'affiche pas d'anneau tant que l'onde n'est pas remontée.
- **Sismomètres** : un point qui s'allume au moment où un analyste a pointé l'arrivée P sur une vraie station.
- **Inspecter un point** : posez la souris sur un point allumé. Une station donne son pointé à côté du temps du modèle, un instrument son intensité et ses valeurs maximales, un témoignage son nombre.
- **ShakeMap** : la carte d'intensité, dévoilée derrière l'onde S.
- **Vrai sismogramme** : au-dessus de la frise, le mouvement vertical réel d'une station proche, avec l'arrivée modélisée de P et de S et l'arrivée de P pointée par un analyste.
- **Mouvements forts et témoignages** : colorés selon l'intensité mesurée ou déclarée.
- **Zone aveugle** : la zone où l'onde S est arrivée avant une alerte émise au moment que vous choisissez.
- **Vos secondes** : la carte de l'épingle donne l'arrivée de P et de S, leur écart, l'intensité ShakeMap à cet endroit et un curseur pour l'heure de l'alerte. C'est de l'arithmétique sur le modèle, pas l'enregistrement d'une alerte réelle.
- **Partager** : un lien, une carte carrée, une carte verticale et un clip vidéo, enregistré en MP4 quand le navigateur le peut, pour qu'il se lise sur un iPhone et dans les applications sociales. Le lien laisse votre épingle de côté par défaut et les cartes montrent un nom de ville.
- **N'importe quel séisme** : les 14 séismes à la une se lisent sans appeler l'USGS. Les onglets Récents et Recherche lisent le catalogue USGS en direct, l'onglet Lien ouvre l'adresse d'une page d'événement USGS ou un identifiant que vous collez, et le sismogramme d'EarthScope est chargé quand il existe.
- **Téléphone et clavier** : sur un téléphone, le panneau devient une feuille en bas, la bande du sismogramme reste sous la carte et les cartes ouvrent le menu de partage du système. Au clavier, la barre d'espace lance et met en pause, les flèches avancent d'une seconde et plus et moins zooment la carte. Une nouvelle épingle amène la feuille à ses chiffres, et un lecteur d'écran est prévenu quand l'onde P, l'onde S et l'alerte atteignent l'épingle.
- **Votre fuseau horaire** : la fiche du séisme donne l'heure en UTC et aussi dans votre fuseau horaire.
- **Neuf langues**, y compris les noms sur la carte.

## Précision

Ces chiffres montrent que le modèle reproduit ce que de vrais instruments ont enregistré. Ils ne montrent pas qu'il prévoit un séisme qu'il n'a pas vu, car les lectures et l'heure d'origine de l'USGS viennent des mêmes données. L'USGS publie presque aucune lecture de l'onde S, l'anneau S vient donc du seul modèle, et la page le dit pour chaque séisme.

## Commandes courantes

`npm run build`, `npm run serve`, `npm test`, `npm run test:e2e`, `npm run validate`

Pour le détail, voir la documentation en anglais : [README.md](README.md), [docs/](docs/INSTALL.md), [CONTRIBUTING.md](CONTRIBUTING.md)

## Crédits

Données de séismes, lectures, ShakeMap et témoignages de l'[USGS](https://earthquake.usgs.gov). Temps de trajet du modèle iasp91 via [ObsPy TauP](https://docs.obspy.org/packages/obspy.taup.html). Tuiles de [OpenFreeMap](https://openfreemap.org) avec des données des contributeurs d'OpenStreetMap, dessinées par [MapLibre GL JS](https://maplibre.org). Côtes et noms de villes de [Natural Earth](https://www.naturalearthdata.com). Liste complète dans [THIRD_PARTY.md](THIRD_PARTY.md).

## Licence

[MIT](LICENSE)
