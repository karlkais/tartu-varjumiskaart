# Andmed ja arvutus

Kaardi algandmed pärinevad [Tartu avaandmete portaalist](https://geohub.tartulv.ee/pages/avaandmed)
ja asuvad kaustas `raw`.

| Kaust | Sisu |
| --- | --- |
| `raw/linnaosa_piir` | Tartu linnaosade piirid Shapefile'ina koos kaasfailide ja metaandmetega. |
| `raw/2025_rahvastik_100m_andmed` | 2025. aasta rahvastik 100 m ruudustikus. |
| `raw/varjumiskohad` | Avalike varjumiskohtade GeoJSON, sh nimetused, aadressid, mahutavus ja tunnus `Toimiv`. |
| `raw/veekogud` | Tartu `KT_veekogud` kihi GeoJSON failis `veekogud.geojson`. |

Linnaosade piirid ja rahvastik on salvestatud Shapefile'idena, varjumiskohad ning
veekogud ametlike kihtide REST-teenustest GeoJSON-ina. Rahvastiku võrdlusaasta on
2025. Andmete täpne allalaadimise kuupäev pole teada; kihid ei uuene automaatselt.

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
salvestatud andmeid.
