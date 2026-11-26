/* Stream a KindleForge project to a file.
   Each picture is written once, from its original bytes, inside images[].src.
   The legacy page.image field is left empty when a picture is packed there,
   so a save cannot double the file. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KFProject = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function jsonEscape(value) {
    return JSON.stringify(value == null ? '' : String(value)).slice(1, -1);
  }

  function skeletonPage(page, index) {
    const tokens = [];
    const images = (page.images || []).map((im) => {
      const token = `@@KFIMG${index}_${tokens.length}@@`;
      tokens.push(im && im.src ? String(im.src) : '');
      const entry = { src: token, prompt: (im && im.prompt) || '' };
      if (page.layout === 'custom') {
        entry.x = im.x; entry.y = im.y; entry.w = im.w; entry.h = im.h;
      }
      return entry;
    });
    const record = {
      id: page.id,
      title: page.title || '',
      text: page.text || '',
      textPrompt: page.textPrompt || '',
      layout: page.layout,
      images,
      image: '',
      imagePrompt: page.imagePrompt || (images[0] && images[0].prompt) || '',
    };
    if (page.pageStart) record.pageStart = page.pageStart;
    if (page.textStyle) record.textStyle = page.textStyle;
    if (page.textFrame) record.textFrame = page.textFrame;
    if (page.texts) record.texts = page.texts;
    if (page.bgFit) record.bgFit = page.bgFit;
    if (page.bgScale != null) record.bgScale = page.bgScale;
    if (page.bgX != null) record.bgX = page.bgX;
    if (page.bgY != null) record.bgY = page.bgY;
    return { json: JSON.stringify(record), tokens };
  }

  async function writeBase64(bytes, write) {
    const chunk = 3 * 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, Math.min(bytes.length, i + chunk));
      let bin = '';
      for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]);
      await write(btoa(bin));
    }
  }

  async function writeProject(book, write, resolveImage) {
    const enc = new TextEncoder();
    const text = async (value) => { await write(enc.encode(value)); };
    const pages = book.pages || [];
    await text('{"format":"kindleforge-project","version":2,"savedAt":');
    await text(JSON.stringify(new Date().toISOString()));
    await text(',"currentPageIndex":' + (book.currentPageIndex || 0));
    await text(',"book":{"title":' + JSON.stringify(book.title || ''));
    await text(',"author":' + JSON.stringify(book.author || ''));
    await text(',"bookStyleNotes":' + JSON.stringify(book.bookStyleNotes || ''));
    await text(',"trim":' + JSON.stringify(book.trim || null));
    await text(',"stylePresets":' + JSON.stringify(book.stylePresets || []));
    await text(',"pages":[');
    for (let i = 0; i < pages.length; i++) {
      if (i) await text(',');
      const { json, tokens } = skeletonPage(pages[i], i);
      let rest = json;
      for (let t = 0; t < tokens.length; t++) {
        const token = `@@KFIMG${i}_${t}@@`;
        const needle = `"src":"${token}`;
        const at = rest.indexOf(needle);
        if (at < 0) throw new Error('Could not place a picture in the save file.');
        await text(rest.slice(0, at + '"src":"'.length));
        rest = rest.slice(at + needle.length);
        const src = tokens[t];
        const resolved = src ? await resolveImage(src) : null;
        if (resolved && resolved.bytes) {
          await text('data:' + (resolved.mime || 'image/png') + ';base64,');
          await writeBase64(resolved.bytes, text);
          resolved.bytes = null;
        } else {
          await text(jsonEscape(src));
        }
      }
      await text(rest);
    }
    await text(']}}');
  }

  return { writeProject, jsonEscape };
});
