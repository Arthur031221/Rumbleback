# Third-party software and data

Rumbleback ships or reads the following. Each keeps its own license.

| What | Used for | License |
|---|---|---|
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | Map rendering | BSD-3-Clause |
| [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) | Reading the USGS phase data (QuakeML) | MIT |
| [Bricolage Grotesque](https://github.com/ateliertriay/bricolage) via Fontsource | Interface font | SIL OFL 1.1 |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) via Fontsource | Numbers | SIL OFL 1.1 |
| [Phosphor Icons](https://phosphoricons.com) | Icons | MIT |
| [ObsPy](https://github.com/obspy/obspy) TauP | Building the travel-time tables and checking them (development only) | LGPL-3.0, not shipped |
| iasp91 Earth model, Kennett and Engdahl (1991) | Travel times | Published model |
| [USGS Earthquake Hazards Program](https://earthquake.usgs.gov) | Event catalog, phase picks, ShakeMap, Did You Feel It | US government work, public domain |
| [EarthScope](https://www.earthscope.org) data services | Seismograms of one station per quake (the featured quakes ship a condensed copy) | Open data, provided by the EarthScope Consortium |
| [Natural Earth](https://www.naturalearthdata.com) | Coastlines and city names | Public domain |
| [OpenFreeMap](https://openfreemap.org) and OpenMapTiles | Map tiles and labels | OpenMapTiles schema, data from OpenStreetMap contributors (ODbL) |

The coastline file and the city list in `public/data` are built from Natural Earth by `scripts/make-data.mjs`.
The featured earthquakes in `public/events` are copies of USGS products, reduced to what the replay draws.
