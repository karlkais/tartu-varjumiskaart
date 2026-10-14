# Käivita repositooriumi juurkaustast: Rscript scripts/build_map.R
# Genereerib Tartu varjumiskaardi projekti algandmetest.
required_packages = c("tidyverse", "sf", "leaflet", "htmlwidgets", "htmltools", "scales")
missing_packages = required_packages[!vapply(required_packages, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing_packages)) {
  stop("Paigalda esmalt R-paketid: ", paste(missing_packages, collapse = ", "))
}
if (!dir.exists("data/raw")) {
  stop("Käivita skript repositooriumi juurkaustast, kus asub data/raw.")
}

library(tidyverse)
library(sf)
library(leaflet)
library(htmlwidgets)
library(htmltools)
library(scales)

sf_use_s2(FALSE)

dir.create("docs", showWarnings = FALSE)

# Kasutame projektiga kaasas olevaid Tartu avaandmete salvestisi.
linnaosad = st_read("data/raw/linnaosa_piir/linnaosa_piir.shp", quiet = TRUE) %>%
  st_transform(3301) %>%
  st_make_valid()

rahvastik = st_read("data/raw/2025_rahvastik_100m_andmed/2025_rahvastik_100m_andmed.shp", quiet = TRUE) %>%
  rename(rahvaarv = sum_sum_ko) %>%
  st_transform(3301) %>%
  st_make_valid()

varjumiskohad = st_read("data/raw/varjumiskohad/varjumiskohad.geojson", quiet = TRUE) %>%
  st_transform(3301)

veekogud = st_read("data/raw/veekogud/veekogud.geojson", quiet = TRUE) %>%
  st_transform(3301) %>%
  st_make_valid()

linna_mask = linnaosad %>%
  st_union()

rahvastik_linnas = rahvastik %>%
  mutate(algne_pindala = as.numeric(st_area(.))) %>%
  filter(st_intersects(., linna_mask, sparse = FALSE)[, 1]) %>%
  st_intersection(linna_mask) %>%
  mutate(
    loigatud_pindala = as.numeric(st_area(.)),
    rahvaarv = rahvaarv * loigatud_pindala / algne_pindala
  ) %>%
  filter(rahvaarv > 0)

varjumiskohad_linnas = varjumiskohad %>%
  filter(Toimiv == 1) %>%
  filter(st_within(., linna_mask, sparse = FALSE)[, 1])

varjumiskohad_mahutavusega = varjumiskohad_linnas %>%
  filter(!is.na(Mahutavus), Mahutavus > 0)

varjumiskohad_teadmata = varjumiskohad_linnas %>%
  filter(is.na(Mahutavus) | Mahutavus <= 0)

rahvastik_punktid = rahvastik_linnas %>%
  st_point_on_surface()

lahim_varjumiskoht = st_nearest_feature(
  rahvastik_punktid,
  varjumiskohad_mahutavusega
)

varjumiskoha_koormus = rahvastik_linnas %>%
  st_drop_geometry() %>%
  mutate(varjumiskoht_id = varjumiskohad_mahutavusega$OBJECTID[lahim_varjumiskoht]) %>%
  group_by(varjumiskoht_id) %>%
  summarize(suunatud_rahvaarv = sum(rahvaarv, na.rm = TRUE), .groups = "drop")

varjumiskohad_koormusega = varjumiskohad_mahutavusega %>%
  left_join(varjumiskoha_koormus, by = c("OBJECTID" = "varjumiskoht_id")) %>%
  mutate(
    suunatud_rahvaarv = replace_na(suunatud_rahvaarv, 0),
    koormussuhe = suunatud_rahvaarv / Mahutavus,
    koormusklass = case_when(
      koormussuhe < 0.75 ~ "Madal (< 0.75)",
      koormussuhe <= 1.25 ~ "Piiril (0.75-1.25)",
      TRUE ~ "Kõrge (> 1.25)"
    ),
    koormusklass = factor(
      koormusklass,
      levels = c("Madal (< 0.75)", "Piiril (0.75-1.25)", "Kõrge (> 1.25)")
    )
  )

veekogud_linnas = veekogud %>%
  st_intersection(linna_mask)

