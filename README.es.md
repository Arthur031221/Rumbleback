<p align="center">
  <img src="public/logo.svg" width="84" alt="Rumbleback">
</p>

<h1 align="center">Rumbleback</h1>

<p align="center"><strong>Reproduce cualquier terremoto. Mira tus segundos.</strong></p>

<p align="center">Elige un terremoto real, marca tu casa en el mapa y mira cuántos segundos pasaron entre la primera onda y la sacudida fuerte.</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-TW.md">zh-TW</a> | <a href="README.zh-CN.md">zh-CN</a> | <a href="README.ja.md">ja</a> | <a href="README.ko.md">ko</a> | <a href="README.es.md">es</a> | <a href="README.fr.md">fr</a> | <a href="README.de.md">de</a> | <a href="README.pt-BR.md">pt-BR</a>
</p>

<p align="center">
  <a href="https://arthur031221.github.io/Rumbleback/"><img src="assets/demo.gif" alt="El terremoto de Hualien de 2024 (M7.4) reproducido: un anillo azul de la onda P y uno naranja de la onda S cruzan Taiwán, los sismómetros y los acelerógrafos se encienden cuando llegan, y un marcador en Taipéi muestra 20 segundos hasta la onda P y 36 hasta la onda S" width="100%"></a>
</p>

**0,66 s de error mediano frente a 3.933 lecturas reales de la onda P de 14 terremotos.**
<sub>Llegada observada menos la primera llegada P de iasp91, estaciones hasta 95 grados de distancia, con las lecturas que USGS usó para localizar cada sismo (M6.8 a M9.1). Se reproduce con `npm run validate`. Los detalles están en [docs/ACCURACY.md](docs/ACCURACY.md).</sub>

- **No es una animación.** Cada punto es un instrumento, una lectura o un reporte de sensación reales de USGS. Los dos anillos salen de un modelo terrestre publicado que comparo con ObsPy en 600 puntos al azar y con lecturas reales en cada sismo.
- **No es una magnitud sobre un mapa.** Pon un marcador en tu casa y lee tus propios números: cuándo llegó la onda P, cuándo la S, qué tan fuerte fue y cuántos segundos te habría dado una alerta emitida en cualquier momento.
- **No es un servidor.** Es una página estática. Sin cuenta, sin analítica, y tu marcador nunca sale del navegador.

## Elige una historia

Cada enlace abre la página en vivo con un sismo y un marcador ya puesto en una ciudad, y la reproducción empieza sola. Los tiempos de P y S son los del modelo y la sacudida es la del ShakeMap del USGS, las mismas cifras que muestra la tarjeta del marcador.

