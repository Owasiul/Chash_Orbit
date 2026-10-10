const fs = require('fs');
const code = fs.readFileSync('node_modules/ai/dist/index.d.ts', 'utf8');
const startIdx = code.indexOf('type UIMessage<');
const endIdx = code.indexOf('type UIMessageChunk', startIdx);
console.log(code.substring(startIdx, endIdx));
