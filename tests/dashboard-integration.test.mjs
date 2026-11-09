import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const dashboard = readFileSync(
  join(process.cwd(), 'src/components/field-shift/SinglePageDashboard.tsx'),
  'utf8',
);

test('single-page dashboard exposes NASA, crop workspace, compare, and crop health', () => {
  for (const tab of ['field', 'signals', 'workspace', 'compare']) {
    assert.match(dashboard, new RegExp(`id: ["']${tab}["']`));
  }

  assert.match(dashboard, /<SignalsPanel analysis=\{analysis\} \/>/);
  assert.match(dashboard, /<CropWorkspace analysis=\{analysis\} \/>/);
  assert.match(dashboard, /<ComparePanel analysis=\{analysis\} \/>/);
  assert.match(dashboard, /href="\/crop-health"/);
});
