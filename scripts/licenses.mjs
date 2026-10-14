import { readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export async function thirdPartyLicenses() {
  const packages = new Map();
  async function findPackage(name, from) {
    let folder = resolve(from);
    while (true) {
      try { return await realpath(join(folder, 'node_modules', name)); } catch { /* Try the parent module directory. */ }
      const parent = dirname(folder);
      if (parent === folder) throw new Error(`Paketti ei leitud: ${name}`);
      folder = parent;
    }
  }
  async function visit(name, from = '.') {
    const folder = await findPackage(name, from);
    const pkg = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'));
    const key = `${pkg.name}@${pkg.version}`;
    if (packages.has(key)) return;
    packages.set(key, '');
    const files = (await readdir(folder)).filter(file => /^(licen[cs]e|copying|notice)([._-]|$)/i.test(file)).sort();
    const contents = pkg.name === 'jsts' ? [await readFile('licenses/JSTS-EDL-1.0.txt', 'utf8')]
      : await Promise.all(files.map(file => readFile(join(folder, file), 'utf8')));
    if (!contents.length && pkg.name === 'murmurhash-js') {
      const readme = await readFile(join(folder, 'README.md'), 'utf8');
      const section = readme.match(/^## License \(MIT\)[\s\S]+/m);
      if (section) contents.push(section[0]);
    }
    if (!contents.length) throw new Error(`Litsentsitekst puudub: ${key}`);
    packages.set(key, `${key} (${pkg.name === 'jsts' ? 'EDL-1.0' : pkg.license})\n${contents.join('\n\n')}`);
    for (const dependency of Object.keys(pkg.dependencies ?? {})) await visit(dependency, folder);
  }
  const root = JSON.parse(await readFile('package.json', 'utf8'));
  for (const name of Object.keys(root.dependencies)) await visit(name);
  return [...packages.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, text]) => text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim()).join('\n\n---------------------\n\n') + '\n';
}