# Leaflet kasutab WGS84 koordinaate.
linnaosad_wgs = linnaosad %>% st_transform(4326)
rahvastik_wgs = rahvastik_linnas %>% st_transform(4326)
veekogud_wgs = veekogud_linnas %>% st_transform(4326)
varjumiskohad_wgs = varjumiskohad_koormusega %>%
  st_transform(4326) %>%
  mutate(
    popup_html = str_c(
      "<strong>", Nimetus, "</strong><br>",
      Aadress, "<br>",
      "Mahutavus: ", number(Mahutavus, accuracy = 1), "<br>",
      "Lähimaks määratud elanikke: ", number(round(suunatud_rahvaarv), accuracy = 1), "<br>",
      "Koormussuhe: ", round(koormussuhe, 2), "x<br>",
      "Koormusklass: ", koormusklass
    )
  )
varjumiskohad_teadmata_wgs = varjumiskohad_teadmata %>%
  st_transform(4326) %>%
  mutate(
    popup_html = str_c(
      "<strong>", Nimetus, "</strong><br>",
      Aadress, "<br>",
      "Mahutavus puudub"
    )
  )

rahvastik_pal = colorNumeric(
  palette = "YlOrBr",
  domain = rahvastik_wgs$rahvaarv,
  na.color = "transparent"
)

koormus_pal = colorFactor(
  palette = c("#2ca25f", "#fdae61", "#d7191c"),
  domain = varjumiskohad_wgs$koormusklass
)

mahutavus_raadius = function(x) {
  sqrt(x) / 8 + 4
}

mahutavus_legend = tibble(
  mahutavus = c(250, 1000, 5000, 13000),
  raadius = mahutavus_raadius(mahutavus)
)

mahutavus_legend_svg_korgus = ceiling(max(mahutavus_legend$raadius) * 2 + 4)
mahutavus_legend_svg_keskkoht = ceiling(max(mahutavus_legend$raadius) + 2)
mahutavus_legend_read = str_c(
  "<div style='display:flex; align-items:center; margin:2px 0;'>",
  "<svg width='46' height='", mahutavus_legend_svg_korgus, "'>",
  "<circle cx='23' cy='", mahutavus_legend_svg_keskkoht,
  "' r='", round(mahutavus_legend$raadius, 1),
  "' fill='rgba(80,80,80,0.25)' stroke='#252525' stroke-width='1'></circle>",
  "</svg>",
  "<span>", number(mahutavus_legend$mahutavus, accuracy = 1), "</span>",
  "</div>",
  collapse = ""
)

mahutavus_legend_html = str_c(
  "<div style='background:rgba(255,255,255,0.9); padding:8px 10px; ",
  "border-radius:4px; box-shadow:0 1px 5px rgba(0,0,0,0.25);'>",
  "<div style='font-weight:bold; margin-bottom:5px;'>Varjumiskoha mahutavus</div>",
  mahutavus_legend_read,
  "</div>"
)

