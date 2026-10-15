import { populationSummary } from './population-context.mjs';

const number = value => new Intl.NumberFormat('et-EE', { maximumFractionDigits: 0 }).format(value);
const percent = value => new Intl.NumberFormat('et-EE', { maximumFractionDigits: 1 }).format(value);
const date = value => new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium' }).format(new Date(value));
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function createPopulationView() {
  const dialog = document.querySelector('#population-dialog');
  const content = document.querySelector('#population-context');
  document.querySelector('#population-details').addEventListener('click', () => dialog.showModal());
  document.querySelector('#population-close').addEventListener('click', () => dialog.close());

  function sourceDetails(source, title) {
    const details = element('details', null, 'population-source');
    details.append(element('summary', title));
    const link = element('a', source.title);
    link.href = source.url; link.target = '_blank'; link.rel = 'noopener';
    details.append(link);
    // Preserve the original HTML in the snapshot, but never execute source markup.
    const plain = source.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    details.append(element('p', plain || source.snippet || 'Allikakirjeldus puudub.'));
    details.append(element('p', `Laaditud ${date(source.retrievedAt)}${source.modifiedAt ? ` · Kataloogikirje muudetud ${date(source.modifiedAt)}` : ''}. Kataloogikirje kuupäev ei kinnita iga lähteobjekti muutmise aega.`, 'population-note'));
    return details;
  }

  return { render(snapshot) {
    const { total, context, comparison } = populationSummary(snapshot);
    content.replaceChildren();
    content.append(element('p', 'Koormushinnang hõlmab ainult avaldatud rahvastikku. Privaatsuse tõttu avaldamata elanikud jäävad arvutusest välja. Andmekihist puuduva ala rahvaarvu ei saa lugeda nulliks.'));
    content.append(element('p', 'Rahvastikukihi hallil taustal puudub avaldatud rahvaarv. Avaldatud nullväärtusega alad on värviskaala heledaimat tooni ja nende hüpikaknas on 0. Puuduvaid elanikke ei ole hinnanguliselt juurde lisatud.', 'population-note'));
    const stats = element('dl', null, 'population-stats');
    stats.append(element('dt', `Kaardimudelis (${snapshot.populationYear})`), element('dd', number(total)));
    if (comparison) {
      stats.append(element('dt', `Linnaosade ametlik koondarv (${snapshot.populationYear})`), element('dd', number(comparison.officialTotal)));
      const difference = total - comparison.officialTotal;
      stats.append(element('dt', 'Mudeli summa erinevus koondarvust'),
        element('dd', `${difference < 0 ? '−' : difference > 0 ? '+' : ''}${percent(Math.abs(difference) / comparison.officialTotal * 100)}%`));
    }
    content.append(stats);
    content.append(element('p', 'Erinevus võib tuleneda avaldamata andmetest ning piiride ja ruumilise jaotamise erinevusest. See ei ole puuduvate majapidamiste arv ega varjumiskohtade täituvus.', 'population-note'));
    if (comparison) {
      const table = element('table', null, 'population-table');
      table.append(element('caption', 'Linnaosade võrdlus: avaldatud rahvastiku summa on jaotatud koondkihi piiride järgi pindalaga kaaludes. Osakaal on võrdlusnäitaja, mitte ametlik katvusprotsent.'));
      const head = element('thead'), headings = element('tr');
      for (const title of ['Linnaosa', 'Avaldatud rahvastik', 'Ametlik koondarv', 'Osakaal']) {
        const cell = element('th', title); cell.scope = 'col'; headings.append(cell);
      }
      head.append(headings); table.append(head);
      const body = element('tbody');
      for (const row of [...comparison.districts].sort((a, b) => a.name.localeCompare(b.name, 'et'))) {
        const tr = element('tr'), name = element('th', row.name); name.scope = 'row'; tr.append(name);
        tr.append(element('td', number(row.published)), element('td', number(row.official)),
          element('td', row.official > 0 ? `${percent(row.published / row.official * 100)}%` : '—'));
        body.append(tr);
      }
      table.append(body); content.append(table);
      content.append(element('p', 'Kaardimudel kasutab linnaosade piirikihi ühendit. Tabel kasutab rahvastiku koondkihi piire, seetõttu ei pruugi tabeli avaldatud rahvastiku summa kaardimudeli summaga täpselt kattuda. Nullise ametliku koondarvu puhul osakaalu ei arvutata.', 'population-note'));
    } else content.append(element('p', context?.unavailableReason || 'Selles salvestises puuduvad sama aasta linnaosade võrdlusandmed. Katvuse ulatust ei saa kinnitada.', 'population-unavailable'));
    if (context?.source) content.append(sourceDetails(context.source, 'Rahvastikukihi allikakirjeldus'));
    else content.append(element('p', 'Selles salvestises puudub rahvastikukihi allikakirjeldus.', 'population-note'));
    if (comparison) content.append(sourceDetails(comparison.source, 'Linnaosade koondandmete allikas'));
    document.querySelector('#population-details').disabled = false;
  } };
}
