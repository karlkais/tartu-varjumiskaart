# Andmed ja arvutus

Kaart kasutab [Tartu avaandmete portaali](https://geohub.tartulv.ee/pages/avaandmed)
ametlikke ArcGIS-teenuseid. Kõigi nelja kihi andmed laaditakse kuue kuu möödumisel
kaardi avamisel uuesti ning arvutused tehakse tervikuna uuesti.

## Andmeallikad

| Kiht | Teenus ja kasutatavad väljad |
| --- | --- |
| Varjumiskohad | [KR_valmisolek, kiht 11](https://gis.tartulv.ee/arcgis/rest/services/Kriisijuhtimine/KR_valmisolek/FeatureServer/11): `OBJECTID`, `Nimetus`, `Aadress`, `Mahutavus`, `Toimiv`. |
| Linnaosad | [KT_haldusjaotus, kiht 1](https://gis.tartulv.ee/arcgis/rest/services/Aluskaardid/KT_haldusjaotus/FeatureServer/1): `OBJECTID`, `NIMI`. |
| Veekogud | [KT_veekogud, kiht 0](https://gis.tartulv.ee/arcgis/rest/services/Aluskaardid/KT_veekogud/FeatureServer/0): `OBJECTID`, `Nimi`. |
| Rahvastik | [2026. aasta 100 m ruudustik](https://gis.tartulv.ee/arcgis/rest/services/Hosted/Rahvastik_2026_100m_Kuvamine/FeatureServer/0): `objectid`, `sum_sum_kokku`. Uuendamisel leitakse uusim sobiv aastakiht kataloogist. |

Rahvastikukihti otsitakse [Tartu andmekataloogist](https://gis.tartulv.ee/portal/sharing/rest/search?f=pjson&q=rahvastik*).
Valitakse Tartu ametliku serveri uusim, mitte tulevikus olev aastakiht, mille
pealkirjas on rahvastik, 100 m ja andmed, ning kontrollitakse polügoonikihti ja
välja `sum_sum_kokku`. Kui teenuse ülesehitus muutub, jäetakse vana kaart alles ja
kuvatakse tõrge. See kaitseb sobimatu või pooliku andmekihi kasutamise eest.

Päringud tagastavad WGS84 GeoJSON-i. Kõik objektid laaditakse ID järgi järjestatud
lehekülgedena; kontrollitakse koguarvu, kordumatuid tunnuseid, välju ja koordinaate.
Rahvastikukihi 1000 objekti päringupiir ei jäta ülejäänud ruute välja.

## Salvestised

- `source-snapshot.json`: veebiga kaasas oleva algversiooni kõik neli lähtekihti,
  teenuste aadressid, rahvastikuaasta ja laadimise aeg. Salvestatud 14.10.2026.
- `../docs/snapshot.json`: nendest lähteandmetest arvutatud kaardikihid ja viimane
  eduka uuendamise aeg. Praeguses versioonis 27 varjumiskohta ja 1832 rahvastikuruutu.
- `raw/`: varasemate lähteandmete arhiiv, sh 2025. aasta rahvastiku Shapefile,
  linnaosade piirid ning varjumiskohtade ja veekogude GeoJSON. Nende failide algne
  allalaadimiskuupäev pole teada; brauser kasutab uut salvestist ja ametlikke teenuseid.

Brauseris salvestatakse terviklik uuendatud kaart IndexedDB-sse. Laadimisel valitakse
uusim sobiva skeemi ja mudeliversiooniga veebisalvestis või brauserisalvestis. Viimase
eduka uuenduse ajatempel muutub alles pärast kõigi kihtide laadimist, arvutust ja
valideerimist. Püsisalvestuse tõrkest antakse eraldi teada. Ühes brauseris koordineerivad
vahekaardid uuendamist Web Locks API abil; andmehoidla ei lase vanal versioonil uut üle kirjutada.

Tähtaeg on kuus **kalendrikuud** UTC järgi, kuu lõpus viimasele olemasolevale päevale
piiratuna (nt 31. august → 28./29. veebruar). Täpselt tähtajal veel ei uuendata,
vaid alles sellest üle minnes. Avatud lehel taimeriga päringuid ei tehta.

## Koormussuhte mudel

1. Andmed teisendatakse Eesti tasapinnalisse koordinaatsüsteemi EPSG:3301.
2. Linnaosad ühendatakse linnamaskiks. Rahvastikuruudud lõigatakse selle piiridega;
   piiril oleva ruudu rahvaarvu kaalutakse alles jäänud pindala osakaaluga.
3. Kaardile valitakse maski sees olevad varjumiskohad, mille `Toimiv == 1`.
4. Iga rahvastikuruudu sisepunkt määratakse geomeetriliselt lähimale teadaoleva
   positiivse mahutavusega varjumiskohale. Teekonda tänavatel ei arvutata.
5. Koormussuhe = varjumiskohale määratud elanike arv / mahutavus.
6. Koormusklassid: madal `< 0,75`, piiril `0,75–1,25`, kõrge `> 1,25`.
   Puuduva või mittepositiivse mahutavusega kohad kuvatakse eraldi, neile elanikke ei määrata.
7. Veekogud lõigatakse linnamaskiga ning kaardikihid teisendatakse tagasi WGS84-sse.

Brauseris kasutatakse JSTS-i ja Proj4js-i. Kehtetuid pindgeomeetriaid proovitakse
parandada nullpuhvriga; parandamatu geomeetria või arvutusviga katkestab uuenduse.
Tulemuste kontroll võrdleb määratud elanike summat ruutude rahvaarvuga.
Sõltumatu R/sf/GEOS-i võrdlus on failis `../tests/reference.json`.

Rahvastik kirjeldab elukohti. Mudel ei arvesta päevast liikumist, tänavavõrku,
sissepääsude kasutatavust ega kohtade tegelikku täituvust. `Toimiv` kajastab
andmeallika viimase eduka laadimise seisu.
