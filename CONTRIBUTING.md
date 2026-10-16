# Arendamine ja avaldamine

## Kohalik käivitamine

Vajalikud on Node.js 22 või uuem ja pnpm. Projekti sõltuvused on lukustatud failis
`pnpm-lock.yaml`; kontrollitud paketihaldur on pnpm 11.25.0.

```sh
git clone https://github.com/karlkais/tartu-varjumiskaart.git
cd tartu-varjumiskaart
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm serve
```

Ava `http://localhost:8765`. Kasuta HTTP-serverit: faili otse kettalt avades ei
pruugi brauser lubada andmepäringuid ega arvutustööd.

`pnpm build` koostab `src/` lähtekoodist rakenduse kausta `docs/`. See ei laadi
avaandmeid ega muuda salvestiste uuendamiskuupäevi. Aluskaardi algversioon
pakitakse GZIP-failiks, mille brauser avab `DecompressionStream` abil. Kaardi jooksutamiseks
pole Node.js-i ega R-i vaja; teegid on avaldatud veebifailidega kaasas.

## Veebiga kaasas oleva andmeversiooni uuendamine

Tavakasutaja andmed uuenevad vajadusel brauseris. Veebiga kaasas olevat algversiooni
saab lisaks värskendada projekti juurkaustas:

```sh
pnpm snapshot
pnpm basemap
pnpm build
```

Skript leiab uusima rahvastikukihi, laadib Tartu andmekihid ja Päästeameti CSV, arvutab mudeli ja
kontrollib tulemust. Edu korral salvestab see `data/source-snapshot.json` ning
`docs/snapshot.json` ning `data/national-shelters.csv`. Päringu või arvutuse tõrke korral ei kirjutata varasemat
andmeversiooni üle. Uuendamise kuupäev tähistab edukalt lõpetatud laadimist ja arvutust,
mitte algandmete tootja viimast muutmisaega.

Suurt muutust võrdluses senise salvestisega automaatselt vastu ei võeta.
Skript jätab senised lähte- ja kaardifailid muutmata ning kirjutab ülevaatamiseks
`data/update-review.json` (muutused ja SHA-256 tunnus) ning `data/update-candidate.json`
(arvutatud kandidaat). Need ajutised failid on Gitist välja jäetud.
Kontrolli raporti iga muutust lähtekihi avaliku kirjelduse ja geomeetriatega:
objektide arv, rahvaarv, mahutavus ja linnaosade katvus. Kooskõlastust ametiga ei nõuta.
Kui põhjus on avalike allikatega põhjendatud, käivita:

```sh
node scripts/refresh-snapshot.mjs --accept-change=RAPORTIS_OLEV_TUNNUS --reason="Sisuline põhjendus koos kontrollitud allikaga"
```

