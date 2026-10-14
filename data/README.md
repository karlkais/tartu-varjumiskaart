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

### Aluskaart

Alusandmed: **Maa- ja Ruumiamet, Eesti topograafia andmekogu (ETAK)**.
[Avalik WFS-teenus](https://gsavalik.envir.ee/geoserver/etak/wfs?service=WFS&request=GetCapabilities)
ja [kasutustingimused](https://geoportaal.maaruum.ee/est/teenused/wms-wfs-wcs-teenused/maa-ja-ruumiameti-kaarditeenuste-kasutustingimused-p24.html).
Kaardi kujundus on projekti enda oma. Laaditud 14.10.2026; see ei ole kõigi
objektide mõõdistamise või muutmise kuupäev.

| Kujutatud objektid | ETAK kiht | Algversiooni objekte |
| --- | --- | ---: |
| Puittaimestik | `e_305_puittaimestik_a` | 1303 |
| Seisuveekogud | `e_202_seisuveekogu_a` | 998 |
| Vooluveekogud | `e_203_vooluveekogu_a` | 112 |
| Hooned | `e_401_hoone_ka` | 33333 |
| Teed ja tänavanimed | `e_501_tee_j` | 20656 |
| Raudteed | `e_502_roobastee_j` | 159 |

Päringuala on linnaosade ulatus koos ligikaudu 3 km laiuse ümbrusega. WFS 2.0.0
kasutab GeoJSON-i ja CRS84 koordinaadijärjekorda (pikkus, laius). Päringutes valitakse
ainult kaardile vajalikud väljad; salvestuses ümardatakse koordinaadid kuue komakohani.
Kõiki kuut kihti laaditakse järjest, 1000 objekti kaupa ja ühe kattuva kontrollobjektiga.
Teenuse `numberMatched` võib piirduda 5000-ga; laadimine jätkub ka sellest edasi.
Kontrollitakse lehepiiri, ID-de järjekorda, geomeetriat ning kohustuslikke välju.
Alla 60% eelmise versiooni objektide arvust vähenev kiht lükatakse kaitseks tagasi.

`basemap-snapshot.json` sisaldab kõiki kuut kihti ja laadimisaega. Brauseris on
aluskaart varjumisandmetest eraldi IndexedDB kirjes. Üle kuue kalendrikuu vanune
versioon uuendatakse avamisel; nurjunud laadimine ei muuda eelmist versiooni ega
selle tähtaega. Uuemad varjumisandmed säilivad ka aluskaardi uuenduse tõrke korral.
MapLibre joonistab kohalikud andmed ja kasutab seadme fonte; välist stiili-, fondi-
ega kaardipilditeenust ei kasutata. WebGL-i puudumisel kasutatakse lihtsustatud
Canvas-aluskaarti ilma tänavanimedeta. Linnamask põhineb Tartu linnaosade ühendil,
mitte kogu Tartu omavalitsuse, sealhulgas maapiirkondade, piiridel.

### Varjumisandmed

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