kaart2 = leaflet(width = "100%", height = "100vh") %>%
  addTiles(
    urlTemplate = "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  ) %>%
  addPolygons(
    data = linnaosad_wgs,
    fill = FALSE,
    color = "#525252",
    weight = 1,
    opacity = 0.8,
    label = ~NIMI,
    popup = ~str_c("<strong>Linnaosa: </strong>", NIMI),
    highlight = highlightOptions(weight = 2, color = "black", bringToFront = TRUE)
  ) %>%
  addPolygons(
    data = rahvastik_wgs,
    group = "Rahvastik 100 m ruudus",
    fillColor = ~rahvastik_pal(rahvaarv),
    fillOpacity = 0.55,
    color = "transparent",
    weight = 0,
    popup = ~str_c("Elanikke ruudus: ", round(rahvaarv))
  ) %>%
  addPolygons(
    data = veekogud_wgs,
    fillColor = "#8ecae6",
    fillOpacity = 0.8,
    color = "#4a9ec2",
    weight = 1,
    popup = ~if_else(is.na(Nimi), "Veekogu", str_c("Veekogu: ", Nimi))
  ) %>%
  addCircleMarkers(
    data = varjumiskohad_wgs,
    group = "Varjumiskohad",
    radius = ~mahutavus_raadius(Mahutavus),
    color = ~koormus_pal(koormusklass),
    fillColor = ~koormus_pal(koormusklass),
    fillOpacity = 0.9,
    stroke = TRUE,
    weight = 1,
    label = ~Nimetus,
    popup = ~popup_html
  ) %>%
  addMarkers(
    data = varjumiskohad_teadmata_wgs,
    group = "Mahutavuseta varjumiskohad",
    label = ~Nimetus,
    popup = ~popup_html
  ) %>%
  addLegend(
    "bottomright",
    pal = rahvastik_pal,
    values = rahvastik_wgs$rahvaarv,
    title = "Elanikke 100 m ruudus",
    opacity = 0.8
  ) %>%
  addLegend(
    "topright",
    colors = c("#2ca25f", "#fdae61", "#d7191c"),
    labels = c("Madal (< 0.75)", "Piiril (0.75-1.25)", "Kõrge (> 1.25)"),
    title = "Koormussurve",
    opacity = 0.9
  ) %>%
  addControl(
    html = HTML(mahutavus_legend_html),
    position = "bottomleft"
  ) %>%
  addLayersControl(
    overlayGroups = c(
      "Rahvastik 100 m ruudus",
      "Varjumiskohad",
      "Mahutavuseta varjumiskohad"
    ),
    options = layersControlOptions(collapsed = FALSE)
  ) %>%
  hideGroup("Rahvastik 100 m ruudus") %>%
  addControl(
    html = HTML(
      "<strong>Tartu varjumiskohtade koormuskaart</strong><br>",
      "Koormussuhe põhineb elukohapõhisel rahvastikul ja lähima varjumiskoha mudelil.<br>",
      "Markerile vajutades näeb nime, aadressi, mahutavust ja koormussuhet."
    ),
    position = "topleft"
  )

# Kitsas aknas saab legendid ja selgituse avada vajaduse järgi.
kaart2 = htmlwidgets::onRender(kaart2, "function(el) {
  var narrow = window.matchMedia('(max-width: 700px)');
  el.querySelectorAll('.info.legend').forEach(function(control) {
    var text = control.textContent;
    var title = text.includes('Tartu varjumiskohtade') ? 'Kaardi info' :
      text.includes('Koormussurve') ? 'Koormussurve' :
      text.includes('Varjumiskoha mahutavus') ? 'Mahutavus' : 'Rahvastiku legend';
    var details = document.createElement('details');
    var summary = document.createElement('summary');
    summary.textContent = title;
    var content = document.createElement('div');
    while (control.firstChild) content.appendChild(control.firstChild);
    details.appendChild(summary);
    details.appendChild(content);
    control.appendChild(details);
    details.open = !narrow.matches;
    narrow.addEventListener('change', function() { details.open = !narrow.matches; });
    L.DomEvent.disableClickPropagation(control);
    L.DomEvent.disableScrollPropagation(control);
  });
}")

kaart2

kaardi_fail = "docs/index.html"

saveWidget(
  kaart2,
  kaardi_fail,
  selfcontained = FALSE,
  libdir = "assets",
  title = "Tartu varjumiskaart"
)

# Keelemärgend ja mobiili vaateala säilivad ka kaardi uuesti genereerimisel.
html = readLines(kaardi_fail, encoding = "UTF-8", warn = FALSE)
html = sub('<html lang="en">', '<html lang="et">', html, fixed = TRUE)
html = sub('<head>', paste0(
  '<head>\n<style>',
  'html,body,#htmlwidget_container{width:100%;height:100%;margin:0;}',
  '.legend summary{display:none;cursor:pointer;font-weight:600;}',
  '@media(max-width:700px){',
  '.legend summary{display:list-item;}',
  '.leaflet-control.legend{max-width:calc(100vw - 40px);max-height:35vh;overflow:auto;}',
  '.legend details[open]>div{margin-top:8px;}',
  '}',
  '</style>'
), html, fixed = TRUE)
html = sub(
  '<meta charset="utf-8"/>',
  paste0('<meta charset="utf-8"/>\n',
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>\n',
    '<meta name="description" content="Tartu avalike varjumiskohtade interaktiivne kaart: aadressid, mahutavus, rahvastik ja piirkondlik koormussuhe."/>'),
  html,
  fixed = TRUE
)
writeLines(enc2utf8(html), kaardi_fail, useBytes = TRUE)
file.create("docs/.nojekyll")
message("Valmis: ", kaardi_fail, "; varjumiskohti: ", nrow(varjumiskohad_linnas),
        " (mahutavusega ", nrow(varjumiskohad_mahutavusega),
        ", mahutavuseta ", nrow(varjumiskohad_teadmata), ").")

if (interactive()) {
  browseURL(kaardi_fail)
}
