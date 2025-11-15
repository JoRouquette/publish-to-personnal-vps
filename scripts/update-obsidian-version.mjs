import { readFileSync, writeFileSync } from 'node:fs';

const rawVersion = process.argv[2];

if (!rawVersion) {
  console.error('Usage: node scripts/update-obsidian-version.mjs <version>');
  process.exit(1);
}

const baseVersion = rawVersion.split('-')[0].split('+')[0];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

try {
  const pkg = readJson('package.json');
  pkg.version = baseVersion;
  writeJson('package.json', pkg);
} catch {
  console.warn('package.json introuvable ou illisible, ignoré');
}

const manifest = readJson('manifest.json');
manifest.version = baseVersion;
writeJson('manifest.json', manifest);

const minAppVersion = manifest.minAppVersion;

try {
  const versions = readJson('versions.json');

  if (!minAppVersion) {
    console.warn(
      'manifest.minAppVersion manquant, versions.json mis à jour mais peu utile'
    );
  }

  versions[baseVersion] = minAppVersion;
  writeJson('versions.json', versions);
} catch {
  console.warn(
    'versions.json introuvable, aucun historique mis à jour (tu peux le créer plus tard)'
  );
}
