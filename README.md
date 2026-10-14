# Tartu varjumiskohtade interaktiivne kaart

[Ava veebikaart](https://karlkais.github.io/tartu-varjumiskaart/)

Tartu avalike varjumiskohtade kaart koos mahutavuse, rahvastiku 100 m ruudustiku,
linnaosade, veekogude ja lähima varjumiskoha mudelil põhineva koormussuhtega.
Kaarti saab suumida ja nihutada, kihte sisse-välja lülitada ning varjumiskohtadele
vajutades nende andmeid vaadata.

## Failid

- `docs/index.html` — valmis interaktiivne kaart koos sellesse salvestatud kaardiandmetega.
- `docs/assets/` — kaardi JavaScripti, CSS-i ja pildifailid; need peavad jääma HTML-i kõrvale.
- `docs/.nojekyll` — staatiliste failide avaldamine GitHub Pagesis.
- `scripts/build_map.R` — iseseisev R-skript kaardi taasloomiseks.
- `data/ylesanne1/` — kaardi taasloomiseks vajalikud algandmed ja Shapefile'i kaasfailid.
- `data/README.md` — andmete päritolu ja analüüsi selgitus.

Kaardi vaatamiseks ei ole vaja R-i ega Shiny serverit. Kogu `docs` kausta saab
alla laadida ja avada `index.html` brauseris. OpenStreetMapi taustakaardi
laadimiseks on vaja internetiühendust.

## GitHub Pages

Avaldamise allikas on haru `main` kaust `/docs`. GitHub avaldab selle kausta sisu
aadressil <https://karlkais.github.io/tartu-varjumiskaart/>.

Kui seadistus on vaja taastada, vali repos **Settings → Pages → Build and deployment**:

1. **Source:** `Deploy from a branch`.
2. **Branch:** `main`, kaust `/docs`.
3. Vajuta **Save**.

Edaspidi avaldatakse `docs` kausta muudatused automaatselt pärast `git push` käsku.
Algandmete või R-skripti muutmise järel tuleb kaart esmalt uuesti genereerida.
Avaldamise olekut näeb repo **Actions** vaates ja **Settings → Pages** lehel.

[GitHub Pagesi avaldamise juhend](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Kaardi uuesti genereerimine

Vajalik on R ning paketid `tidyverse`, `sf`, `leaflet`, `htmlwidgets`, `htmltools` ja `scales`.
Vajaduse korral paigalda need R-konsoolis:

```r
install.packages(c("tidyverse", "sf", "leaflet", "htmlwidgets", "htmltools", "scales"))
```

Käivita repositooriumi juurkaustast:

```sh
Rscript scripts/build_map.R
```

Skript loeb kaasas olevad andmed ja salvestab uue kaardi kausta `docs`.
Seejärel salvesta muudatused GitHubi:

```sh
git add docs scripts data
git commit -m "Uuenda varjumiskaarti"
git push
```

Kontrollitud R 4.5.3 ja pakettidega tidyverse 2.0.0, sf 1.1.1, leaflet 2.2.3,
htmlwidgets 1.6.4, htmltools 0.5.9 ning scales 1.4.0.

## Päritolu

Projekt eraldati 14.10.2026 olemasolevast `netlify_varjumiskaart` veebiekspordist ja
`Kodutoo3-2026K/2026K-Kodutoo3/Kodutoo3.Rmd` teise ülesande lähtekoodist.
Algandmete allikas on [Tartu avaandmed](https://geohub.tartulv.ee/pages/avaandmed).
Rahvastikukiht kirjeldab 2025. aastat. Andmed on projektiga kaasas olev salvestis,
mitte automaatselt uuenev teenus; täpne algandmete allalaadimise aeg pole teada.

Koormussuhe on lihtsustatud mudeli tulemus, mitte varjumiskoha tegelik täituvus.
Mudeli eeldused on kirjas failis `data/README.md`.

Kaasatud kolmandate osapoolte teekidele ja algandmetele kehtivad nende algsed
kasutustingimused. Taustakaardi autoriõiguse viited on kaardil säilitatud.
