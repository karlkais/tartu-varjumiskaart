import { NATIONAL_SHELTERS_PAGE } from './national-shelters.mjs';

const cityPage = 'https://www.tartu.ee/et/varjumine';
const cityLayer = 'https://gis.tartulv.ee/arcgis/rest/services/Kriisijuhtimine/KR_valmisolek/FeatureServer/11';
const labels = { both: 'Mõlemas loendis', 'city-only': 'Ainult Tartu andmekihis', 'national-only': 'Ainult Päästeameti andmekihis',
  ambiguous: 'Võimalik kattuvus – ühildamata', 'status-conflict': 'Allikate staatus on vastuolus' };
const date = value => new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium' }).format(new Date(value));
function el(tag, text, className) {
  const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node;
}
function link(text, url) {
  const a = el('a', text); a.href = url; a.target = '_blank'; a.rel = 'noopener'; return a;
}

function reviewNotes(a, container) {
  const add = (text, title, url) => { const p = el('p', text, 'source-note'); p.append(' ', link(title, url)); container.append(p); };
  if (a.status === 'city-only' && [439, 440, 441, 443].includes(a.city?.id)) {
    add('Seda kohta nimetab ka Tartu avalik kriisivoldik. Loendite erinevus säilitatakse nähtavana; teise loendi puuduvat kirjet ei käsitleta sulgemisteatena.',
      'Tartu kriisivoldik', 'https://tartu.ee/sites/default/files/uploads/tartu_kriisiinfo_web_ENG.pdf');
  }
  if (a.national?.id === 'LÕ108' && a.city?.address.includes('Puiestee tn 62')) {
    add('Puiestee 62 nimi erineb allikates. Säilitatud on Tartu nimetus „Endise Kroonuaia Kooli hoone“. Pärli kooli enda ajalugu paigutab kooli alates 2023. aastast Ploomi 1 aadressile; varjumiskoha punkti sinna ei liigutata.',
      'Kooli ajalugu', 'https://www.parlikool.ee/koolist/ajalugu/');
  }
  if (['LÕ241', 'LÕ223'].includes(a.national?.id) && a.national.address.includes('Põllu tn 11')) {
    add('Põllu 11/11a õppehoone ja Põllu 11c ühiselamu kuvatakse eraldi. Tartu 499 kohta säilib ühe Põllu lähtekirje juures: avalikud allikad ei määra üheselt selle mahu jaotust hoonete vahel. Ühiselamule lisamahtu ei omistata.',
      'VOCO õpilaskodu', 'https://voco.ee/koolielu/opilaskodu/');
  }
  if (a.national?.id === 'LÕ206' && a.national.address.includes('Kreutzwaldi tn 5')) {
    add('Metsamaja varjumiskohta kirjeldab ka Eesti Maaülikool. Nendes allikates puudub varjumiskoha mahutavus, seetõttu ei osale see koormuse jaotamises.',
      'Maaülikooli juhis', 'https://www.emu.ee/turvalisus-ja-hadaolukorra-juhised');
  }
}

export function appendShelterSourceInfo(container, properties, detailed = false) {
  const a = properties.sourceAudit;
  if (!a) { container.append(el('p', 'Selles salvestises puudub varjumiskohtade allikavõrdlus.', 'popup-note')); return; }
  container.append(el('p', labels[a.status], 'source-status'));
  if (a.status === 'city-only') container.append(el('p', 'Päästeameti loendist puudumine ei tõenda koha sulgemist. Mahutavus ja hetke ligipääs võivad olla teadmata.', 'source-note'));
  if (a.status === 'national-only') container.append(el('p', 'Tartu andmekihis eraldi kirje puudub. Mahutavus teadmata; koormust ei arvutata.', 'source-note'));
  if (a.status === 'ambiguous') container.append(el('p', 'Mitme võimaliku vaste tõttu kirjeid ei ühendatud. Näidatud punktide arv võib sisaldada sama koha mitut kirjet.', 'source-note'));
  if (a.status === 'status-conflict') container.append(el('p', 'Tartu kiht ei märgi kohta toimivaks, kuid Päästeameti loend sisaldab seda. Mahutavust koormusarvutuses ei kasutata.', 'source-note'));
  if (detailed) {
    for (const [record, title, url] of [[a.city, 'Tartu andmekiht', cityLayer], [a.national, 'Päästeameti avaandmed', NATIONAL_SHELTERS_PAGE]]) {
      if (!record) continue;
      const p = el('p', null, 'source-record');
      p.append(link(title, url), el('span', ` · ${record.id}: ${record.name} · ${record.address}`));
      container.append(p);
    }
    if (a.match) container.append(el('p', `Asukohtade erinevus ${a.match.distanceMetres.toFixed(1)} m. Seostus: ${a.match.method === 'reviewed-address-alias' ? 'üle kontrollitud Põllu aadressiseos' : 'ühtiv aadress ja lähedane asukoht'}.`, 'source-note'));
    container.append(el('p', a.city ? 'Kaardi nimi, aadress ja asukoht: Tartu andmekiht. Mahutavuse allikas: Tartu andmekiht; Päästeameti CSV seda ei sisalda.' : 'Kaardi nimi, aadress ja asukoht: Päästeameti andmekiht. Mahutavus: teadmata.', 'source-note'));
    reviewNotes(a, container);
  }
}

