<p align="center">
  <img src="public/logo.svg" width="84" alt="Rumbleback">
</p>

<h1 align="center">Rumbleback</h1>

<p align="center"><strong>Jedes Erdbeben noch einmal abspielen. Sehen, wie viele Sekunden Sie hatten.</strong></p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-TW.md">zh-TW</a> | <a href="README.zh-CN.md">zh-CN</a> | <a href="README.ja.md">ja</a> | <a href="README.ko.md">ko</a> | <a href="README.es.md">es</a> | <a href="README.fr.md">fr</a> | <a href="README.de.md">de</a> | <a href="README.pt-BR.md">pt-BR</a>
</p>

<p align="center">
  <img src="assets/demo.gif" alt="Das Hualien-Erdbeben von 2024 (M7,4) im Replay: ein blauer P-Ring und ein oranger S-Ring laufen über Taiwan, Seismometer und Starkbebeninstrumente leuchten bei Eintreffen der Wellen auf, und eine Markierung auf Taipeh zeigt 20 Sekunden bis zur P-Welle und 36 bis zur S-Welle" width="100%">
</p>

**0,66 s mittlerer Fehler gegenüber 3.933 echten P-Einsätzen aus 14 Erdbeben.**
<sub>Beobachteter Einsatz minus erster P-Einsatz von iasp91, Stationen bis 95 Grad Entfernung, mit den Einsätzen, mit denen die USGS jedes Beben lokalisiert hat (M6,8 bis M9,1). Nachvollziehbar mit `npm run validate`. Einzelheiten in [docs/ACCURACY.md](docs/ACCURACY.md).</sub>

- **Keine Animation.** Jeder Punkt ist ein echtes Instrument, ein Einsatz oder ein Wahrnehmungsbericht der USGS. Die beiden Ringe stammen aus einem veröffentlichten Erdmodell, das ich an 600 Zufallspunkten mit ObsPy und bei jedem Beben mit echten Einsätzen vergleiche.
- **Keine Magnitude auf einer Karte.** Setzen Sie eine Markierung auf Ihr Zuhause und lesen Sie Ihre eigenen Zahlen: wann die P-Welle ankam, wann die S-Welle, wie stark es war und wie viele Sekunden eine Warnung zu einem beliebigen Zeitpunkt Ihnen gegeben hätte.
- **Kein Server.** Eine statische Seite. Kein Konto, keine Analyse, und Ihre Markierung verlässt den Browser nie.

## Ausprobieren

Öffnen Sie die **[Live-Seite](https://arthur031221.github.io/Rumbleback/)**. Sie startet mit dem Hualien-Beben von 2024 und spielt von selbst. Tippen Sie auf die Karte, um eine Markierung auf Ihr Zuhause zu setzen.

<details>
<summary><strong>Lokal ausführen (Node 22.18 oder neuer)</strong></summary>

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install && npm run build && npm run serve
```

http://127.0.0.1:4173/

</details>

## Was Sie bekommen

- **Wellen**: die ersten P- und S-Fronten an der Oberfläche, mit Herdtiefe, sodass ein tiefes Beben erst einen Ring zeigt, wenn die Welle an die Oberfläche kommt.
- **Seismometer**: ein Punkt, der aufleuchtet, wenn ein Analyst an einer echten Station den P-Einsatz gesetzt hat.
- **Punkt untersuchen**: Halten Sie die Maus auf einen aufgeleuchteten Punkt. Eine Station zeigt ihren Einsatz neben der Modellzeit, ein Instrument seine Intensität und Spitzenwerte, ein Wahrnehmungsbericht seine Anzahl.
- **ShakeMap**: die Intensitätskarte, die hinter der S-Welle sichtbar wird.
- **Echtes Seismogramm**: über der Zeitleiste die echte Vertikalbewegung einer nahen Station, mit dem modellierten P- und S-Einsatz und dem von einem Analysten gesetzten P-Einsatz.
- **Starkbeben und Wahrnehmung**: eingefärbt nach gemessener oder gemeldeter Intensität.
- **Blinde Zone**: der Bereich, in dem die S-Welle vor einer Warnung zum gewählten Zeitpunkt ankam.
- **Ihre Sekunden**: die Karte zur Markierung zeigt P- und S-Ankunft, die Differenz, die ShakeMap-Intensität dort und einen Regler für den Warnzeitpunkt. Das ist Rechnung am Modell, kein Protokoll einer echten Warnung.
- **Teilen**: ein Link, eine quadratische Karte, eine Hochformat-Karte und ein Videoclip, wenn der Browser es kann als MP4, damit er auf dem iPhone und in sozialen Apps läuft. Der Link lässt Ihre Markierung standardmäßig weg, und Karten zeigen einen Städtenamen.
- **Jedes Beben**: Die 14 ausgewählten Beben laufen ohne Anfrage an den USGS. Die Tabs Aktuell und Suche lesen den Live-Katalog des USGS, der Tab Link öffnet die Adresse einer USGS-Ereignisseite oder eine eingefügte ID, und das Seismogramm von EarthScope wird geladen, wenn es eines gibt.
- **Smartphone und Tastatur**: Auf dem Smartphone wird das Panel zu einem Bottom Sheet, der Seismogrammstreifen bleibt unter der Karte und Karten öffnen das System-Menü zum Teilen. Mit der Tastatur startet und pausiert die Leertaste, die Pfeiltasten gehen sekundenweise vor, Plus und Minus zoomen die Karte. Eine neue Markierung scrollt das Sheet zu ihren Zahlen, und ein Screenreader erfährt, wann P-Welle, S-Welle und Warnung die Markierung erreichen.
- **Ihre Zeitzone**: Die Bebenkarte nennt die Zeit in UTC und zusätzlich in Ihrer Zeitzone.
- **Neun Sprachen**, auch die Namen auf der Karte.

## Genauigkeit

Diese Zahlen zeigen, dass das Modell reproduziert, was echte Instrumente aufgezeichnet haben. Sie zeigen nicht, dass es ein unbekanntes Beben vorhersagt, weil die Einsätze und die Herdzeit der USGS aus denselben Daten stammen. Die USGS veröffentlicht kaum S-Einsätze, der S-Ring stammt also allein aus dem Modell, und die Seite sagt das bei jedem Beben.

## Häufige Befehle

`npm run build`, `npm run serve`, `npm test`, `npm run test:e2e`, `npm run validate`

Einzelheiten stehen in der englischen Dokumentation: [README.md](README.md), [docs/](docs/INSTALL.md), [CONTRIBUTING.md](CONTRIBUTING.md)

## Quellen

Erdbebendaten, Einsätze, ShakeMap und Wahrnehmungsberichte von der [USGS](https://earthquake.usgs.gov). Laufzeiten aus dem Modell iasp91 über [ObsPy TauP](https://docs.obspy.org/packages/obspy.taup.html). Kartenkacheln von [OpenFreeMap](https://openfreemap.org) mit Daten der OpenStreetMap-Mitwirkenden, gezeichnet mit [MapLibre GL JS](https://maplibre.org). Küstenlinien und Städtenamen von [Natural Earth](https://www.naturalearthdata.com). Vollständige Liste in [THIRD_PARTY.md](THIRD_PARTY.md).

## Lizenz

[MIT](LICENSE)
