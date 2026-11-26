/* Split a word into the pieces the browser actually wrapped.
   A hyphen is a legal break, so one word can have two line boxes.
   Each piece must be drawn once. Drawing the whole word at every
   fragment's position paints it twice. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KFText = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function groupGlyphs(chars, rects) {
    const parts = [];
    let part = null;
    const text = String(chars || '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const r = rects && rects[i];
      if (!r || !(r.width > 0.15)) {
        if (part) part.text += ch;
        continue;
      }
      const line = Math.round(r.top);
      if (!part || Math.abs(part.line - line) > 1) {
        part = {
          line,
          text: ch,
          x: r.left,
          y: r.top,
          h: r.height || 0,
          right: r.left + r.width,
        };
        parts.push(part);
      } else {
        part.text += ch;
        part.y = Math.min(part.y, r.top);
        part.h = Math.max(part.h, r.height || 0, (r.top + (r.height || 0)) - part.y);
        part.right = Math.max(part.right, r.left + r.width);
      }
    }
    return parts.map((p) => ({
      text: p.text,
      x: p.x,
      y: p.y,
      w: Math.max(0.4, p.right - p.x),
      h: p.h,
    }));
  }

  return { groupGlyphs };
});
