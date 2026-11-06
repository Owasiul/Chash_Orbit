import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve as pathResolve, dirname } from 'node:path';
import fs from 'node:fs';

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

function findFile(basePath) {
  for (const ext of EXTENSIONS) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const subPath = specifier.slice(2);
    const basePath = pathResolve('src', subPath);
    const matched = findFile(basePath);
    if (matched) {
      return {
        url: pathToFileURL(matched).href,
        shortCircuit: true,
      };
    }
  } else if (specifier.startsWith('.') && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL);
    const basePath = pathResolve(dirname(parentPath), specifier);
    const matched = findFile(basePath);
    if (matched) {
      return {
        url: pathToFileURL(matched).href,
        shortCircuit: true,
      };
    }
  }

  return nextResolve(specifier, context);
}
