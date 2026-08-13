import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(projectRoot, 'src', 'app');
const layers = new Set(['domain', 'application', 'presentation', 'infrastructure']);
const allowedDependencies = {
  domain: new Set(['domain']),
  application: new Set(['application', 'domain']),
  presentation: new Set(['presentation', 'application']),
  infrastructure: new Set(['infrastructure', 'application', 'domain'])
};
const aliases = new Map([
  ['@domain', 'domain'],
  ['@application', 'application'],
  ['@presentation', 'presentation'],
  ['@infrastructure', 'infrastructure'],
  // @shared is retained as a short alias for presentation/shared.
  ['@shared', 'presentation']
]);
const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g;
const violations = [];

for (const file of walk(appRoot)) {
  if (!file.endsWith('.ts')) continue;

  const sourceLayer = getPhysicalLayer(file);
  if (!sourceLayer) continue; // src/app root is the composition root.

  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const dependency = match[1];
    const targetLayer = getDependencyLayer(dependency, file);
    if (!targetLayer || allowedDependencies[sourceLayer].has(targetLayer)) continue;

    const line = source.slice(0, match.index).split(/\r?\n/).length;
    violations.push({
      file: relative(projectRoot, file),
      line,
      sourceLayer,
      targetLayer,
      dependency
    });
  }
}

if (violations.length) {
  console.error('Clean Architecture dependency violations:');
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} `
      + `${violation.sourceLayer} -> ${violation.targetLayer} (${violation.dependency})`
    );
  }
  process.exitCode = 1;
} else {
  console.log('Clean Architecture dependency check passed.');
}

function walk(directory) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory).flatMap(entry => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function getPhysicalLayer(file) {
  const [candidate] = relative(appRoot, file).split(sep);
  return layers.has(candidate) ? candidate : null;
}

function getDependencyLayer(dependency, importer) {
  for (const [alias, layer] of aliases) {
    if (dependency === alias || dependency.startsWith(`${alias}/`)) return layer;
  }

  if (!dependency.startsWith('.')) return null;

  const target = resolve(dirname(importer), dependency);
  const relativeTarget = relative(appRoot, target);
  if (relativeTarget.startsWith('..') || relativeTarget.startsWith(sep)) return null;

  const [candidate] = relativeTarget.split(sep);
  return layers.has(candidate) ? candidate : null;
}
