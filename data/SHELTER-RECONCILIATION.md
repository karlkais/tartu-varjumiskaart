# Varjumiskohtade avalike allikate ühildamine

Reeglite ja veebiallikate ülevaatus: **15.10.2026**. Lahendus kasutab avalikke allikaid;
ametkondlikku kooskõlastust ega andmeomaniku kinnitust ei eeldata. Kaardi väited
kirjeldavad allikates leiduvat infot, mitte kohapeal kontrollitud ligipääsu.

## Automaatne ühildamine

1. Tartu ArcGIS-kiht ja Päästeameti CSV laaditakse tervikuna. Nende laadimisajad
   säilivad eraldi. CSV HTTP `Last-Modified` on faili, mitte iga varjumiskoha muutmise aeg.
2. Mõlema allika punktid valitakse sama Tartu linnaosade maski järgi. Algandmed säilivad.
3. Aadressides ühtlustatakse tähekuju, tühikud, punktid ja `tn`; liitaadressid `//`
   avatakse eraldi aadressideks. Majanumbri tähti ei eemaldata. `11a` ei võrdu `11c`-ga.
4. Ühise aadressiga punktid ühendatakse vaid siis, kui EPSG:3301 kaugus on kuni 150 m
   ja mõlemal poolel on täpselt üks sobiv vaste. Piir on projekti sidumisreegel,
   mitte ametlik asukohatäpsus. Praeguste automaatvastete suurim erinevus on 46,8 m.
   Nime sarnasus või lähedus üksi ei ühenda punkte.
5. Üks dokumenteeritud erand seob Tartu `GlobalID={592791CA-7EA0-48A4-93CF-C72B8293BA5C}`
   Põllu 11 kirje riikliku `LÕ241` Põllu 11a kirjega. Erand kehtib ainult nende
   tunnuste, aadresside ja kuni 40 m kauguse korral (praegu 35,2 m). Ühiselamu `LÕ223`
   Põllu 11c jääb eraldi punktiks.
6. Mitmetähenduslikud vasted jäävad eraldi ja kannavad märget `ambiguous`. Riiklikule
   lisakirjele mahutavust ei kopeerita. Tartu selgesõnalise mittetoimiva staatuse ja
   riiklikus loendis esinemise vastuolu kuvatakse kui `status-conflict`, mahutavuseta.
7. Tartu kirje nimi, aadress, asukoht ja mahutavus säilivad ühendatud kirjel; riiklikud
   algväärtused on nähtavad kõrval. Ainult riikliku kirje korral kasutatakse selle nime,
   aadressi ja asukohta ning mahutavus on `null`. Loendist puudumine ei tähenda sulgemist.
8. Päästeameti laadimistõrge ei avalda Tartu andmetega osalist asendust. Vana terviklik
   salvestis säilib. Sisult ootamatult kahanenud, kuid vormiliselt terve lähtefaili
   muutusekontroll kuulub auditi F3 juurde ja ei ole selle parandusega lahendatud.

`docs/snapshot.json` sisaldab koondloendust `shelterContext` ning iga koha juures
`sourceAudit`: staatus, mõlema allika ID-d, GlobalID, nimed, aadressid, koordinaadid,
mahutavuse päritolu ja sidumismeetod koos kaugusega. Kohaliku kihi senine arvutus-ID
säilib; täiendavalt säilib stabiilne GlobalID. Riiklikud uued ID-d on `paaste:<id>`.
Nii saab iga otsust kontrollida algkirjete vastu. Vanad salvestised jäävad loetavaks
ja näitavad, kui võrdlusmetaandmed puuduvad.

## Praeguste erinevuste lahendus