Skript laadib andmed uuesti. Tunnus kehtib ainult sama lähteversiooniga võrreldud
sama kaardikandidaadi kohta; teistsugust kandidaati ei võeta selle tunnusega vastu.
Laadimisajad tunnust ei muuda. Põhjendus ja muudatuste loetelu jäävad avaldatud
salvestise `changeReview` välja. Vigast skeemi, arvutust ega vanemat rahvastikuaastat
ei saa selle käsuga lubada. Uus aastanumber üksi kvaliteedikontrolle ei leevenda.
Brauser ei kinnita suurt muutust ise: see säilitab senise kaardi ja näitab teadet.
Vastuvõetud versiooni kasutajateni jõudmiseks tuleb algsalvestis tavapäraselt avaldada.
[Kontrollid ja lävendid](data/README.md#andmekvaliteedi-kontroll).

`pnpm basemap` laadib kõik kuus ETAK kihti Tartu linnaosade ja ligikaudu 3 km
ümbruse jaoks. Edu korral kirjutab see atomaarse failiasendusega
`data/basemap-snapshot.json`. `pnpm build` avaldab sellest `docs/basemap.json.gz`.
API-võtmeid, kontosid ega ajastatud GitHub Actionsi töid ei ole vaja.
Suurte aluskaartide laadimisel jäta brauseri vahekaart avatuks; pooleli jäänud
uuendus ei asenda viimast toimivat salvestist.

Kui muudad algversiooni või arvutusmudelit, uuenda sõltumatut võrdlust R-iga
(paketid `sf`, `dplyr`, `jsonlite`) ja käivita testid:

```sh
Rscript scripts/reference-model.R
pnpm test
pnpm build
```

R-skript kirjutab ainult `tests/reference.json`. See ei genereeri ega asenda veebikaarti.
Brauseri ruumiarvutused kasutavad Proj4js-i ja JSTS-i; võrdlusarvutus kasutab sf/GEOS-i.
Testid kontrollivad iga rahvastikuala määrangut, pindalaga kaalutud rahvaarvu ja varjumiskoha
koormust (rahvaarvu lubatud arvuline erinevus alla 0,01 inimese).
Lisaks võrreldakse iga linnaosa avaldatud rahvastiku summat R/sf-arvutusega.
Rahvastiku katvuse testid kontrollivad sama aasta võrdlust, koondteenuse tõrget,
sobimatut piirkonda, avaldatud nullväärtusi ja vanu metaandmeteta salvestisi.
Varjumiskohtade ühildamise testid kontrollivad CSV eraldajaid ja koordinaatide telgi,
23 ühist ja kuut ühe allika kirjet, Põllu 11a/11c eristamist, mitmetähenduslikke vasteid,
staatuse vastuolu ja allikatõrget. Lisanduvad teadmata mahutavusega punktid ei muuda
seniseid määranguid ega koormusi; R-võrdlus kontrollib jätkuvalt Tartu mahutavuskihi arvutusi.

## Uuendamise käitumise kontroll

Automaattestid katavad kuue kalendrikuu täpse piiri ja kuu lõpu, puuduva/korduva
andmelehe, muutunud andmeväljad, uuema rahvastikuaasta leidmise, katkise vahemälu,
päringu- ja arvutustõrke, salvestustõrke ning vana brauseri vahekaardi võimaliku
ülekirjutuse. Edukas uuendus salvestatakse tervikliku IndexedDB tehinguga.

Päris brauseri kontrolliks on kohalikus serveris kaks testrežiimi:

```sh
node scripts/serve.mjs --test-stale
# http://localhost:8765 — aegunud algversioon, päris avaandmed ja arvutus

node scripts/serve.mjs --test-failure
# http://localhost:8766 — aegunud algversioon, tahtlik andmeteenuse tõrge

node scripts/serve.mjs --test-basemap-failure --port=8768
# Varjumisandmed uuenevad, aluskaardi teenuse tõrge jätab vana aluskaardi alles.

node scripts/serve.mjs --test-no-webgl --port=8769
# Kuvatakse Canvas-varuvariant; varjumiskohad ja linnamask jäävad kasutatavaks.

node scripts/serve.mjs --test-population-loss --port=8774
# Kohalik 100 lähteobjektiga mudel. Uuendus blokeeritakse; kaart ja 2020. aasta kuupäev säilivad.
```

Kasuta nende kontrollimiseks värsket brauseriprofiili või tühjenda ainult vastava
localhost-aadressi andmehoidla. Eduka testi järel uuesti avamisel peab kaart kasutama
salvestatud tulemust ja jätma päringu tegemata. Tõrketestis peab vana kuupäev ning
kasutatav kaart alles jääma ja ilmuma „Proovi uuesti“. Testirežiimid asuvad ainult
kohalikus serveris ega ole avaldatavas rakenduses. `--test-stale` muudab mõlemad
andmestikud aegunuks; pärast edukat uuendust peab kordusavamine kasutama brauserisalvestist.
Uue `--port` väärtusega saab testida eraldi päritolu ja tühja andmehoidlat.
`--test-population-loss` ei laadi avalikke teenuseid: server arvutab salvestatud
lähtefaili esimesest 100 rahvastikuobjektist kandidaadi ja annab selle uuendustöö
tulemusena brauserile. Kontrolli ka korduskatset ning vana kuupäeva säilimist pärast
lehe taasavamist. Teenuse enda 100 objektiga koguarvu ja lehekülgede juhtumit katab automaattest.

Kontrolli lisaks varjumiskoha hüpikakent, rahvastikukihi sisse-välja lülitamist,
legendi ja info avamist kitsas vaates. Kaardi kuupäev ja rahvastikuaasta peavad
olema nähtavad ka mobiilis.
Rahvastikukiht kannab nime „Rahvastikualad (100 m)”; legend selgitab elanike arvu
ja tiheduse erinevust. Ala hüpikaknas peab pindala vastama kuvatavale, vajadusel
linnapiiriga lõigatud geomeetriale. Rahvastiku allikakirjelduses kuvatakse eraldi
nii lühikirjeldus (2026. aastal kuusnurksed kärjed) kui ka pikem kirjeldus.
Kontrolli alale vajutamist nii nähtavate kui ka peidetud varjumiskohtadega ning
kihtide korduva sisse-välja lülitamise järel. Ülemised veekogu-, piiri- ja
varjumiskohtade kihid kasutavad SVG-d, et nende objektide vahele jääv läbipaistev pind
ei püüaks rahvastikukihi klõpse kinni; rahvastikualad kasutavad jätkuvalt Canvas-joonistust.
Kontrolli ka nuppu „Rahvastiku võrdlus“, selle tabelit ja allikakirjeldusi ning
rahvastikukihi halli tausta selgitust. Dialoog peab avanema klaviatuuriga ja sulguma
Esc-klahviga; fookus peab naasma avamisnupule. Puuduva võrdluse korral ei tohi
eelmise aasta koondarve kuvada sama aasta andmetena.
Kontrolli ka „Kohtade allikad“ dialoogi: Metsamaja, Põllu ühiselamu, Puiestee nimede
erinevus ja neli ainult Tartu kihis olevat kohta. Iga koha algallika kirje peab olema
avatav. Katkine Päästeameti päring peab jätma eelmise tervikliku kaardi alles.

## Avaldamine

GitHub Pages kasutab haru `main` kausta `/docs`. Pärast muudatusi käivita testid ja
koostamine ning salvesta lähtekood koos genereeritud veebifailidega:

```sh
pnpm test
pnpm build
git add src scripts tests docs data README.md CONTRIBUTING.md package.json pnpm-lock.yaml pnpm-workspace.yaml licenses .gitattributes
git commit -m "Uuenda varjumiskaarti"
git push
```

Avaldamise olekut näeb repo **Actions** vaates ja **Settings → Pages** lehel.
Pagesi seadistus: **Deploy from a branch → main → /docs**.

[Ava avaldatud kaart](https://karlkais.github.io/tartu-varjumiskaart/)
