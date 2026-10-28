import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const mainPath = fileURLToPath(new URL('../src/main.js', import.meta.url));

test('invalid input causes a failed Actor process instead of a successful exit', async () => {
    const tempDirectory = await mkdtemp(path.join(tmpdir(), 'idda-shopee-actor-'));
    try {
        await writeFile(path.join(tempDirectory, 'INPUT.json'), '{"searchQuery":""}');
        const result = spawnSync(process.execPath, [mainPath], {
            cwd: tempDirectory,
            encoding: 'utf8',
            timeout: 30_000,
        });

        assert.equal(result.error, undefined, result.error?.message);
        assert.notEqual(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout + result.stderr, /searchQuery or categoryUrl/i);
    } finally {
        await rm(tempDirectory, { recursive: true, force: true });
    }
});