| Juhtum | Otsus ja tõend |
| --- | --- |
| Metsamaja, F. R. Kreutzwaldi 5 (`LÕ206`) | Lisatud riikliku punkti järgi, mahutavus teadmata. [EMÜ enda juhis](https://www.emu.ee/turvalisus-ja-hadaolukorra-juhised) kinnitab Metsamaja keldrikoridoride kasutust. |
| VOCO Põllu 11a (`LÕ241`) ja 11c (`LÕ223`) | Õppehoone seostatud Tartu Põllu 11 kirjega; ühiselamu lisatud eraldi. [VOCO õpilaskodu leht](https://voco.ee/koolielu/opilaskodu/) kinnitab 11c eraldi hoonena. Majutuskohtade arvu ei kasutata varjumismahutavusena. |
| Põllu 499 kohta | Mahutavus jääb ainult senise Tartu Põllu 11 kirje juurde. [Tartu varjumisleht](https://www.tartu.ee/et/varjumine) nimetab õppehoonet ja ühiselamut koos; 499 jagunemine hoonete vahel ei ole avalikest andmetest üheselt määratav. Ühiselamule ei lisata teist 499 ega oletuslikku osa. |
| Puiestee 62 (`LÕ108`) | Mõlemad punktid tähistavad sama aadressi, vahe umbes 3 m. Kaardile jääb „Endise Kroonuaia Kooli hoone“; riiklik „Tartu Pärli Kool“ on allikavõrdluses nähtav. [Kooli ajalugu](https://www.parlikool.ee/koolist/ajalugu/) ütleb, et Pärli kool asub alates 2023. aastast Ploomi 1. Varjumiskoha koordinaate kooli uude asukohta ei liigutata. |
| Reiniku kaks hoonet, Pauluse kirik ja Hansa kool | Säilivad Tartu kihi järgi, teadmata mahutavusega. [Tartu kriisivoldik](https://tartu.ee/sites/default/files/uploads/tartu_kriisiinfo_web_ENG.pdf) nimetab samuti neid aadresse. Riiklikust CSV-st puudumine jääb nähtavaks. |

Tulemus: **29 punkti = 23 ühist + 4 ainult Tartu kihis + 2 ainult Päästeameti kihis**.
Teadaoleva mahutavusega kohti on 23, mahutavuste summa 36 036. Olemasolevad
koormused ja rahvastiku määrangud ei muutu, sest lisatud kahel kohal pole mahutavust.

Veebiallikad ei ole kõik omavahel kooskõlas. Tartu varjumisleht nimetab ka Riia 179a
endist arestimaja, mida praegustes kummaski masinloetavas kihis pole; kriisivoldik
nimetab lisaks Miina Härma Gümnaasiumi. Need on täiendavad tekstiallikate kandidaadid,
mitte automaatselt geokodeeritud varjumispunktid. Ilma täpse varjumiskoha asukohata
ei võrdsustata hoone üldist aadressipunkti sissepääsuga. Ühendit ei esitata kõigi
Tartu varjumisvõimaluste ammendava nimekirjana.

## Allikad ja kontroll

- [Tartu ruumiandmekiht](https://gis.tartulv.ee/arcgis/rest/services/Kriisijuhtimine/KR_valmisolek/FeatureServer/11)
- [Päästeameti avaandmete kirjeldus](https://www.rescue.ee/et/juhend/avaandmed/avalikud-varjumiskohad)
- [CSV](https://opendata.smit.ee/gis/varjumiskohad.csv)
- [Andmeväljade seletuskiri](https://www.rescue.ee/files/2026-08/varjumiskohtade-avaandmete-seletuskiri-2026vaelisveebiversioon.pdf)

Automaattestid katavad CSV telgede järjekorra ja rikked, liitaadressid, hoonenumbri
tähed, kaugusepiiri, ebaselged vasted, Põllu erandi, staatuse vastuolu, allikate ID-de
kordumatuse ja mahutavuse väljamõtlemise keelu. Pärisandmete regressioon võrdleb
kõiki seniseid rahvastikumääranguid ja mahutavusi ühildamiseelse mudeliga.
