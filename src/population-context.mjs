// Additive metadata: old snapshots remain usable, with an explicit unavailable comparison.
export const POPULATION_CONTEXT_VERSION = 1;

export function validatePopulationContext(context, year, modeledTotal) {
  if (context == null) return;
  if (context.version !== POPULATION_CONTEXT_VERSION || context.year !== year ||
      !(context.unavailableReason === null || typeof context.unavailableReason === 'string')) throw new Error('Rahvastiku katvuse metaandmed ei sobi.');
  function source(value) {
    if (!value || value.year !== year || typeof value.title !== 'string' || typeof value.itemId !== 'string' ||
        typeof value.description !== 'string' || typeof value.snippet !== 'string' ||
        !Number.isFinite(Date.parse(value.retrievedAt)) ||
        !(value.modifiedAt === null || Number.isFinite(Date.parse(value.modifiedAt)))) throw new Error('Rahvastiku allikakirjeldus ei sobi.');
    const url = new URL(value.url);
    if (url.origin !== 'https://gis.tartulv.ee' || !/^\/arcgis\/rest\/services\/Hosted\/.+\/FeatureServer\/\d+$/.test(url.pathname)) throw new Error('Rahvastiku allika aadress ei sobi.');
  }
  if (context.source) source(context.source);
  if (!context.comparison) return;
  source(context.comparison.source);
  const comparison = context.comparison;
  if (context.unavailableReason !== null || !Array.isArray(comparison.districts) || !comparison.districts.length ||
      !Number.isFinite(comparison.officialTotal) || comparison.officialTotal <= 0 ||
      !Number.isFinite(comparison.modeledTotal) || Math.abs(comparison.modeledTotal - modeledTotal) > .01) throw new Error('Rahvastiku võrdlussummad ei sobi.');
  const ids = new Set();
  let total = 0;
  for (const row of comparison.districts) {
    if (row.id == null || ids.has(row.id) || typeof row.name !== 'string' || !row.name.trim() ||
        !Number.isFinite(row.official) || row.official < 0 || !Number.isFinite(row.published) || row.published < 0) throw new Error('Linnaosa rahvastikuvõrdlus ei sobi.');
    ids.add(row.id); total += row.official;
  }
  if (Math.abs(total - comparison.officialTotal) > .01) throw new Error('Linnaosade koondsumma ei klapi.');
}

export function populationSummary(snapshot) {
  const total = snapshot.layers.population.features.reduce((sum, f) => sum + f.properties.residents, 0);
  const context = snapshot.populationContext;
  try { validatePopulationContext(context, snapshot.populationYear, total); }
  catch { return { total, context: null, comparison: null }; }
  return { total, context: context ?? null, comparison: context?.comparison ?? null };
}
