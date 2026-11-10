import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const dashboard = readFileSync(
  join(process.cwd(), 'src/components/field-shift/SinglePageDashboard.tsx'),
  'utf8',
);
const signals = readFileSync(
  join(process.cwd(), 'src/components/field-shift/dashboard/SignalsPanel.tsx'),
  'utf8',
);
const englishDashboardMessages = JSON.parse(
  readFileSync(join(process.cwd(), 'src/messages/en/dashboard.json'), 'utf8'),
);
const bengaliDashboardMessages = JSON.parse(
  readFileSync(join(process.cwd(), 'src/messages/bn-BD/dashboard.json'), 'utf8'),
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

test('signals panel explains the climate metrics and their spatial resolution', () => {
  const disclosures = [
    'Annual and growing-season rainfall.',
    'Heat-stress days.',
    'Dry spells.',
    'Temperature and rainfall trends.',
    'Climate suitability for crops.',
    'Resolution: approximately 0.5° × 0.5° for the relevant MERRA-2 meteorological fields. This is relatively coarse for individual farms.',
  ];

  for (const disclosure of disclosures) {
    const key = Object.keys(englishDashboardMessages).find(
      (messageKey) => englishDashboardMessages[messageKey] === disclosure,
    );
    assert.ok(key, `English dashboard translation is missing: ${disclosure}`);
    assert.ok(
      typeof bengaliDashboardMessages[key] === 'string' &&
        bengaliDashboardMessages[key].trim().length > 0,
      `Bengali dashboard translation is missing: ${disclosure}`,
    );
    assert.ok(
      signals.includes(JSON.stringify(disclosure)),
      `Signals panel does not display: ${disclosure}`,
    );
  }
  assert.ok(signals.includes('{t(item)}'), 'Signal disclosures are not translated');
});
