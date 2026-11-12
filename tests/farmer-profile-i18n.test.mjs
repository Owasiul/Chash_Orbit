import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const component = readFileSync(
  join(root, 'src/components/field-shift/FarmerProfileForm.tsx'),
  'utf8',
);

function loadMessages(locale) {
  const directory = join(root, 'src/messages', locale);
  return Object.fromEntries(
    readdirSync(directory)
      .filter(file => file.endsWith('.json'))
      .flatMap(file => {
        const messages = JSON.parse(readFileSync(join(directory, file), 'utf8'));
        const namespace = file.slice(0, -'.json'.length);
        return Object.entries(messages).map(([key, value]) => [
          `${namespace}.${key}`,
          value,
        ]);
      }),
  );
}

test('Crops Under Consideration labels have Bengali translations', () => {
  const english = loadMessages('en');
  const bengali = loadMessages('bn-BD');
  const section = component.split('Section 2 — Crops Under Consideration')[1]
    ?.split('Section 3 — Environmental Context')[0];

  assert.ok(section, 'Could not find the crop consideration section');

  const englishKeyByMessage = new Map(
    Object.entries(english).map(([key, message]) => [message, key]),
  );
  const messages = [
    ...section.matchAll(/\bt\("((?:\\.|[^"\\])*)"/g),
  ].map(([, message]) => message);
  const missing = messages.filter(message => {
    const key = Object.hasOwn(english, message)
      ? message
      : englishKeyByMessage.get(message);

    return !key || typeof bengali[key] !== 'string' || !bengali[key].trim();
  });

  assert.deepEqual(missing, []);
});
