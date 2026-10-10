# Changelog

## 0.1.0

First public version.

- Replays a real earthquake as P and S wavefronts on a map. The travel times are the iasp91 first arrivals
  from ObsPy TauP, interpolated for the quake's depth.
- Real data from USGS: analyst P picks lighting up at their observed time, ShakeMap intensity,
  strong motion instruments with their measured intensity, and Did You Feel It reports.
- A strip above the timeline draws the real seismogram of a nearby station from EarthScope, with the model's P and S arrival and the analyst's pick over it.
- A pin on your home gives the P and S arrival, the gap between them and the ShakeMap intensity there,
  and an alert slider that shows the warning time or the blind zone.
- A check card that compares the model with the picks USGS used, for every quake.
- Fourteen featured earthquakes that work without a network call to USGS, plus recent and searchable
  quakes from the USGS catalog.
- Share links, square and story cards and a recorded video clip, none of which include coordinates by default.
- Nine languages: English, Traditional Chinese, Simplified Chinese, Japanese, Korean, Spanish, French,
  German and Brazilian Portuguese.
- The travel-time and parsing code is a small library, built as `dist/rumbleback.js`.
