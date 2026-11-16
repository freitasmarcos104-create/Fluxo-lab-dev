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

test('GitHub Actions valida, mas não publica em produção', () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /npm run validate:release/);
  assert.doesNotMatch(workflow, /deploy-production:/);
  assert.doesNotMatch(workflow, /npm run deploy/);
  assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN/);
});

test('validação unificada inclui sintaxe, dry-run Cloudflare e todas as suítes', () => {
  assert.match(workerPackage.scripts['validate:release'], /npm run check/);
  assert.match(workerPackage.scripts['validate:release'], /npm run check:cf/);
  assert.match(workerPackage.scripts['validate:release'], /npm test/);
  assert.match(workerPackage.scripts.test, /worker-core\.test\.mjs/);
  assert.match(workerPackage.scripts.test, /achievements\.test\.mjs/);
  assert.match(workerPackage.scripts.test, /deployment-pipeline\.test\.mjs/);
});
