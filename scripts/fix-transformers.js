/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

function patchFile(filePath, searchStr, replaceStr) {
  if (!fs.existsSync(filePath)) {
    console.log(`[fix-transformers] File not found, skipping: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[fix-transformers] Successfully patched: ${filePath}`);
  } else if (content.includes(replaceStr)) {
    console.log(`[fix-transformers] Already patched: ${filePath}`);
  } else {
    console.warn(`[fix-transformers] Target string not found in: ${filePath}`);
  }
}

console.log('[Voice2Note] Running Transformers.js Safari/WebKit compatibility patch...');

// 1. Patch src/env.js
patchFile(
  path.join(__dirname, '../node_modules/@xenova/transformers/src/env.js'),
  'function isEmpty(obj) {\n    return Object.keys(obj).length === 0;\n}',
  'function isEmpty(obj) {\n    return !obj || Object.keys(obj).length === 0;\n}'
);

// 2. Patch dist/transformers.js
patchFile(
  path.join(__dirname, '../node_modules/@xenova/transformers/dist/transformers.js'),
  'function isEmpty(obj) {\n    return Object.keys(obj).length === 0;\n}',
  'function isEmpty(obj) {\n    return !obj || Object.keys(obj).length === 0;\n}'
);

// 3. Patch dist/transformers.min.js
patchFile(
  path.join(__dirname, '../node_modules/@xenova/transformers/dist/transformers.min.js'),
  'function b(e){return 0===Object.keys(e).length}',
  'function b(e){return !e||0===Object.keys(e).length}'
);

// 4. Patch public/wasm/transformers.min.js
patchFile(
  path.join(__dirname, '../public/wasm/transformers.min.js'),
  'function b(e){return 0===Object.keys(e).length}',
  'function b(e){return !e||0===Object.keys(e).length}'
);

console.log('[Voice2Note] Patch completed.');
