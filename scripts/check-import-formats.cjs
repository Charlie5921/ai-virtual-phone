const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  module._compile(result.outputText, filename);
};
const { parseCharacterFromJson, parseCharacterFromPng } = require('../lib/character-storage.ts');
const { parseWorldBookFromJson } = require('../lib/settings-storage.ts');
const { worldBookFromText, importWorldBookFile } = require('../lib/worldbook-file-import.ts');
const data = { name: '测试角色', description: '中文人设', first_mes: '你好', scenario: '雨天', character_book: {
  name: '测试世界', entries: [
    { id: 0, keys: ['城市', '故乡'], content: '城市资料', name: '城市', enabled: false, insertion_order: 0, extensions: { depth: 7, probability: 0 } },
    { id: 1, keys: [], content: '始终生效', comment: '背景', enabled: true, constant: true, insertion_order: 9 },
  ],
}};
for (const card of [data, { spec: 'chara_card_v2', data }, { spec: 'chara_card_v3', data }]) {
  const parsed = parseCharacterFromJson(JSON.stringify(card));
  assert.equal(parsed.name, '测试角色');
  assert.equal(parsed.tavernData.first_mes, '你好');
  const book = parseWorldBookFromJson(JSON.stringify(parsed.tavernData.character_book));
  assert.equal(book.entries.length, 2);
  assert.equal(book.entries[0].uid, '0');
  assert.equal(book.entries[0].key, '城市,故乡');
  assert.equal(book.entries[0].comment, '城市');
  assert.equal(book.entries[0].disable, true);
  assert.equal(book.entries[0].depth, 7);
  assert.equal(book.entries[0].probability, 0);
  assert.equal(book.entries[1].constant, true);
}
for (const keyword of ['chara', 'ccv3']) {
  const payload = Buffer.from(keyword + '\0' + Buffer.from(JSON.stringify({ spec: 'chara_card_v2', data })).toString('base64'));
  const chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length); chunk.write('tEXt', 4); payload.copy(chunk, 8);
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk]);
  assert.equal(parseCharacterFromPng(png.buffer.slice(png.byteOffset, png.byteOffset + png.length)).name, '测试角色');
}
assert.equal(parseCharacterFromPng(new ArrayBuffer(10)), null);
assert.equal(parseCharacterFromJson('null'), null);
assert.equal(parseCharacterFromJson('{}'), null);
assert.equal(parseWorldBookFromJson('{"entries":[null]}'), null);
assert.equal(worldBookFromText('# 城市\n内容一\n\n# 人物\n内容二', '文档').entries.length, 2);
assert.equal(worldBookFromText('第一段\n\n第二段', '文档').entries.length, 2);
assert.equal(worldBookFromText('【城市】\n内容', '文档').entries[0].comment, '城市');
(async () => {
  const file = new File(['中文第一段\n\n中文第二段'], '中文.TXT');
  assert.equal((await importWorldBookFile(file)).entries.length, 2);
  await assert.rejects(() => importWorldBookFile(new File([''], 'empty.txt')));
  console.log('PASS: V1/V2/V3 JSON, PNG chara/ccv3, embedded entries, UTF-8 TXT, headings and invalid inputs');
})().catch(error => { console.error(error); process.exitCode = 1; });
