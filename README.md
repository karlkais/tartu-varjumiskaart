# Tartu varjumiskaart

Interaktiivne kaart Tartu avalike varjumiskohtade, nende mahutavuse ja piirkondliku
rahvastiku uurimiseks.

**[Ava kaart →](https://karlkais.github.io/tartu-varjumiskaart/)**

## Mida kaardilt leiab?

- **Varjumiskohad:** nimi, aadress ja teadaolev mahutavus.
- **Koormussuhe:** lähima varjumiskoha mudeliga määratud elanike arv võrrelduna koha mahutavusega.
- **Rahvastik:** uusim sobiv Tartu avaandmete 100 meetri rahvastikuruudustik.
- **Piirkonnad:** Tartu linnaosade piirid ja veekogud OpenStreetMapi taustakaardil.

Markerile vajutades avaneb koha täpsem info. Kihtide menüüst saab sisse lülitada
rahvastikuruudustiku. Ringide suurus näitab mahutavust ja värv koormusklassi;
teadmata mahutavusega kohad on sinised markerid. Väiksel ekraanil on selgitus ja
legend kokkupandavad.

## Automaatne uuendamine

Kaart avaneb viimaste olemasolevate andmetega. Kui nende **viimasest edukast
uuendusest on möödas üle kuue kalendrikuu**, toimub avamisel järgmine:

1. Laaditakse uuesti varjumiskohad, linnaosade piirid ja veekogud Tartu ametlikest teenustest.
2. Leitakse andmekataloogist uusim sobiv rahvastiku 100 m kiht ja laaditakse kõik selle objektid.
3. Arvutatakse uuesti piiridega lõiked, lähima koha määrangud ja koormussuhted.
4. Terviklik tulemus koos eduka uuendamise ajaga salvestatakse selle brauseri andmehoidlasse.

Uuendamine toimub taustal; senist kaarti saab edasi kasutada. Tõrke korral säilivad
viimased toimivad andmed ja nende kuupäev. Lehe avamine ega ebaõnnestunud päring
uuendamiskuupäeva edasi ei nihuta. Kaardil kuvatakse andmete kuupäev,
rahvastiku võrdlusaasta ja uuendamise olek.

Salvestus on **brauseri ja seadme põhine**. Teine brauser või tühjendatud andmehoidla
alustab veebiga kaasas olevast andmeversioonist. Kui brauser salvestamist ei luba,
saab värsket tulemust kasutada selles seansis ning järgmine avamine võib uuendust
korrata. Serverit, GitHubi võtit ega perioodilist taustatööd pole vaja.

Projektiga kaasas olev algversioon uuendati **14.10.2026** ja kasutab **2026. aasta**
rahvastikku: 27 varjumiskohta, neist 23 teadaoleva positiivse mahutavusega.

## Andmed ja tõlgendamine

Andmeallikas on [Tartu avaandmete portaal](https://geohub.tartulv.ee/pages/avaandmed).
Koormussuhe on elukohapõhine hinnang, mitte koha tegelik täituvus. Mudel kasutab
sirgjoonelist kaugust ega arvesta tänavavõrku või inimeste päevast liikumist.

[Andmeallikad ja arvutusmudel](data/README.md)

## Arendamine ja avaldamine

Kaart on staatiline Leafleti veebirakendus. Avaandmete laadimine ja ruumiarvutused
toimuvad brauseris eraldi arvutustöös. Vaatamiseks piisab tänapäevasest brauserist ja
internetiühendusest. GitHub Pages avaldab haru `main` kausta `docs`.

- `src/` — kaardi kasutajaliides, uuendamisloogika ja ruumiarvutused.
- `docs/` — avaldatav veebirakendus ning toimiv algandmeversioon.
- `data/source-snapshot.json` — algversiooni arvutamisel kasutatud lähteandmed.
- `tests/` — uuendamise, andmepäringute ja sõltumatu R-mudeliga võrdluse testid.
- `scripts/` — koostamine, algandmete värskendamine ja kohalik testserver.

[Käivitamise ja avaldamise juhend](CONTRIBUTING.md)

Kolmandate osapoolte teekidele ja algandmetele kehtivad nende algsed kasutustingimused.
[Teekide litsentsid](docs/app/THIRD-PARTY-LICENSES.txt) on veebirakendusega kaasas;
OpenStreetMapi ja Tartu andmeallika viited on kaardil säilitatud.
