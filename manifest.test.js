/**
 * Manifest self-check: DSH reads these fields before it imports the plugin, so
 * a mismatch fails the whole bundle instead of one feature. `engines.dsh` is a
 * hard gate in app boot (`evaluatePluginCompatibility`); the client bundle id
 * must equal the package name or that entry stays pending and web boot fails.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

assert.equal(pkg.name, 'dsh-message-rewind');
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
// Bounded to the tested DSH release line: 0.2.2-rc.1 through 0.2.x, never 0.3.
assert.match(pkg.engines?.dsh ?? '', /^>=0\.2\.2-rc\.\d+ <0\.3\.0-0$/);
assert.equal(pkg.engines?.node, '>=20');
assert.equal(pkg.dsh?.manifestVersion, 1);
assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml');
assert.equal(pkg.dsh?.client?.platform, 'web');
assert.equal(pkg.exports?.['./client'], './client.js');
assert.equal(pkg.exports?.['./package.json'], './package.json');
assert.equal(pkg.main, './index.js');
// The published tarball must carry every runtime file and no development-only
// self-checks; CI runs `npm pack --dry-run` against the same list.
for (const file of ['index.js', 'rewind.js', 'files.js', 'client.js', 'cordis.patch.yml', 'locale/*.json', 'icon.svg', 'README.en.md']) {
  assert.ok(pkg.files?.includes(file), `files must include ${file}`);
}
assert.equal(pkg.files?.includes('*.test.js'), false, 'self-checks stay out of the tarball');

const client = await readFile(new URL('./client.js', import.meta.url), 'utf8');
assert.match(client, new RegExp(`id: '${pkg.name}'`), 'the client bundle id must be the package name');

console.log('manifest self-check passed');
