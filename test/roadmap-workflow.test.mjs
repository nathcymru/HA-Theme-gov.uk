import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const workflow = YAML.parse(readFileSync('.github/workflows/validate.yml', 'utf8'));
const steps = workflow.jobs.verify.steps;

test('roadmap refresh handles withdrawal and recovery without granting issue-write access', () => {
  for (const event of ['edited', 'labeled', 'unlabeled', 'closed', 'reopened', 'deleted', 'transferred']) {
    assert.ok(workflow.on.issues.types.includes(event), `${event} must refresh or remove public items`);
  }
  assert.ok(workflow.on.schedule.length && 'workflow_dispatch' in workflow.on);
  assert.equal(workflow.permissions.issues, 'read');
  assert.equal(workflow.permissions.contents, 'read');
  assert.match(workflow.jobs.verify.if, /github\.event\.label\.name == 'roadmap: in-works'/);
  assert.match(workflow.jobs.verify.if, /github\.event\.label\.name == 'roadmap: completed'/);
});

test('trusted refresh cannot interpolate issue text into shell or execute a PR build', () => {
  const refresh = steps.find(step => step.name === 'Refresh reviewed theme roadmap');
  assert.equal(refresh.if, "github.event_name != 'pull_request'");
  assert.equal(refresh.run, 'npm run roadmap:fetch');
  assert.equal(refresh.env.GH_TOKEN, '${{ github.token }}');
  assert.ok(steps.indexOf(refresh) < steps.findIndex(step => step.run === 'npm run build'));
  for (const step of steps) {
    if (step.run) assert.doesNotMatch(step.run, /\$\{\{[\s\S]*github\.event\.(issue|comment|label)/);
  }
  const checkout = steps.find(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, "${{ github.event_name == 'pull_request' && github.ref || 'main' }}");
});

test('whole publication is serialised and unrelated issues cannot replace a pending publication', () => {
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const group = workflow.concurrency.group;
  assert.match(group, /'publish'/);
  assert.match(group, /format\('pr-\{0\}'/);
  assert.match(group, /format\('ignored-\{0\}', github\.run_id\)/);
  assert.match(group, /!contains\(github\.event\.issue\.labels\.\*\.name, 'roadmap: in-works'\)/);
  assert.match(group, /!contains\(github\.event\.issue\.labels\.\*\.name, 'roadmap: completed'\)/);
  assert.match(group, /github\.event\.label\.name != 'roadmap: in-works'/);
  assert.match(group, /github\.event\.label\.name != 'roadmap: completed'/);
});

test('roadmap publication retains the existing complete validation gate', () => {
  const browser = steps.findIndex(step => step.run === 'npm run test:browser');
  const upload = steps.findIndex(step => step.uses?.startsWith('actions/upload-pages-artifact@'));
  assert.ok(browser > 0 && upload > browser);
  for (const command of ['npm test', 'npm run check:guidance', 'npm run check:coverage', 'npm run check:brand']) {
    assert.ok(steps.findIndex(step => step.run === command) < upload);
  }
  assert.equal(workflow.jobs['deploy-docs'].needs, 'verify');
  assert.match(workflow.jobs['deploy-docs'].if, /github.event_name != 'pull_request'/);
  assert.match(steps[upload].if, /github.event_name != 'pull_request'/);
});
