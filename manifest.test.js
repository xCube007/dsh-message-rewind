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
// Bounded to the tested DSH release line: rc.3 through 0.2.x, never 0.3.
assert.match(pkg.engines?.dsh ?? '', /^>=0\.2\.1-rc\.\d+ <0\.3\.0-0$/);
assert.equal(pkg.engines?.node, '>=20');
assert.equal(pkg.dsh?.manifestVersion, 1);
assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml');
assert.equal(pkg.dsh?.client?.platform, 'web');
assert.equal(pkg.exports?.['./client'], './client.js');

const client = await readFile(new URL('./client.js', import.meta.url), 'utf8');
assert.match(client, new RegExp(`id: '${pkg.name}'`), 'the client bundle id must be the package name');

console.log('manifest self-check passed');
