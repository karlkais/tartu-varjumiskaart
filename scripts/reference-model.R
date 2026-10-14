# Independent sf/GEOS reference for the browser's planar spatial model.
# Run from the repository root after changing data/source-snapshot.json.
library(sf)
library(dplyr)
library(jsonlite)
sf_use_s2(FALSE)
raw = fromJSON('data/source-snapshot.json', simplifyVector = FALSE)
read_layer = function(name) {
  st_read(toJSON(raw$layers[[name]], auto_unbox = TRUE, null = 'null', digits = NA), quiet = TRUE) %>%
    st_transform(3301) %>% st_make_valid()
}
districts = read_layer('districts')
mask = st_union(districts)
population = read_layer('population') %>% mutate(original_area = as.numeric(st_area(.)))
population = population %>%
  filter(st_intersects(., mask, sparse = FALSE)[, 1]) %>% st_intersection(mask) %>%
  mutate(residents = sum_sum_kokku * as.numeric(st_area(.)) / original_area) %>% filter(residents > 0)
shelters = read_layer('shelters') %>% filter(Toimiv == 1) %>% filter(st_within(., mask, sparse = FALSE)[, 1])
known = shelters %>% filter(!is.na(Mahutavus), Mahutavus > 0)
population$shelterId = known$OBJECTID[st_nearest_feature(st_point_on_surface(population), known)]
loads = population %>% st_drop_geometry() %>% group_by(shelterId) %>% summarize(assigned = sum(residents), .groups = 'drop')
known = known %>% left_join(loads, by = c('OBJECTID' = 'shelterId')) %>% mutate(assigned = coalesce(assigned, 0), ratio = assigned / Mahutavus)
result = list(
  populationYear = raw$populationYear,
  shelters = known %>% st_drop_geometry() %>% transmute(id = OBJECTID, capacity = Mahutavus, assigned, ratio),
  population = population %>% st_drop_geometry() %>% transmute(id = objectid, residents, shelterId),
  shelterCount = nrow(shelters),
  waterCount = nrow(st_intersection(read_layer('water'), mask)),
  engine = list(R = paste(R.version$major, R.version$minor, sep = '.'), sf = as.character(packageVersion('sf')), GEOS = unname(sf_extSoftVersion()['GEOS']))
)
dir.create('tests', showWarnings = FALSE)
writeLines(toJSON(result, auto_unbox = TRUE, digits = 12, pretty = TRUE), 'tests/reference.json', useBytes = TRUE)
message('Reference saved: tests/reference.json')
