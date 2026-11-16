import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workerPackage = JSON.parse(
  await readFile(new URL('../worker/package.json', import.meta.url), 'utf8')
);
const workflow = await readFile(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8'
);

test('deploy do Worker não aplica migrações D1 nem altera dados', () => {
  assert.equal(workerPackage.scripts.deploy, 'cf deploy --mode production --force');
  assert.doesNotMatch(workerPackage.scripts.deploy, /d1 migrations|sql|r2.*delete/i);
});

test('pipeline publica apenas depois da validação no push para main', () => {
  assert.match(workflow, /deploy-production:/);
  assert.match(workflow, /needs: worker-tests/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID:/);
});

test('pull requests validam, mas não publicam em produção', () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /github\.event_name != 'pull_request'/);
});
