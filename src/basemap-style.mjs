const widths = ['interpolate', ['exponential', 2], ['zoom'],
  10, ['*', ['min', 14, ['get', 'width']], .06],
  14, ['*', ['min', 14, ['get', 'width']], .95],
  18, ['*', ['min', 14, ['get', 'width']], 15]];

export function basemapStyle(snapshot) {
  const sources = Object.fromEntries(Object.entries(snapshot.layers).map(([key, data]) =>
    [key, { type: 'geojson', data, maxzoom: 16, tolerance: .5, buffer: 64 }]));
  return {
    version: 8, name: 'Tartu hele aluskaart', sources,
    // Omitting glyphs uses local fonts, including Estonian characters. No font
    // service, map tile host, account or API key is needed to draw this map.
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': '#f3f2ef' } },
      { id: 'woodland', type: 'fill', source: 'woodland', paint: { 'fill-color': '#e4e9df', 'fill-opacity': .8 } },
      ...['lakes', 'rivers'].map(key => ({ id: key, type: 'fill', source: key, paint: { 'fill-color': '#c7dce4' } })),
      { id: 'buildings', type: 'fill', source: 'buildings', minzoom: 12, paint: { 'fill-color': '#deddd9', 'fill-outline-color': '#d2d1cd' } },
      { id: 'road-edges', type: 'line', source: 'roads', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#dcdad6', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, .7, 14, 5, 18, 24], 'line-opacity': .7 } },
      { id: 'roads', type: 'line', source: 'roads', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': widths } },
      { id: 'railways', type: 'line', source: 'railways', minzoom: 11, paint: { 'line-color': '#b7b8b4', 'line-width': 1, 'line-dasharray': [3, 3] } },
      { id: 'street-names', type: 'symbol', source: 'roads', minzoom: 12,
        filter: ['!=', ['get', 'name'], ''], layout: {
          'symbol-placement': 'line', 'symbol-spacing': 320, 'text-field': ['get', 'name'],
          'text-font': ['Arial'], 'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 16, 13],
          'text-max-angle': 35, 'text-padding': 4
        }, paint: { 'text-color': '#777c7c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 } }
    ]
  };
}
