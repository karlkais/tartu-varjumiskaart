# Arendamine ja avaldamine

## Projekti käivitamine

```sh
git clone https://github.com/karlkais/tartu-varjumiskaart.git
cd tartu-varjumiskaart
```

Valmis veebikaart asub failis `docs/index.html`. Selle vaatamiseks pole R-i ega
Shiny serverit vaja. Taustakaart laaditakse OpenStreetMapist interneti kaudu.

## Kaardi genereerimine

Vajalik on R ning paketid `tidyverse`, `sf`, `leaflet`, `htmlwidgets`, `htmltools` ja `scales`.
Paigalda puuduvad paketid R-konsoolis:

```r
install.packages(c("tidyverse", "sf", "leaflet", "htmlwidgets", "htmltools", "scales"))
```

Käivita repositooriumi juurkaustast:

```sh
Rscript scripts/build_map.R
```

Skript loeb andmed kaustast `data/raw` ning salvestab veebikaardi ja vajalikud
ressursid kausta `docs`. Hoia Shapefile'i `.shp`, `.shx`, `.dbf`, `.prj` ja `.cpg`
failid koos. Andmekihtide välju ja arvutusmudelit kirjeldab [andmete juhend](data/README.md).

Kontrollitud keskkond: R 4.5.3, tidyverse 2.0.0, sf 1.1.1, leaflet 2.2.3,
htmlwidgets 1.6.4, htmltools 0.5.9 ja scales 1.4.0. Salvesta R-skriptid UTF-8 kodeeringus.

## Muudatuste kontrollimine

Pärast genereerimist ava `docs/index.html` brauseris. Kontrolli taustakaarti,
varjumiskohtade hüpikaknaid, kihtide lülitamist ning legendide avamist kitsas aknas.
Algandmete muutmisel kontrolli ka genereerimise lõpus väljastatud varjumiskohtade arvu.

## Avaldamine

GitHub Pages kasutab haru `main` kausta `/docs`. Algandmete või R-skripti muutmise
järel genereeri kaart uuesti ning salvesta ka veebifailide muudatused:

```sh
git add README.md CONTRIBUTING.md docs scripts data
git commit -m "Uuenda varjumiskaarti"
git push
```

Avaldamine käivitub automaatselt. Selle olekut näeb repo **Actions** vaates ja
**Settings → Pages** lehel.

Kui seadistus on vaja taastada, vali **Settings → Pages → Build and deployment** all
**Source: Deploy from a branch**, haru **main** ja kaust **/docs**, seejärel **Save**.

- [Veebikaart](https://karlkais.github.io/tartu-varjumiskaart/)
- [GitHub Pagesi juhend](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
