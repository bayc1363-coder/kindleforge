const assert = require('assert');
const { writeProject } = require('./project-file');

function pngBytes(seed) {
  return Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, seed, seed + 1, seed + 2, 9]);
}

async function collect(book, images) {
  const chunks = [];
  await writeProject(book, (chunk) => { chunks.push(chunk); }, async (src) => {
    if (!images[src]) return null;
    return { mime: 'image/png', bytes: images[src] };
  });
  const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  chunks.forEach((c) => { bytes.set(c, offset); offset += c.length; });
  return new TextDecoder().decode(bytes);
}

(async () => {
  const a = pngBytes(3);
  const b = pngBytes(9);
  const aB64 = Buffer.from(a).toString('base64');
  const bB64 = Buffer.from(b).toString('base64');
  const duplicatedLegacy = 'data:image/png;base64,' + aB64;
  const text = await collect({
    title: 'Big',
    author: 'Test',
    bookStyleNotes: '',
    trim: { widthIn: 8.5, heightIn: 8.5 },
    stylePresets: [{ name: 'Story' }],
    currentPageIndex: 1,
    pages: [
      {
        id: 1, title: 'Cover', layout: 'picture', text: 'Hello',
        images: [{ src: 'asset:1', prompt: 'cover' }],
        image: duplicatedLegacy,
        texts: [{ content: 'Hello', x: 1, y: 2, w: 3, h: 4 }],
        bgFit: 'cover', bgScale: 1, bgX: 50, bgY: 50,
      },
      {
        id: 2, title: 'Spread', layout: 'spread', text: 'Line',
        images: [{ src: 'asset:2', prompt: 'spread' }],
        image: 'data:image/png;base64,' + bB64,
        texts: [{ content: 'self-control. @@KFIMG1_0@@', x: 4, y: 5, w: 6, h: 7 }],
      },
    ],
  }, { 'asset:1': a, 'asset:2': b });

  const data = JSON.parse(text);
  assert.strictEqual(data.format, 'kindleforge-project');
  assert.strictEqual(data.book.pages.length, 2);
  assert.strictEqual(data.book.pages[0].images[0].src, duplicatedLegacy);
  assert.strictEqual(data.book.pages[0].image, '');
  assert.strictEqual(data.book.pages[1].images[0].src, 'data:image/png;base64,' + bB64);
  assert.strictEqual(data.book.pages[1].image, '');
  assert.strictEqual(text.split(aB64).length - 1, 1, 'first picture is stored once');
  assert.strictEqual(text.split(bB64).length - 1, 1, 'second picture is stored once');
  assert.strictEqual(data.book.pages[1].texts[0].content, 'self-control. @@KFIMG1_0@@');
  assert.strictEqual(data.currentPageIndex, 1);
  console.log('project-file: each picture is written once');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