| Sismo | Marcador | Onda P | Onda S | Sacudida allí |
|---|---|---:|---:|---|
| [2011 Tohoku, Japón](https://arthur031221.github.io/Rumbleback/?event=official20110311054624120_30#pin=35.69,139.75), M9.1 | Tokio, 372 km | 50 s | 90 s | MMI 6,8 |
| [2025 Mandalay, Myanmar](https://arthur031221.github.io/Rumbleback/?event=us7000pn9s#pin=13.75,100.5), M7.7 | Bangkok, 1038 km | 135 s | 241 s | MMI 4,6 |
| [2010 Maule, Chile](https://arthur031221.github.io/Rumbleback/?event=official20100227063411530_30#pin=-33.45,-70.67), M8.8 | Santiago de Chile, 360 km | 49 s | 88 s | MMI 7,5 |
| [2024 Hualien, Taiwán](https://arthur031221.github.io/Rumbleback/?event=us7000m9g4#pin=25.03,121.56), M7.4 | Taipéi, 133 km | 20 s | 36 s | MMI 5,9 |

## Pruébalo

Abre la **[página en vivo](https://arthur031221.github.io/Rumbleback/)**. Empieza con el terremoto de Hualien de 2024 y se reproduce sola. Toca el mapa para poner un marcador en tu casa.

<details>
<summary><strong>Ejecutarlo en local (Node 22.18 o superior)</strong></summary>

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install && npm run build && npm run serve
```

http://127.0.0.1:4173/

</details>

## Qué ofrece

- **Ondas**: los primeros frentes P y S en la superficie, con la profundidad en cuenta, así que un sismo profundo no muestra anillo hasta que la onda sale a la superficie.
- **Sismómetros**: un punto que se enciende en el momento en que un analista marcó la llegada P en una estación real.
- **Inspeccionar un punto**: apoya el ratón en un punto encendido. Una estación muestra su marca junto al tiempo del modelo, un instrumento su intensidad y sus valores máximos, y un reporte de sensación su cantidad. La tarjeta de comprobación con datos reales lista diez estaciones en una tabla, que llega al teclado y a la pantalla táctil.
- **ShakeMap**: el mapa de intensidad, que se revela detrás de la onda S.
- **Sismograma real**: sobre la línea de tiempo se dibuja el movimiento vertical real de una estación cercana, con la llegada modelada de P y S y la llegada de P marcada por un analista.
- **Movimiento fuerte y sensación reportada**: coloreados por la intensidad medida o reportada. Una escala de colores aparece en la tarjeta del terremoto.
- **Zona ciega**: el área donde la onda S llegó antes que una alerta emitida en el momento que elijas.
- **Tus segundos**: la tarjeta del marcador da la llegada de P y S, la diferencia, la intensidad de ShakeMap en ese punto y un deslizador para la hora de la alerta. Es aritmética sobre el modelo, no el registro de ninguna alerta real. Un botón reproduce de nuevo las ondas desde justo antes de que lleguen a tu marcador.
- **Compartir**: un enlace, una tarjeta cuadrada, una tarjeta vertical y un video grabado, guardado como MP4 si el navegador puede, para que se reproduzca en un iPhone y en las redes sociales. El enlace deja fuera tu marcador por defecto y las tarjetas muestran el nombre de una ciudad.
- **Cualquier terremoto**: los 14 destacados se reproducen sin consultar al USGS. Las pestañas Recientes y Buscar leen el catálogo del USGS en vivo, la pestaña Enlace abre la dirección de una página de evento del USGS o un id que pegues, y el sismograma de EarthScope se carga cuando existe.
- **Móvil y teclado**: en el móvil el panel pasa a ser una hoja inferior, la franja del sismograma se queda bajo el mapa y las tarjetas abren el menú de compartir del sistema. Con teclado, la barra espaciadora reproduce y pausa, las flechas avanzan de segundo en segundo y más y menos acercan o alejan el mapa. Un marcador nuevo lleva la hoja hasta sus números. Con el móvil en horizontal el panel se queda a un lado y el mapa conserva su espacio. Un lector de pantalla oye cuándo llegan al marcador la onda P, la onda S y la alerta.
- **Tu zona horaria**: la tarjeta del terremoto da la hora en UTC y también en tu zona horaria.
- **Nueve idiomas**, incluidos los nombres del mapa.

## Precisión

Estas cifras muestran que el modelo reproduce lo que registraron instrumentos reales. No muestran que prediga un sismo que no ha visto, porque las lecturas y la hora de origen de USGS salen de los mismos datos. USGS publica casi ninguna lectura de la onda S, así que el anillo S es solo el modelo, y la página lo dice en cada sismo.

## Comandos habituales

`npm run build`, `npm run serve`, `npm test`, `npm run test:e2e`, `npm run validate`

Para el detalle, consulta la documentación en inglés: [README.md](README.md), [docs/](docs/INSTALL.md), [CONTRIBUTING.md](CONTRIBUTING.md)

## Créditos

Datos de terremotos, lecturas, ShakeMap y reportes de sensación del [USGS](https://earthquake.usgs.gov). Tiempos de viaje del modelo iasp91 con [ObsPy TauP](https://docs.obspy.org/packages/obspy.taup.html). Mosaicos de [OpenFreeMap](https://openfreemap.org) con datos de colaboradores de OpenStreetMap, dibujados con [MapLibre GL JS](https://maplibre.org). Costas y nombres de ciudades de [Natural Earth](https://www.naturalearthdata.com). Lista completa en [THIRD_PARTY.md](THIRD_PARTY.md).

## Licencia

[MIT](LICENSE)

Assisted by Claude/Codex.
