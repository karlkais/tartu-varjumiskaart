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

Skript leiab uusima rahvastikukihi, laadib kõik neli andmekihti, arvutab mudeli ja
kontrollib tulemust. Edu korral salvestab see `data/source-snapshot.json` ning
`docs/snapshot.json`. Päringu või arvutuse tõrke korral ei kirjutata varasemat
andmeversiooni üle. Uuendamise kuupäev tähistab edukalt lõpetatud laadimist ja arvutust,
mitte algandmete tootja viimast muutmisaega.

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
Testid kontrollivad iga ruudu määrangut, pindalaga kaalutud rahvaarvu ja varjumiskoha
koormust (rahvaarvu lubatud arvuline erinevus alla 0,01 inimese).

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
```

Kasuta nende kontrollimiseks värsket brauseriprofiili või tühjenda ainult vastava
localhost-aadressi andmehoidla. Eduka testi järel uuesti avamisel peab kaart kasutama
salvestatud tulemust ja jätma päringu tegemata. Tõrketestis peab vana kuupäev ning
kasutatav kaart alles jääma ja ilmuma „Proovi uuesti“. Testirežiimid asuvad ainult
kohalikus serveris ega ole avaldatavas rakenduses. `--test-stale` muudab mõlemad
andmestikud aegunuks; pärast edukat uuendust peab kordusavamine kasutama brauserisalvestist.
Uue `--port` väärtusega saab testida eraldi päritolu ja tühja andmehoidlat.

Kontrolli lisaks varjumiskoha hüpikakent, rahvastikukihi sisse-välja lülitamist,
legendi ja info avamist kitsas vaates. Kaardi kuupäev ja rahvastikuaasta peavad
olema nähtavad ka mobiilis.

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
