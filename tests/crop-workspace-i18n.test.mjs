import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const component = readFileSync(
  join(root, 'src/components/field-shift/dashboard/CropWorkspace.tsx'),
  'utf8',
);
const farmingStages = readFileSync(
  join(root, 'src/components/field-shift/dashboard/farmingStages.ts'),
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

function collectStageMessages() {
  const source = ts.createSourceFile(
    'farmingStages.ts',
    farmingStages,
    ts.ScriptTarget.Latest,
    true,
  );
  const messages = new Set();
  const fields = new Set([
    'title',
    'subtitle',
    'duration',
    'criticalFocus',
    'tasks',
    'tips',
  ]);

  function collect(node) {
    if (ts.isStringLiteralLike(node)) {
      messages.add(node.text);
    } else if (ts.isTemplateExpression(node)) {
      let message = node.head.text;
      for (const span of node.templateSpans) {
        message += `{${span.expression.getText(source)}}${span.literal.text}`;
      }
      messages.add(message);
    } else if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach(collect);
    } else if (ts.isConditionalExpression(node)) {
      collect(node.whenTrue);
      collect(node.whenFalse);
    }
  }

  function visit(node) {
    if (
      ts.isPropertyAssignment(node) &&
      fields.has(node.name.getText(source).replace(/['"]/g, ''))
    ) {
      collect(node.initializer);
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return [...messages];
}

test('CropWorkspace UI and farming stages have Bengali translations', () => {
  const english = loadMessages('en');
  const bengali = loadMessages('bn-BD');
  const englishKeyByMessage = new Map(
    Object.entries(english).map(([key, message]) => [message, key]),
  );
  const uiMessages = [
    ...component.matchAll(/\bt\(\s*'((?:\\.|[^'\\])*)'/g),
  ].map(([, message]) => message);
  for (const [, title, subtitle] of component.matchAll(
    /<SectionHeading[\s\S]*?title="([^"]+)"[\s\S]*?subtitle="([^"]+)"/g,
  )) {
    uiMessages.push(title, subtitle);
  }
  uiMessages.push(
    'High',
    'Moderate',
    'Low',
    'Environmental stress risk',
    'Monitor the field regularly for early signs of crop stress.',
  );
  const stageMessages = collectStageMessages();
  const missingUi = [...new Set(uiMessages)].filter(message => {
    const key = Object.hasOwn(english, message)
      ? message
      : englishKeyByMessage.get(message);

    return !key || typeof bengali[key] !== 'string' || !bengali[key].trim();
  });
  const missingStages = stageMessages.filter(message => {
    const key = englishKeyByMessage.get(message);
    return !key || typeof bengali[key] !== 'string' || !bengali[key].trim();
  });
  const mismatchedPlaceholders = [...new Set([...uiMessages, ...stageMessages])].filter(message => {
    const key = Object.hasOwn(english, message)
      ? message
      : englishKeyByMessage.get(message);
    if (!key || typeof bengali[key] !== 'string') return false;

    const placeholders = value =>
      [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
        .map(([, name]) => name)
        .sort();
    return (
      JSON.stringify(placeholders(english[key])) !==
      JSON.stringify(placeholders(bengali[key]))
    );
  });

  assert.deepEqual(missingUi, []);
  assert.deepEqual(missingStages, []);
  assert.deepEqual(mismatchedPlaceholders, []);
});