export function createShelterView() {
  const dialog = document.querySelector('#shelter-dialog'), content = document.querySelector('#shelter-context');
  document.querySelector('#shelter-details').addEventListener('click', () => dialog.showModal());
  document.querySelector('#shelter-close').addEventListener('click', () => dialog.close());
  return { render(snapshot) {
    content.replaceChildren();
    const context = snapshot.shelterContext;
    if (!context) content.append(el('p', 'Selles salvestises puudub kahe varjumiskohtade loendi võrdlus. Uuem salvestis lisab allikaseosed.', 'population-unavailable'));
    else {
      const counts = context.counts;
      content.append(el('p', `${snapshot.layers.shelters.features.length} kaardipunkti: ${counts.both} mõlemas loendis, ${counts['city-only']} ainult Tartu kihis ja ${counts['national-only']} ainult Päästeameti kihis.`, 'source-overview'));
      if (counts.ambiguous || counts['status-conflict']) content.append(el('p', `Ühildamata kirjeid: ${counts.ambiguous}. Vastuolulise staatusega kohti: ${counts['status-conflict']}.`, 'population-unavailable'));
      content.append(el('p', 'Ühendatud on sama aadressi ja lähedase asukohaga ühesed vasted. Ainult ühes loendis olevad kohad säilivad. Loendis esinemine ei kinnita hetkel avatud ust.'));
      content.append(el('p', 'Mahutavus pärineb Tartu kihist. Teadmata mahutavusega kohtadele elanikke ei määrata. Põllu 11c ühiselamule ei lisata õppehoone juures juba arvestatud mahtu.', 'source-note'));
      const sources = el('p', null, 'source-note');
      sources.append(link('Tartu andmekiht', context.city.url), `: laaditud ${date(context.city.retrievedAt)}. `,
        link('Päästeameti avaandmed', NATIONAL_SHELTERS_PAGE), `: laaditud ${date(context.national.retrievedAt)}. `);
      if (context.national.modifiedAt) sources.append(`CSV serveri muutmisaeg ${date(context.national.modifiedAt)}. `);
      sources.append('Laadimise ja faili muutmise aeg ei kinnita iga koha viimast kontrolli.'); content.append(sources);
      const section = el('div', null, 'shelter-source-list');
      const priority = f => f.properties.sourceAudit.status === 'both' ? 1 : 0;
      for (const f of [...snapshot.layers.shelters.features].sort((a, b) => priority(a) - priority(b) || a.properties.name.localeCompare(b.properties.name, 'et'))) {
        const p = f.properties, details = el('details', null, 'shelter-source-item'), summary = el('summary');
        summary.append(el('span', p.name), el('small', p.address)); details.append(summary);
        const body = el('div');
        body.append(el('p', p.capacity > 0 ? `Mahutavus: ${p.capacity} inimest (Tartu andmekiht).` : 'Mahutavus: teadmata.'));
        appendShelterSourceInfo(body, p, true); details.append(body); section.append(details);
      }
      content.append(section);
      if (!snapshot.layers.shelters.features.some(f => /riia(?: tn)? 179a/i.test(f.properties.address))) {
        const caveat = el('p', 'Kahe masinloetava kihi ühend ei taga kõigi veebitekstides nimetatud kohtade hõlmamist. Tartu varjumislehe 15.10.2026 ülevaatuses leitud Riia 179a puudub kaardikihist; ilma täpse varjumispunktita seda automaatselt kaardile ei lisata. ', 'source-note');
        caveat.append(link('Tartu varjumisleht', cityPage)); content.append(caveat);
      }
      content.append(el('p', 'Puiestee ja Põllu erisuste avalike veebiallikate ülevaatus: 15.10.2026. Need selgitused ei ole reaalajas olekukinnitus.', 'source-note'));
    }
    document.querySelector('#shelter-details').disabled = false;
  } };
}
