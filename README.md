# Tartu varjumiskaart

Interaktiivne kaart Tartu avalike varjumiskohtade, nende mahutavuse ja piirkondliku
rahvastiku uurimiseks.

**[Ava kaart →](https://karlkais.github.io/tartu-varjumiskaart/)**

## Mida kaardilt leiab?

- **Varjumiskohad:** nimi, aadress ja teadaolev mahutavus.
- **Koormussuhe:** lähima varjumiskoha mudeliga määratud elanike arv võrrelduna koha mahutavusega.
- **Rahvastik:** 2025. aasta elanikud 100 meetri ruudustikus.
- **Piirkonnad:** Tartu linnaosade piirid ja veekogud OpenStreetMapi taustakaardil.

## Kasutamine

1. Suumi või liiguta kaarti sobiva piirkonnani.
2. Vajuta varjumiskohale, et näha selle aadressi, mahutavust ja koormussuhet.
3. Lülita kihtide menüüst sisse rahvastikuruudustik või muuda nähtavaid varjumiskohti.
4. Väikesel ekraanil ava legendid ja kaardi selgitus nende pealkirjale vajutades.

Ringide suurus näitab mahutavust ja värv mudeli koormusklassi. Teadmata
mahutavusega varjumiskohad on eraldi kihis.

## Andmed ja tõlgendamine

Andmeallikas on [Tartu avaandmete portaal](https://geohub.tartulv.ee/pages/avaandmed).
Rahvastikukiht kirjeldab 2025. aastat; kaardi andmed on salvestatud koos projektiga
ega uuene automaatselt.

Koormussuhe võrdleb lähimale varjumiskohale määratud elanike arvu selle mahutavusega.
See on elukohapõhine hinnang, mitte koha tegelik täituvus. Mudel ei arvesta
tänavavõrku ega inimeste päevast liikumist.

[Andmekihtide kirjeldus ja arvutusmudel](data/README.md)

## Arendamine ja avaldamine

Kaart on staatiline Leafleti veebirakendus. Vaatamiseks piisab brauserist ja
internetiühendusest; kaardi uuesti genereerimiseks kasutatakse R-i.

- `docs/` — avaldatav veebikaart ja selle ressursid.
- `data/raw/` — algandmed koos vajalike kaasfailidega.
- `scripts/build_map.R` — kaardi genereerimine.

[Käivitamise, uuendamise ja avaldamise juhend](CONTRIBUTING.md)

GitHub Pages avaldab automaatselt haru `main` kausta `docs`.
Kolmandate osapoolte teekidele ja algandmetele kehtivad nende algsed kasutustingimused;
OpenStreetMapi autoriõiguse viide on kaardil säilitatud.
