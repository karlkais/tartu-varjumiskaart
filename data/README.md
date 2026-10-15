# Andmed ja arvutus

Kaart kasutab [Tartu avaandmete portaali](https://geohub.tartulv.ee/pages/avaandmed)
ametlikke ArcGIS-teenuseid ja Päästeameti avalikku CSV-d. Põhikihtide andmed laaditakse kuue kuu möödumisel
kaardi avamisel uuesti ning arvutused tehakse tervikuna uuesti.

## Andmeallikad

| Kiht | Teenus ja kasutatavad väljad |
| --- | --- |
| Varjumiskohad | [KR_valmisolek, kiht 11](https://gis.tartulv.ee/arcgis/rest/services/Kriisijuhtimine/KR_valmisolek/FeatureServer/11): `OBJECTID`, `Nimetus`, `Aadress`, `Mahutavus`, `Toimiv`. |
| Riiklikud varjumiskohad | [Päästeameti CSV](https://opendata.smit.ee/gis/varjumiskohad.csv): `id`, `nimi`, `aadress`, `tyyp`, `lest_x`, `lest_y`. Mahutavust ei sisalda. |
| Linnaosad | [KT_haldusjaotus, kiht 1](https://gis.tartulv.ee/arcgis/rest/services/Aluskaardid/KT_haldusjaotus/FeatureServer/1): `OBJECTID`, `NIMI`. |
| Veekogud | [KT_veekogud, kiht 0](https://gis.tartulv.ee/arcgis/rest/services/Aluskaardid/KT_veekogud/FeatureServer/0): `OBJECTID`, `Nimi`. |
| Rahvastik | [2026. aasta 100 m ruudustik](https://gis.tartulv.ee/arcgis/rest/services/Hosted/Rahvastik_2026_100m_Kuvamine/FeatureServer/0): `objectid`, `sum_sum_kokku`. Uuendamisel leitakse uusim sobiv aastakiht kataloogist. |

Rahvastikukihti otsitakse [Tartu andmekataloogist](https://gis.tartulv.ee/portal/sharing/rest/search?f=pjson&q=rahvastik*).
Valitakse Tartu ametliku serveri uusim, mitte tulevikus olev aastakiht, mille
pealkirjas on rahvastik, 100 m ja andmed, ning kontrollitakse polügoonikihti ja
välja `sum_sum_kokku`. Kui teenuse ülesehitus muutub, jäetakse vana kaart alles ja
kuvatakse tõrge. See kaitseb sobimatu või pooliku andmekihi kasutamise eest.

Tartu päringud tagastavad WGS84 GeoJSON-i. Kõik objektid laaditakse ID järgi järjestatud
lehekülgedena; kontrollitakse koguarvu, kordumatuid tunnuseid, välju ja koordinaate.
Rahvastikukihi 1000 objekti päringupiir ei jäta ülejäänud ruute välja.

Päästeameti UTF-8 CSV kasutab semikoolonit. `lest_x` on põhjakoordinaat ja `lest_y`
idakoordinaat; teisendus EPSG:3301-st WGS84-sse kasutab järjekorda `[lest_y, lest_x]`.
Kontrollitakse kohustuslikke välju, unikaalseid ID-sid, koordinaate ja CSV terviklikkust.
Mõlema allika punktid piiratakse sama linnamaskiga ning ühendatakse
[dokumenteeritud reeglitega](SHELTER-RECONCILIATION.md). Andmeallika puudumine või
vigane CSV katkestab uuenduse: ainult Tartu andmetega asendust ei avaldata.

## Rahvastiku katvus ja võrdlus

2026. aasta kihi [allikakirjeldus](https://gis.tartulv.ee/portal/sharing/rest/content/items/dccbfba5b46f4bb79d0bb64f8b3a0d16?f=pjson)
ütleb, et privaatsuse kaitseks on ühe majapidamise elanike arvu avaldavad alad eemaldatud.
Neid ei käsitleta nullrahvastikuna ega taastata hinnanguliselt. Mudeli summa on
82 797,9766 inimest; [2026. aasta linnaosade koondkihi](https://gis.tartulv.ee/arcgis/rest/services/Hosted/2026_rahvastik_linnaosa_andmed/FeatureServer/0)
summa on 91 634. Erinevus on 9,64%, kuid seda mõjutavad ka piirkonnapiirid ja agregeerimine.

Uuendamisel säilitatakse `populationContext.source` allikakirjeldus, pealkiri,
kataloogitunnus, teenuse aadress, kataloogikirje muutmise aeg ja laadimise aeg.
Kataloogist otsitakse **sama aasta** linnaosade rahvastiku koondkihti (`nimi`,
`sum_sum_kokku`); teise aasta andmetega võrdlust ei tehta. Selle lähteobjektid ja
päritolu salvestatakse `data/source-snapshot.json` välja `populationContext.comparison`.
Ebaõnnestunud võrdlus ei takista põhikihtide laadimist: põhjendus salvestatakse
ja kasutajale näidatakse võrdluse puudumist.

Kaardisalvestise `populationContext.comparison.districts` iga rea avaldatud rahvastik
arvutatakse algse avaliku rahvastikukihi lõikamisel **koondkihi enda linnaosapiiridega**,
EPSG:3301 pindala osakaalu järgi. Võrdluspiirkond peab katma vähemalt 95% kaardimaski
pindalast ja iga võrdluslinnaosa peab vähemalt 95% ulatuses jääma kaardimaski sisse.
See geograafiline sobivuskontroll ei tõenda lähteandmete täielikkust. Tabeli ridade
summa võib kaardimudeli summast veidi erineda, sest kaardimudel kasutab eraldi piirikihi
ühendit. Osakaal on arvutatud võrdlusnäitaja, mitte ametlik katvusprotsent; seda ei
kasutata koormuste korrigeerimiskordajana. Nullise koondarvu puhul osakaalu ei kuvata.

Rahvastikukihi hall taust näitab kohti, kus kuvatavas kihis avaldatud rahvaarv puudub.
Avaldatud nullväärtusega alad säilitatakse eraldi `layers.zeroPopulation` kihis; neile
elanikke ega varjumiskohta ei määrata. Varem loodud salvestised jäävad loetavaks,
kuid puuduvaid katvuse metaandmeid näidatakse puuduvana. Sama uuendusajaga salvestistest
eelistatakse seda, milles kontrollitud võrdlus on olemas. R/sf-võrdlus kontrollib nii
varjumiskohtade koormusi kui ka iga linnaosa avaldatud rahvastiku summat.

## Salvestised

### Andmekvaliteedi kontroll

Lähte- ja tulemkihtide kontrollid nõuavad kordumatuid mittetühje tunnuseid,
kihile sobivaid geomeetriatüüpe, suletud vähemalt kolme eri tipuga pindringi,
lõplikke koordinaate ja mittenegatiivseid arve. Tartu lähtekihtide lubatud
ulatus on `[26.2, 58.1, 27.1, 58.7]`, linnaga lõigatud väljundil
`[26.55, 58.25, 26.95, 58.5]` (WGS84 pikkus/laius); need on veakaitsepiirid,
mitte halduspiirid. Riikliku punktikihi kontroll hõlmab kogu Eestit.
Mahutavus peab olema täisarv, null või teadmata. Elanikke võib määrata ainult
positiivse mahutavusega kohale. Iga koha `assigned` peab ühtima sellele määratud
alade elanike summaga 0,01 inimese piires; kontrollitakse ka üldsummat, koormussuhet
ja koormusklassi. Nullrahvastiku alade tunnused ei tohi positiivsete aladega korduda.
Uued salvestised säilitavad ka linnaosade ja veekogude lähtetunnused; vanad ilma
nende tunnusteta salvestised on endiselt loetavad, kui kiht pole osaliselt täidetud.

`quality` säilitab lähtekihtide objektide arvu ja rahvaarvu ning iga kaardilinnaosa
pindala, avaldatud rahvastikualade pindala ja pindalaga kaalutud rahvaarvu.
Linnaosade elanike summa peab klappima mudeli üldsummaga (tolerants 0,1 inimest).
Need linnaosad on kaardi piirikihist; F1 võrdlustabeli koondkihi piirid võivad erineda.

Uuendamisel võrreldakse eelmise toimiva versiooniga järgmisi näitajaid. Suhtarv
väljaspool tabeli vahemikku katkestab automaatse uuenduse, ka uuele rahvastikuaastale
üleminekul. Need on projekti tehnilised ülevaatuslävendid, mitte ametlikud
rahvastikumuutuse hinnangud ega täielikkuse tõend.

| Näitaja | Lubatud uue/vana suhe |
| --- | --- |
| Lähtekihtide objektide arv (sh riiklikud punktid linnamaskis) | 0,80–1,50 |
| Kaardi rahvastikualade, varjumiskohtade ja positiivse mahutavusega kohtade arv | 0,80–1,50 |
| Lähtekihi ja mudeli elanike summa | 0,85–1,25 |
| Mahutavuste summa | 0,75–1,50 |
| Kaardiga lõigatud veekogude arv | 0,50–2,00 |
| Iga linnaosa pindala | 0,95–1,05 |
| Iga linnaosa elanikud ja avaldatud rahvastikualade pindala | 0,75–1,50 |

Nullist positiivseks muutuv näitaja ning linnaosade koosseisu muutus vajab samuti
ülevaatust. Olemasolevate kvaliteedimõõdikute või varjumiskohtade allikavõrdluse
kadumine peatab uuenduse. Vana mõõdikuteta salvestisega saab võrrelda väljundmahte
ja linnaosade pindalasid; lähte- ja piirkondlikku katvust hakatakse võrdlema pärast
mõõdikutega versiooni vastuvõtmist. Sama ajatempliga eelistatakse mõõdikutega versiooni.

Tõrke korral jäävad kaart ja viimane eduka uuenduse kuupäev alles.
Põhjendatud suure muutuse vastuvõtmise [juhend](../CONTRIBUTING.md) nõuab konkreetse
kandidaadi tunnust ja hooldaja põhjendust. Kontrollid ei tuvasta kõiki sisuvigu:
näiteks väikesed või sama mahtu ja piirkondlikke summasid säilitavad muudatused
võivad lävendite sisse jääda.

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
  teenuste aadressid, rahvastikuaasta ja laadimise aeg, rahvastiku võrdluse lähteandmed
  ning `shelterSources` all Päästeameti andmed koos päritoluga. Salvestatud 15.10.2026.
- `national-shelters.csv`: sama uuenduse riiklik lähtefail; võimaldab CSV teisendust korrata.
- `../docs/snapshot.json`: nendest lähteandmetest arvutatud kaardikihid ja viimane
  eduka uuendamise aeg. Praeguses versioonis 29 varjumiskohta ja 1832 rahvastikuruutu.
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
3. Maski sees ühildatakse Tartu toimivad varjumiskohad (`Toimiv == 1`) ja Päästeameti
   avalikud varjumiskohad. Sõnaselgelt vastuoluline staatus kuvatakse eraldi ja sellise
   koha mahutavus jäetakse arvutusest välja. Allikaseosed säilivad `sourceAudit` väljas.
4. Iga rahvastikuruudu sisepunkt määratakse geomeetriliselt lähimale teadaoleva
   positiivse mahutavusega varjumiskohale. Teekonda tänavatel ei arvutata.
5. Koormussuhe = varjumiskohale määratud elanike arv / mahutavus.
6. Koormusklassid: madal `< 0,75`, piiril `0,75–1,25`, kõrge `> 1,25`.
   Puuduva või mittepositiivse mahutavusega kohad kuvatakse eraldi, neile elanikke ei määrata.
7. Veekogud lõigatakse linnamaskiga ning kaardikihid teisendatakse tagasi WGS84-sse.

Brauseris kasutatakse JSTS-i ja Proj4js-i. Kehtetuid pindgeomeetriaid proovitakse
parandada nullpuhvriga; parandamatu geomeetria või arvutusviga katkestab uuenduse.
Tulemuste kontroll võrdleb iga varjumiskoha määratud elanike summat temaga seotud
alade rahvaarvuga ning võrdleb ka üldsummasid.
Sõltumatu R/sf/GEOS-i võrdlus on failis `../tests/reference.json`.

Rahvastik kirjeldab elukohti. Mudel ei arvesta päevast liikumist, tänavavõrku,
sissepääsude kasutatavust ega kohtade tegelikku täituvust. `Toimiv` kajastab
andmeallika viimase eduka laadimise seisu.
