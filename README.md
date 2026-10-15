# Tartu varjumiskaart

Interaktiivne kaart Tartu avalike varjumiskohtade, nende mahutavuse ja piirkondliku
rahvastiku uurimiseks.

**[Ava kaart →](https://karlkais.github.io/tartu-varjumiskaart/)**

## Mida kaardilt leiab?

- **Varjumiskohad:** nimi, aadress ja teadaolev mahutavus.
- **Koormussuhe:** lähima varjumiskoha mudeliga määratud elanike arv võrrelduna koha mahutavusega.
- **Rahvastik:** uusim sobiv Tartu avaandmete 100 meetri rahvastikuruudustik.
- **Piirkonnad:** Tartu linnaosade piirid ning linnast väljapoole jääva ala varjutus.
- **Aluskaart:** enda kujundatud hele kaart Maa- ja Ruumiameti ETAK hoonete, teede,
  tänavanimede, haljastuse, veekogude ja raudteedega. API-võtit ega kaardikontot pole vaja.

Markerile vajutades avaneb koha täpsem info. Kihtide menüüst saab sisse lülitada
rahvastikuruudustiku. Ringide suurus näitab mahutavust ja värv koormusklassi;
teadmata mahutavusega kohad on sinised markerid. Väiksel ekraanil on selgitus ja
legend kokkupandavad.

## Automaatne uuendamine

Kaart avaneb viimaste olemasolevate andmetega. Kui nende **viimasest edukast
uuendusest on möödas üle kuue kalendrikuu**, toimub avamisel järgmine:

1. Laaditakse varjumiskohad Tartu ja Päästeameti allikatest ning linnaosade piirid ja veekogud Tartu teenustest. Varjumiskohtade ühesed vasted ühendatakse aadressi ja asukoha järgi.
2. Leitakse andmekataloogist uusim sobiv rahvastiku 100 m kiht ja laaditakse kõik selle objektid.
3. Arvutatakse uuesti piiridega lõiked, lähima koha määrangud ja koormussuhted.
4. Terviklik tulemus koos eduka uuendamise ajaga salvestatakse selle brauseri andmehoidlasse.
5. Sama kuue kuu reegli järgi uuendatakse Tartu ja selle lähiümbruse aluskaarti
   Maa- ja Ruumiameti avalikust WFS-teenusest.

Uuendamine toimub taustal; senist kaarti saab edasi kasutada. Tõrke korral säilivad
viimased toimivad andmed ja nende kuupäev. Lehe avamine ega ebaõnnestunud päring
uuendamiskuupäeva edasi ei nihuta. Kaardil kuvatakse andmete kuupäev,
rahvastiku võrdlusaasta, aluskaardi laadimise kuupäev ja uuendamise olek.
Varjumisandmetel ja aluskaardil on eraldi salvestised ja tähtajad: ühe teenuse tõrge
ei takista teise uuendamist. Linnapiiri varjutus arvutatakse linnaosade piiridest uuesti.

Salvestus on **brauseri ja seadme põhine**. Teine brauser või tühjendatud andmehoidla
alustab veebiga kaasas olevast andmeversioonist. Kui brauser salvestamist ei luba,
saab värsket tulemust kasutada selles seansis ning järgmine avamine võib uuendust
korrata. Serverit, GitHubi võtit ega perioodilist taustatööd pole vaja.
Tavakasutus ei vaja käsitsi andmeuuendusi; välise teenuse aadressi või andmeskeemi
muutumine võib siiski vajada koodi kohandamist. Lehe avamiseks on vaja internetti;
rakendus ei ole täielik võrguühenduseta veebirakendus.

Projektiga kaasas olev varjumisandmete algversioon uuendati **15.10.2026** ja kasutab **2026. aasta**
rahvastikku: 29 varjumiskohta, neist 23 teadaoleva positiivse mahutavusega.

## Andmed ja tõlgendamine

Varjumisandmed pärinevad [Tartu avaandmete portaalist](https://geohub.tartulv.ee/pages/avaandmed)
ja [Päästeameti avaandmetest](https://www.rescue.ee/et/juhend/avaandmed/avalikud-varjumiskohad), rahvastik Tartu portaalist,
aluskaart [Maa- ja Ruumiameti ETAK andmetest](https://geoportaal.maaruum.ee/est/teenused/wms-wfs-wcs-teenused-p65.html).
Kaardi kuupäevad tähistavad viimast edukat laadimist ja arvutamist, mitte kõikide
lähteobjektide viimast muutmisaega.
Koormussuhe on elukohapõhine hinnang, mitte koha tegelik täituvus. Mudel kasutab
sirgjoonelist kaugust ega arvesta tänavavõrku või inimeste päevast liikumist.

**Rahvastiku katvus on piiratud.** 2026. aasta avalikust rahvastikukihist on privaatsuse
tõttu eemaldatud ühe majapidamise elanike arvu avaldavad alad. Koormusmudel hõlmab
ainult avaldatud rahvastikku. Praeguses mudelis on ligikaudu **82 798 elanikku**;
sama aasta ametlike linnaosade koondarv on **91 634**. Summa on **9,6% väiksem**,
kuid erinevus ei jaotu linnaosade vahel ühtlaselt ega tulene ainult privaatsusfiltrist:
ka piirid ja pindalaga kaalumine mõjutavad tulemust.

Kaardi kohal on püsiv selgitus ning nupp **„Rahvastiku võrdlus“**, mis avab sama aasta
linnaosade võrdlustabeli ja allikakirjeldused. Rahvastikukihi hall taust tähendab, et
selles andmekihis rahvaarv puudub; seda ei loeta nulliks. Avaldatud nullväärtused
kuvatakse eraldi värviskaala heledaima tooniga. Puuduvaid elanikke ei arvutata juurde.
Kui sama aasta koondandmeid ei leita või neid ei saa kontrollida, kuvatakse võrdluse
puudumise teade ning varjumisandmete uuendamine saab jätkuda.

[Andmeallikad ja arvutusmudel](data/README.md)

Nupp **„Kohtade allikad“** näitab iga kaardipunkti päritolu ja loendite erinevusi.
Praegu on 23 kohta mõlemas masinloetavas loendis, neli ainult Tartu kihis ning kaks
ainult Päästeameti kihis. Metsamaja ja Põllu 11c ühiselamu on lisatud teadmata
mahutavusega; olemasolevad mahutavused ja koormusarvutused säilivad.
Loendist puudumine ei tõenda sulgemist. Avalikud allikad ei kinnita hetkel avatud ust.
Päästeameti allika laadimistõrge peatab kogu varjumisandmete uuenduse, et uus
linnakiht ei kustutaks varem ühendatud kohti. [Ühildamise reeglid ja põhjendused](data/SHELTER-RECONCILIATION.md).

Uuenduse eel kontrollitakse iga koha elanike kontrollsummat, tunnuseid, geomeetriaid
ja muutusi eelmise andmeversiooni suhtes. Järsk andmekadu või muu ebatavaliselt suur
muutus peatab uuenduse: senine kaart ja kuupäev säilivad. Hooldaja saab põhjendatud
muutuse avalike allikate põhjal üle vaadata ning konkreetse versiooni vastu võtta.
[Andmekvaliteedi kontrollid ja lävendid](data/README.md#andmekvaliteedi-kontroll).

## Arendamine ja avaldamine

Kaart on staatiline Leafleti ja MapLibre'i veebirakendus. Avaandmete laadimine ja ruumiarvutused
toimuvad brauseris eraldi arvutustöös. Vaatamiseks piisab tänapäevasest brauserist ja
internetiühendusest. GitHub Pages avaldab haru `main` kausta `docs`.

- `src/` — kaardi kasutajaliides, uuendamisloogika ja ruumiarvutused.
- `docs/` — avaldatav veebirakendus ning toimiv algandmeversioon.
- `data/source-snapshot.json` — algversiooni arvutamisel kasutatud lähteandmed.
- `data/basemap-snapshot.json` — aluskaardi kuue kihi terviklik algversioon;
  avaldatakse tihendatult failina `docs/basemap.json.gz` (ligikaudu 3,4 MB).
- `tests/` — uuendamise, andmepäringute ja sõltumatu R-mudeliga võrdluse testid.
- `scripts/` — koostamine, algandmete värskendamine ja kohalik testserver.

[Käivitamise ja avaldamise juhend](CONTRIBUTING.md)

Kolmandate osapoolte teekidele ja algandmetele kehtivad nende algsed kasutustingimused.
[Teekide litsentsid](docs/app/THIRD-PARTY-LICENSES.txt) on veebirakendusega kaasas;
Maa- ja Ruumiameti, Tartu ja Päästeameti allikaviited kuvatakse kaardil.
