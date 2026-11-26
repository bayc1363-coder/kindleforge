const assert = require('assert');
const { groupGlyphs } = require('./text-runs');

function glyph(left, top, width = 8, height = 16) {
  return { left, top, width, height };
}

const word = 'self-control.';
const wrapped = [];
for (let i = 0; i < word.length; i++) {
  if (i < 5) wrapped.push(glyph(400 + i * 9, 80));
  else wrapped.push(glyph(12 + (i - 5) * 9, 108));
}

const parts = groupGlyphs(word, wrapped);
assert.strictEqual(parts.length, 2, 'a hyphen wrap is two fragments, not two copies of the whole word');
assert.strictEqual(parts[0].text, 'self-');
assert.strictEqual(parts[1].text, 'control.');
assert.notStrictEqual(parts[0].text, word);
assert.notStrictEqual(parts[1].text, word);
assert.strictEqual(parts.map((p) => p.text).join(''), word);
assert.ok(parts[0].y < parts[1].y, 'the second fragment sits on the next line');
assert.ok(parts[1].x < parts[0].x, 'the next line starts further left');

const single = word.split('').map((_, i) => glyph(20 + i * 9, 40));
const one = groupGlyphs(word, single);
assert.strictEqual(one.length, 1);
assert.strictEqual(one[0].text, word);

const withGap = groupGlyphs('self-control.', wrapped.map((r, i) => (i === 4 ? { left: r.left, top: r.top, width: 0, height: 0 } : r)));
assert.strictEqual(withGap.map((p) => p.text).join(''), 'self-control.');
assert.ok(withGap.every((p) => p.text !== 'self-control.' || withGap.length === 1));

console.log('text-runs: hyphen wrap draws each fragment once');
