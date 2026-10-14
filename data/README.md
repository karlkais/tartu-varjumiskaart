# Andmed ja arvutus

Andmed pärinevad [Tartu avaandmete portaalist](https://geohub.tartulv.ee/pages/avaandmed)
ja on kopeeritud olemasoleva kodutöö kaustast muutmata kujul.

| Kaust | Sisu |
| --- | --- |
| `ylesanne1/linnaosa_piir` | Tartu linnaosade piirid Shapefile'ina koos kaasfailide ja metaandmetega. |
| `ylesanne1/2025_rahvastik_100m_andmed` | 2025. aasta rahvastik 100 m ruudustikus. |
| `ylesanne1/varjumiskohad` | Avalike varjumiskohtade GeoJSON, sh nimetused, aadressid, mahutavus ja tunnus `Toimiv`. |
| `ylesanne1/veekogud` | Tartu `KT_veekogud` kihi GeoJSON; algne failinimi on `veekogud.geojson.txt`. |

Algse lähtekoodi järgi laaditi linnaosade piirid ja rahvastik alla Shapefile'idena,
varjumiskohad ning veekogud salvestati ametlike kihtide REST-teenustest GeoJSON-ina.
Täpsed REST-päringud ja allalaadimise kuupäev ei olnud lähteprojektis dokumenteeritud.

## Koormussuhte mudel

1. Andmed teisendatakse analüüsi jaoks Eesti tasapinnalisse koordinaatsüsteemi EPSG:3301.
2. Rahvastikuruudud lõigatakse Tartu linnaosade piiridega. Piiril oleva ruudu rahvaarvu
   vähendatakse alles jäänud pindala osakaalu järgi.
3. Kaardile valitakse linnaosades asuvad varjumiskohad, mille `Toimiv == 1`.
4. Iga rahvastikuruudu sisepunkt määratakse geomeetriliselt lähimale teadaoleva
   positiivse mahutavusega varjumiskohale. Teekonda mööda tänavavõrku ei arvutata.
5. Varjumiskoha koormussuhe = sellele määratud elanike arv / mahutavus.
6. Koormusklassid on madal `< 0,75`, piiril `0,75–1,25` ja kõrge `> 1,25`.
   Puuduva või mittepositiivse mahutavusega kohad kuvatakse eraldi kihina.
7. Veebikaardi jaoks teisendatakse kihid WGS84 koordinaatidesse (EPSG:4326).

Rahvastik kirjeldab elukohti. Mudel ei arvesta päevast liikumist, tänavavõrku,
sissepääsude kasutatavust ega kohtade tegelikku täituvust. `Toimiv` kajastab
salvestatud andmeid. Selle repo avaldamine ei tähenda andmete ajakohastamist.
