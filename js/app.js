/* KindleForge picture-book editor.
   The illustration is a locked full-bleed background. Words live in texts[]
   and are positioned as percentages of the full-bleed canvas (a spread is
   both pages, including the outer bleed). */

(function () {
  const $ = (id) => document.getElementById(id);
  const CSS_DPI = 96;
  const PNG_DPI = 200;

  const PAGE_LAYOUTS = {
    'text-only':    { id: 'text-only', label: 'Text only', slots: 0, desc: 'Prose page, no picture.' },
    'image-top':    { id: 'image-top', label: 'Image + text', slots: 1, desc: 'Picture on top, words below.' },
    'image-bottom': { id: 'image-bottom', label: 'Text + image', slots: 1, desc: 'Words first, picture under them.' },
    'image-only':   { id: 'image-only', label: 'Full image', slots: 1, desc: 'Splash or silent page.' },
    'split':        { id: 'split', label: 'Side by side', slots: 1, desc: 'Picture left, words right.' },
    'two-stack':    { id: 'two-stack', label: '2 stacked', slots: 2, desc: 'Two pictures, then words.' },
    'two-side':     { id: 'two-side', label: '2 side-by-side', slots: 2, desc: 'Two scenes side by side.' },
    'three-row':    { id: 'three-row', label: '3 panels', slots: 3, desc: 'Three panels, then words.' },
    'custom':       { id: 'custom', label: 'Custom', slots: 3, desc: 'Drag up to 3 pictures and 3 text boxes.' },
    'picture':      { id: 'picture', label: 'Picture', slots: 1, desc: 'Full-bleed picture with text boxes on top. The picture file is never cropped.' },
    'spread':       { id: 'spread', label: 'Spread', slots: 1, desc: 'One wide picture across two pages. Text can sit anywhere on it.' },
  };

  const TRIM_PRESETS = [
    { id: 'kdp-8.5', label: '8.5 × 8.5 in square', w: 8.5, h: 8.5 },
    { id: 'kdp-8', label: '8 × 8 in square', w: 8, h: 8 },
    { id: 'kdp-7', label: '7 × 7 in square', w: 7, h: 7 },
    { id: 'trade', label: '6 × 9 in', w: 6, h: 9 },
    { id: 'digest', label: '5.5 × 8.5 in', w: 5.5, h: 8.5 },
    { id: 'letter', label: '8.5 × 11 in', w: 8.5, h: 11 },
    { id: 'custom', label: 'Custom size', w: 8.5, h: 8.5 },
  ];

  const FONTS = {
    serif: { label: 'Serif', css: "Georgia, 'Palatino Linotype', 'Times New Roman', serif", pdf: 'times' },
    sans: { label: 'Sans', css: "Arial, 'Helvetica Neue', Helvetica, sans-serif", pdf: 'helvetica' },
    nunito: {
      label: 'Nunito', css: "'Nunito', sans-serif",
      files: {
        regular: 'vendor/fonts/Nunito-Regular.ttf',
        bold: 'vendor/fonts/Nunito-Bold.ttf',
        italic: 'vendor/fonts/Nunito-Italic.ttf',
        boldItalic: 'vendor/fonts/Nunito-BoldItalic.ttf',
      },
    },
    baloo: {
      label: 'Baloo 2', css: "'Baloo 2', sans-serif",
      files: { regular: 'vendor/fonts/Baloo2-Regular.ttf', bold: 'vendor/fonts/Baloo2-Bold.ttf' },
    },
    andika: {
      label: 'Andika', css: "'Andika', sans-serif",
      files: {
        regular: 'vendor/fonts/Andika-Regular.ttf',
        bold: 'vendor/fonts/Andika-Bold.ttf',
        italic: 'vendor/fonts/Andika-Italic.ttf',
        boldItalic: 'vendor/fonts/Andika-BoldItalic.ttf',
      },
    },
  };

  const CLASSIC_TEXT = {
    font: 'serif', size: 'md', sizePt: 12, align: 'left', weight: 'normal', style: 'normal',
    leading: 1.65, tracking: 0, color: '#2c2522',
    strokeOn: false, strokeWidth: 1.5, strokeColor: '#fffaf3',
    shadowOn: false, shadowX: 0, shadowY: 1.5, shadowBlur: 1.2, shadowColor: '#1c140e', shadowOpacity: 0.35,
    panelOn: false, panelColor: '#fbf6ec', panelOpacity: 0.92, panelRadius: 10, panelPad: 8,
  };
  const PICTURE_TEXT = {
    ...CLASSIC_TEXT,
    font: 'nunito', size: 'custom', sizePt: 22, align: 'center', leading: 1.22, panelPad: 12, panelRadius: 14,
    color: '#2a2118',
  };
  const LEGACY_SIZE_PT = { sm: 11, md: 12, lg: 14, xl: 18 };
  const LEGACY_LEADING = { tight: 1.35, normal: 1.65, loose: 1.9 };

  const BUILTIN_PRESETS = [
    {
      name: 'Story cream panel',
      style: { font: 'nunito', sizePt: 20, align: 'center', leading: 1.25, tracking: 0, weight: 'normal', style: 'normal', color: '#2a2118', panelOn: true, panelColor: '#fbf6ec', panelOpacity: 0.94, panelRadius: 14, panelPad: 12, strokeOn: false, shadowOn: false },
    },
    {
      name: 'Outline shout',
      style: { font: 'baloo', sizePt: 42, align: 'center', leading: 1, tracking: 0.01, weight: 'bold', style: 'normal', color: '#fffaf3', strokeOn: true, strokeWidth: 2.4, strokeColor: '#3a2418', panelOn: false, shadowOn: false },
    },
    {
      name: 'Soft shadow',
      style: { font: 'nunito', sizePt: 28, align: 'center', leading: 1.15, weight: 'bold', color: '#fffaf3', shadowOn: true, shadowX: 0, shadowY: 2, shadowBlur: 1.4, shadowColor: '#1c140e', shadowOpacity: 0.45, strokeOn: false, panelOn: false },
    },
  ];

  const ILLUSTRATION_STYLES = ['Whimsical Storybook', 'Soft Watercolor', 'Detailed Pen & Ink', 'Magical Realism', 'Cozy Autumn', 'Vintage Children\'s'];
  const PROJECT_FORMAT = 'kindleforge-project';
  const PROJECT_VERSION = 2;
  const PROJECT_GUIDE = {
    summary: 'KindleForge book. Pictures are stored whole. Text is a separate layer.',
    trim: 'widthIn and heightIn are the trim in inches. bleedIn (usually 0.125) sits outside the trim. safetyIn (usually 0.5) is the green guide, inset from the trim, where words should stay.',
    canvas: 'On a picture page, texts[].x/y/w/h are percentages of the full-bleed page (trim + bleed on every side). On a spread they are percentages of the whole spread, including both outer bleeds. The gutter is the exact centre.',
    images: 'images[0].src is the background. It is never cropped in the file. bgFit is cover or contain. bgScale, bgX and bgY only change how the picture sits.',
    text: 'sizePt is the type size in print points. **double asterisks** make a word bold and *single asterisks* make a word italic. strokeOn, shadowOn and panelOn switch the outline, shadow and panel.',
    spreads: 'Print export splits a spread into two pages and repeats a bleed-wide strip across the gutter so the picture still meets after binding.',
  };

  let book = blankBook();
  let currentPageIndex = 0;
  let activeTextSlot = 0;
  let activeImageSlot = 0;
  let showGuides = true;
  let snapEnabled = true;
  let zoom = 1;
  let drag = null;
  let saveTimer = null;
  let historyTimer = null;
  let pendingFiles = null;
  const history = { stack: [], index: -1, lock: false };
  const measureCanvas = document.createElement('canvas').getContext('2d');

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function num(v, fb) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
  function blankBook() {
    return {
      title: 'Untitled Book', author: '', bookStyleNotes: '', pages: [],
      trim: { preset: 'kdp-8.5', widthIn: 8.5, heightIn: 8.5, bleedIn: 0.125, safetyIn: 0.5 },
      stylePresets: [],
    };
  }
  function isPictureLayout(pageOrId) {
    const id = typeof pageOrId === 'string' ? pageOrId : pageOrId?.layout;
    return id === 'picture' || id === 'spread';
  }
  function isSpread(pageOrId) {
    const id = typeof pageOrId === 'string' ? pageOrId : pageOrId?.layout;
    return id === 'spread';
  }
  function isCustomLayout(pageOrId) {
    const id = typeof pageOrId === 'string' ? pageOrId : pageOrId?.layout;
    return id === 'custom';
  }
  function isBoxText(page) { return isPictureLayout(page) || isCustomLayout(page); }
  function currentPage() { return book.pages[currentPageIndex]; }
  function getTrim() {
    const t = book.trim || {};
    const preset = TRIM_PRESETS.find((p) => p.id === t.preset) || TRIM_PRESETS[0];
    const custom = t.preset === 'custom';
    return {
      preset: custom ? 'custom' : preset.id,
      widthIn: clamp(num(custom ? t.widthIn : preset.w, preset.w), 3, 20),
      heightIn: clamp(num(custom ? t.heightIn : preset.h, preset.h), 3, 20),
      bleedIn: clamp(num(t.bleedIn, 0.125), 0, 0.5),
      safetyIn: clamp(num(t.safetyIn, 0.5), 0, 1.5),
    };
  }
  function canvasInches(trim, spread) {
    return {
      w: (spread ? trim.widthIn * 2 : trim.widthIn) + trim.bleedIn * 2,
      h: trim.heightIn + trim.bleedIn * 2,
    };
  }
  function sheetPixels(trim, spread) {
    const inches = canvasInches(trim, spread);
    return { ...inches, wPx: Math.round(inches.w * CSS_DPI), hPx: Math.round(inches.h * CSS_DPI) };
  }
  function insets(trim, spread) {
    const full = canvasInches(trim, spread);
    return {
      bleedX: trim.bleedIn / full.w * 100,
      bleedY: trim.bleedIn / full.h * 100,
      safeX: (trim.bleedIn + trim.safetyIn) / full.w * 100,
      safeY: (trim.bleedIn + trim.safetyIn) / full.h * 100,
      gutterSafe: trim.safetyIn / full.w * 100,
    };
  }
  function cleanHex(v, fb) {
    if (typeof v !== 'string') return fb;
    let s = v.trim();
    if (!s.startsWith('#')) s = '#' + s;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) s = '#' + s.slice(1).split('').map((c) => c + c).join('');
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fb;
  }
  function hexToRgb(hex) {
    const h = cleanHex(hex, '#000000').slice(1);
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function hexToRgba(hex, a) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${clamp(Number(a) || 0, 0, 1)})`;
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeXml(s) {
    return String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  }
  function slug(name) {
    return (name || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'book';
  }
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function normalizeTextStyle(raw, fallback) {
    const base = fallback || CLASSIC_TEXT;
    const s = { ...base, ...(raw && typeof raw === 'object' ? raw : {}) };
    const font = FONTS[s.font] ? s.font : (s.font === 'sans' ? 'sans' : 'serif');
    let sizePt = Number(s.sizePt);
    if (!Number.isFinite(sizePt) || sizePt <= 0) sizePt = LEGACY_SIZE_PT[s.size] || base.sizePt;
    sizePt = clamp(sizePt, 6, 200);
    const size = LEGACY_SIZE_PT[s.size] ? s.size : 'custom';
    const align = ['left', 'center', 'right', 'justify'].includes(s.align) ? s.align : base.align;
    let leading = Number(s.leading);
    if (!Number.isFinite(leading)) leading = LEGACY_LEADING[s.leading] || base.leading;
    leading = clamp(leading, 0.8, 3);
    return {
      font, size, sizePt, align,
      weight: s.weight === 'bold' ? 'bold' : 'normal',
      style: s.style === 'italic' ? 'italic' : 'normal',
      leading,
      tracking: clamp(num(s.tracking, 0), -0.1, 0.6),
      color: cleanHex(s.color, base.color),
      strokeOn: !!s.strokeOn,
      strokeWidth: clamp(num(s.strokeWidth, base.strokeWidth), 0.25, 12),
      strokeColor: cleanHex(s.strokeColor, base.strokeColor),
      shadowOn: !!s.shadowOn,
      shadowX: clamp(num(s.shadowX, 0), -20, 20),
      shadowY: clamp(num(s.shadowY, 1.5), -20, 20),
      shadowBlur: clamp(num(s.shadowBlur, 1.2), 0, 20),
      shadowColor: cleanHex(s.shadowColor, base.shadowColor),
      shadowOpacity: clamp(num(s.shadowOpacity, 0.35), 0, 1),
      panelOn: !!s.panelOn,
      panelColor: cleanHex(s.panelColor, base.panelColor),
      panelOpacity: clamp(num(s.panelOpacity, 0.92), 0, 1),
      panelRadius: clamp(num(s.panelRadius, base.panelRadius), 0, 48),
      panelPad: clamp(num(s.panelPad, base.panelPad), 0, 48),
    };
  }

  function shadowLayers(style) {
    if (!style.shadowOn) return [];
    const b = style.shadowBlur;
    const layers = [{ dx: style.shadowX, dy: style.shadowY, op: style.shadowOpacity }];
    if (b > 0.2) {
      const s = b * 0.55;
      layers.push(
        { dx: style.shadowX + s, dy: style.shadowY + s * 0.35, op: style.shadowOpacity * 0.45 },
        { dx: style.shadowX - s * 0.7, dy: style.shadowY + s * 0.5, op: style.shadowOpacity * 0.32 },
        { dx: style.shadowX, dy: style.shadowY + s, op: style.shadowOpacity * 0.28 },
      );
    }
    return layers;
  }
  function shadowCss(style) {
    if (!style.shadowOn) return 'none';
    const px = (pt) => (pt * CSS_DPI / 72).toFixed(2) + 'px';
    return shadowLayers(style).map((l) => `${px(l.dx)} ${px(l.dy)} 0 ${hexToRgba(style.shadowColor, l.op)}`).join(', ');
  }
  function textCss(style) {
    const px = style.sizePt * CSS_DPI / 72;
    const stroke = style.strokeOn ? `${(style.strokeWidth * CSS_DPI / 72).toFixed(2)}px ${style.strokeColor}` : '0 transparent';
    return [
      `font-family:${FONTS[style.font]?.css || FONTS.serif.css}`,
      `font-size:${px}px`,
      `line-height:${style.leading}`,
      `text-align:${style.align}`,
      `font-weight:${style.weight === 'bold' ? 700 : 400}`,
      `font-style:${style.style}`,
      `letter-spacing:${style.tracking}em`,
      `color:${style.color}`,
      `-webkit-text-stroke:${stroke}`,
      'paint-order:stroke fill',
      `text-shadow:${shadowCss(style)}`,
    ].join(';');
  }

  function markupToHtml(src) {
    const esc = escapeHtml(src || '');
    const withBold = esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const withEm = withBold.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return withEm.replace(/\n/g, '<br>');
  }
  function htmlToMarkup(el) {
    function walk(node) {
      if (node.nodeType === 3) return node.nodeValue.replace(/\u00a0/g, ' ');
      if (node.nodeType !== 1) return '';
      const tag = node.tagName;
      if (tag === 'BR') return '\n';
      let inner = Array.from(node.childNodes).map(walk).join('');
      if ((tag === 'DIV' || tag === 'P') && node.previousSibling) inner = '\n' + inner;
      if (tag === 'STRONG' || tag === 'B') return `**${inner}**`;
      if (tag === 'EM' || tag === 'I') return `*${inner}*`;
      return inner;
    }
    return walk(el).replace(/\n{3,}/g, '\n\n');
  }

  function frameCustom(raw, fb, minW, minH) {
    return {
      x: clamp(num(raw?.x, fb.x), 0, 95),
      y: clamp(num(raw?.y, fb.y), 0, 95),
      w: clamp(num(raw?.w, fb.w), minW, 100),
      h: clamp(num(raw?.h, fb.h), minH, 100),
    };
  }
  function framePicture(raw, fb) {
    let x = clamp(num(raw?.x, fb.x), 0, 98);
    let y = clamp(num(raw?.y, fb.y), 0, 98);
    let w = clamp(num(raw?.w, fb.w), 4, 100);
    let h = clamp(num(raw?.h, fb.h), 3, 100);
    if (x + w > 100) w = Math.max(4, 100 - x);
    if (y + h > 100) h = Math.max(3, 100 - y);
    return { x, y, w, h };
  }
  function defaultImageFrame(i, count) {
    if (count <= 1) return { x: 8, y: 6, w: 84, h: 42 };
    if (count === 2) return i === 0 ? { x: 6, y: 6, w: 42, h: 40 } : { x: 52, y: 6, w: 42, h: 40 };
    return [{ x: 4, y: 5, w: 30, h: 36 }, { x: 35, y: 5, w: 30, h: 36 }, { x: 66, y: 5, w: 30, h: 36 }][i];
  }
  function defaultTextFrame(i, count) {
    if (count <= 1) return { x: 8, y: 54, w: 84, h: 38 };
    if (count === 2) return i === 0 ? { x: 6, y: 48, w: 88, h: 20 } : { x: 6, y: 72, w: 88, h: 22 };
    return [{ x: 6, y: 46, w: 88, h: 14 }, { x: 6, y: 62, w: 88, h: 14 }, { x: 6, y: 78, w: 88, h: 16 }][i] || { x: 8, y: 54, w: 84, h: 20 };
  }
  function defaultPictureFrame(page, i) {
    const g = insets(getTrim(), isSpread(page));
    if (!isSpread(page)) {
      return { x: g.safeX + 1, y: 70, w: Math.max(20, 100 - 2 * g.safeX - 2), h: 18 };
    }
    const span = 50 - g.gutterSafe - g.safeX - 2;
    if (i % 2 === 0) return { x: 50 + g.gutterSafe + 1, y: 72, w: Math.max(16, span), h: 18 };
    return { x: g.safeX + 1, y: 72, w: Math.max(16, span), h: 16 };
  }
  function makeText(raw, frame, picture) {
    const style = normalizeTextStyle(raw, picture ? PICTURE_TEXT : CLASSIC_TEXT);
    return { content: raw?.content || '', ...frame, ...style };
  }

  function normalizePage(page, index) {
    const p = page && typeof page === 'object' ? page : {};
    const layout = PAGE_LAYOUTS[p.layout] ? p.layout : 'image-top';
    const picture = isPictureLayout(layout);
    const custom = layout === 'custom';
    let images = Array.isArray(p.images) ? p.images.map((im) => ({ ...(im || {}) })) : [];
    if (p.image && (!images[0] || !images[0].src)) {
      if (!images[0]) images[0] = { src: '', prompt: '' };
      images[0].src = p.image;
      if (p.imagePrompt && !images[0].prompt) images[0].prompt = p.imagePrompt;
    }
    if (layout === 'text-only') {
      images = [];
    } else if (picture) {
      const src = images[0]?.src || '';
      const prompt = images[0]?.prompt || p.imagePrompt || '';
      images = [{ src, prompt }];
    } else if (custom) {
      let n = Math.min(3, Math.max(1, images.length || 1));
      while (images.length < n) images.push({ src: '', prompt: '' });
      images = images.slice(0, n).map((im, i) => ({
        src: im.src || '', prompt: im.prompt || '',
        ...frameCustom(im, defaultImageFrame(i, n), 12, 12),
      }));
    } else {
      const slots = PAGE_LAYOUTS[layout].slots;
      while (images.length < slots) images.push({ src: '', prompt: '' });
      images = images.slice(0, slots).map((im) => ({ src: im.src || '', prompt: im.prompt || '' }));
    }

    const out = {
      id: p.id || (Date.now() + index),
      title: p.title || `Page ${index + 1}`,
      text: p.text || '',
      textPrompt: p.textPrompt || '',
      layout,
      images,
      image: images[0]?.src || '',
      imagePrompt: images[0]?.prompt || '',
    };
    if (p.pageStart) out.pageStart = Math.max(1, Math.round(Number(p.pageStart) || 1));
    if (picture) {
      out.bgFit = p.bgFit === 'contain' ? 'contain' : 'cover';
      out.bgScale = clamp(num(p.bgScale, 1), 0.2, 4);
      out.bgX = clamp(num(p.bgX, 50), 0, 100);
      out.bgY = clamp(num(p.bgY, 50), 0, 100);
    }
    if (picture || custom) {
      let texts = Array.isArray(p.texts) ? p.texts.slice() : [];
      if (!texts.length && (p.text || custom)) {
        texts = [{ content: p.text || '', ...(p.textFrame || {}), ...(p.textStyle || {}) }];
      }
      if (custom) {
        texts = texts.slice(0, 3);
        if (!texts.length) texts = [{ content: '' }];
        const n = texts.length;
        texts = texts.map((t, i) => makeText(t, frameCustom(t, defaultTextFrame(i, n), 12, 8), false));
      } else {
        texts = texts.slice(0, 24).map((t, i) => makeText(t, framePicture(t, defaultPictureFrame(out, i)), true));
      }
      out.texts = texts;
      out.text = texts.map((t) => t.content || '').join('\n\n');
      out.textStyle = normalizeTextStyle(texts[0] || p.textStyle, picture ? PICTURE_TEXT : CLASSIC_TEXT);
      if (texts[0]) out.textFrame = { x: texts[0].x, y: texts[0].y, w: texts[0].w, h: texts[0].h };
    } else {
      out.textStyle = normalizeTextStyle(p.textStyle, CLASSIC_TEXT);
    }
    return out;
  }
  function normalizeBookPages() {
    book.pages = (book.pages || []).map((p, i) => normalizePage(p, i));
    book.trim = getTrim();
    if (!Array.isArray(book.stylePresets)) book.stylePresets = [];
  }
  function syncLegacy(page) {
    if (!page) return;
    page.image = page.images?.[0]?.src || '';
    page.imagePrompt = page.images?.[0]?.prompt || '';
    if (isBoxText(page) && page.texts) {
      page.text = page.texts.map((t) => t.content || '').join('\n\n');
      if (page.texts[0]) {
        page.textStyle = normalizeTextStyle(page.texts[0], isPictureLayout(page) ? PICTURE_TEXT : CLASSIC_TEXT);
        page.textFrame = { x: page.texts[0].x, y: page.texts[0].y, w: page.texts[0].w, h: page.texts[0].h };
      }
    }
  }

  function showToast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    $('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function showBanner(message, kind) {
    const el = $('app-banner');
    if (!el) { showToast(message); return; }
    el.classList.remove('hidden', 'error');
    if (kind === 'error') el.classList.add('error');
    $('app-banner-text').textContent = message;
  }
  function hideBanner() {
    const el = $('app-banner');
    if (el) el.classList.add('hidden');
  }

  /* Pictures live here as Blobs, never as multi-megabyte strings in the book,
     the undo stack, or localStorage. The book stores "asset:N". */
  const AUTOSAVE_JSON_LIMIT = 4_500_000;
  const BIG_BOOK_BYTES = 2_000_000;
  const PREVIEW_MAX = 2000;
  const THUMB_MAX = 180;
  const imageStore = { items: new Map(), next: 1, bigNoted: false, total: 0 };

  function isAssetId(src) {
    return typeof src === 'string' && src.startsWith('asset:');
  }
  function assetOf(src) {
    return isAssetId(src) ? imageStore.items.get(src) : null;
  }
  function noteBigBook() {
    if (imageStore.bigNoted || imageStore.total < BIG_BOOK_BYTES) return;
    imageStore.bigNoted = true;
    showBanner('This book is too big for the browser’s quick autosave (that store only holds a few megabytes). The pictures stay in this browser so a refresh can find them. Use Save Project for one file you can move to another computer.');
  }
  function dataUrlToBlob(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const header = dataUrl.slice(0, comma);
    const mime = (header.match(/^data:([^;,]+)/) || [])[1] || 'application/octet-stream';
    const b64 = dataUrl.slice(comma + 1);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  function putBlob(blob, mime) {
    const id = 'asset:' + (imageStore.next++);
    const type = mime || blob.type || 'image/png';
    imageStore.items.set(id, { blob, mime: type, stored: false });
    imageStore.total += blob.size || 0;
    if (imageStore.total >= BIG_BOOK_BYTES) noteBigBook();
    return id;
  }
  function ingestSrc(src) {
    if (!src || typeof src !== 'string') return src || '';
    if (isAssetId(src) || src.startsWith('blob:') || !src.startsWith('data:')) return src;
    if (src.length < 20000) return src;
    try {
      return putBlob(dataUrlToBlob(src));
    } catch (e) {
      console.warn('Could not unpack a picture', e);
      return src;
    }
  }
  async function ingestBookImages(bookLike, onProgress) {
    const pages = bookLike?.pages || [];
    const jobs = [];
    pages.forEach((p, pi) => {
      (p.images || []).forEach((im, ii) => {
        if (im && typeof im.src === 'string' && im.src.startsWith('data:') && im.src.length >= 20000) {
          jobs.push({ p, im, pi, ii });
        }
      });
      if (typeof p.image === 'string' && p.image.startsWith('data:') && p.image.length >= 20000) {
        const already = (p.images || []).some((im) => im && im.src === p.image);
        if (!already && !(p.images?.[0] && isAssetId(p.images[0].src))) jobs.push({ p, field: 'image', pi });
      }
    });
    for (let n = 0; n < jobs.length; n++) {
      const job = jobs[n];
      if (onProgress) onProgress(n + 1, jobs.length);
      const source = job.im ? job.im.src : job.p.image;
      const id = ingestSrc(source);
      if (job.im) {
        const previous = job.im.src;
        job.im.src = id;
        if (job.p.image === previous || job.p.image === source) job.p.image = id;
      } else {
        job.p.image = id;
        if (job.p.images?.[0] && !job.p.images[0].src) job.p.images[0].src = id;
      }
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  function blobPixelSize(bytes) {
    if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { w: view.getUint32(16), h: view.getUint32(20) };
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let i = 2;
      while (i + 8 < bytes.length) {
        if (bytes[i] !== 0xff) { i += 1; continue; }
        const marker = bytes[i + 1];
        const size = (bytes[i + 2] << 8) | bytes[i + 3];
        if (marker >= 0xc0 && marker <= 0xc3) {
          return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
        }
        if (!size) break;
        i += 2 + size;
      }
    }
    return null;
  }
  async function pixelSizeOfBlob(blob) {
    const head = new Uint8Array(await blob.slice(0, 128 * 1024).arrayBuffer());
    return blobPixelSize(head);
  }
  async function ensureScaled(id, kind) {
    const item = assetOf(id);
    if (!item) return '';
    const key = kind === 'thumb' ? 'thumbUrl' : 'previewUrl';
    if (item[key]) return item[key];
    if (item.pending && item.pending[kind]) return item.pending[kind];
    item.pending = item.pending || {};
    item.pending[kind] = (async () => {
      const maxEdge = kind === 'thumb' ? THUMB_MAX : PREVIEW_MAX;
      const size = item.size || await pixelSizeOfBlob(item.blob);
      item.size = size;
      let bmp;
      if (size && Math.max(size.w, size.h) > maxEdge) {
        const scale = maxEdge / Math.max(size.w, size.h);
        const w = Math.max(1, Math.round(size.w * scale));
        const h = Math.max(1, Math.round(size.h * scale));
        bmp = await createImageBitmap(item.blob, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' });
      } else {
        bmp = await createImageBitmap(item.blob);
      }
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      canvas.getContext('2d').drawImage(bmp, 0, 0);
      bmp.close();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', kind === 'thumb' ? 0.72 : 0.86));
      const url = URL.createObjectURL(blob || item.blob);
      item[key] = url;
      delete item.pending[kind];
      return url;
    })();
    try {
      return await item.pending[kind];
    } catch (e) {
      delete item.pending[kind];
      console.warn(e);
      try {
        const full = await createImageBitmap(item.blob);
        const maxEdge = kind === 'thumb' ? THUMB_MAX : PREVIEW_MAX;
        const scale = Math.min(1, maxEdge / Math.max(full.width, full.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(full.width * scale));
        canvas.height = Math.max(1, Math.round(full.height * scale));
        canvas.getContext('2d').drawImage(full, 0, 0, canvas.width, canvas.height);
        full.close();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        const url = URL.createObjectURL(blob);
        item[key] = url;
        return url;
      } catch (err) {
        console.warn(err);
        return '';
      }
    }
  }
  function viewUrl(src, kind) {
    if (!src) return '';
    if (!isAssetId(src)) return src;
    const item = assetOf(src);
    if (!item) return '';
    if (kind === 'thumb') return item.thumbUrl || '';
    if (kind === 'preview') return item.previewUrl || '';
    if (!item.fullUrl) item.fullUrl = URL.createObjectURL(item.blob);
    return item.fullUrl;
  }
  function releasePreview(exceptId) {
    imageStore.items.forEach((item, id) => {
      if (id !== exceptId && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        item.previewUrl = '';
      }
    });
  }
  let thumbQueue = Promise.resolve();
  let thumbPass = false;
  let thumbAgain = false;
  function queueThumbs() {
    if (thumbPass) { thumbAgain = true; return; }
    thumbPass = true;
    thumbQueue = thumbQueue.then(async () => {
      do {
        thumbAgain = false;
        const current = currentPage()?.images?.[0]?.src;
        if (isAssetId(current) && !assetOf(current)?.previewUrl) {
          await ensureScaled(current, 'preview');
          paintCurrentPreview();
        }
        const ids = [];
        book.pages.forEach((p) => {
          const src = p.images?.[0]?.src;
          if (isAssetId(src) && !assetOf(src)?.thumbUrl) ids.push(src);
        });
        for (const id of ids) {
          await ensureScaled(id, 'thumb');
          paintThumbs(id);
          await new Promise((r) => setTimeout(r, 0));
        }
      } while (thumbAgain);
      thumbPass = false;
    }).catch((e) => { thumbPass = false; console.warn('preview', e); });
  }
  function paintCurrentPreview() {
    const page = currentPage();
    const src = page?.images?.[0]?.src || '';
    const url = viewUrl(src, 'preview');
    const img = document.querySelector('#book-preview .sheet-img');
    if (img && url && img.getAttribute('src') !== url) {
      img.src = url;
      img.addEventListener('load', () => {
        const sheet = img.closest('.sheet-outer');
        if (sheet) layoutSheetImage(sheet, page);
      }, { once: true });
    }
    const side = $('bg-thumb');
    if (side && url) {
      side.src = url;
      side.style.display = 'block';
      const empty = $('bg-empty');
      if (empty) empty.style.display = 'none';
    }
  }
  function paintThumbs(id) {
    const url = viewUrl(id, 'thumb');
    if (!url) return;
    document.querySelectorAll(`.thumb-art[data-asset="${id}"]`).forEach((el) => {
      el.style.backgroundImage = `url('${url}')`;
    });
  }
  function openAssetDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('kindleforge', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open picture storage'));
    });
  }
  function assetIdsIn(bookLike) {
    const ids = new Set();
    (bookLike?.pages || []).forEach((p) => {
      (p.images || []).forEach((im) => { if (isAssetId(im?.src)) ids.add(im.src); });
      if (isAssetId(p.image)) ids.add(p.image);
    });
    return [...ids];
  }
  async function persistNewAssets() {
    const pending = [...imageStore.items.entries()].filter(([, item]) => !item.stored);
    if (!pending.length) return;
    const db = await openAssetDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      pending.forEach(([id, item]) => store.put({ id, mime: item.mime, blob: item.blob }));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Could not store pictures'));
    });
    pending.forEach(([, item]) => { item.stored = true; });
    db.close();
  }
  async function rehydrateAssets() {
    const ids = assetIdsIn(book);
    if (!ids.length) return;
    const db = await openAssetDb();
    const missing = [];
    for (const id of ids) {
      const row = await new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readonly');
        const req = tx.objectStore('assets').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (row?.blob) {
        imageStore.items.set(id, { blob: row.blob, mime: row.mime || row.blob.type, stored: true });
        imageStore.total += row.blob.size || 0;
        const n = Number(id.slice(6));
        if (n >= imageStore.next) imageStore.next = n + 1;
      } else missing.push(id);
    }
    db.close();
    if (imageStore.total >= BIG_BOOK_BYTES) noteBigBook();
    if (missing.length) {
      showBanner(`${missing.length} picture${missing.length === 1 ? '' : 's'} from the last session ${missing.length === 1 ? 'is' : 'are'} missing. Open the project file again.`, 'error');
    }
  }

  function storageBook() {
    return JSON.parse(JSON.stringify({ book, i: currentPageIndex }, (k, v) => {
      if ((k === 'src' || k === 'image') && typeof v === 'string' && v.length > 20000 && !isAssetId(v)) return '';
      return v;
    })).book;
  }

  function makeSnap() {
    return JSON.stringify({ book, i: currentPageIndex, t: activeTextSlot, im: activeImageSlot }, (k, v) => {
      if ((k === 'src' || k === 'image') && typeof v === 'string' && v.length > 20000 && !isAssetId(v)) return '';
      return v;
    });
  }
  function readSnap(s) {
    return JSON.parse(s);
  }
  function pushHistory() {
    if (history.lock) return;
    const snap = makeSnap();
    if (history.stack[history.index] === snap) return;
    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push(snap);
    if (history.stack.length > 40) {
      history.stack.shift();
    }
    history.index = history.stack.length - 1;
    updateUndo();
  }
  function commitSoon() {
    clearTimeout(historyTimer);
    historyTimer = setTimeout(pushHistory, 350);
  }
  function commitNow() {
    clearTimeout(historyTimer);
    pushHistory();
  }
  function restore(snap) {
    const data = readSnap(snap);
    history.lock = true;
    book = data.book;
    normalizeBookPages();
    currentPageIndex = clamp(data.i || 0, 0, Math.max(0, book.pages.length - 1));
    activeTextSlot = Number.isFinite(data.t) ? data.t : 0;
    activeImageSlot = data.im || 0;
    syncHeader();
    renderAll();
    history.lock = false;
    updateUndo();
  }
  function undo() {
    clearTimeout(historyTimer);
    const live = makeSnap();
    if (history.stack[history.index] !== live) {
      history.stack = history.stack.slice(0, history.index + 1);
      history.stack.push(live);
      history.index = history.stack.length - 1;
    }
    if (history.index <= 0) return;
    history.index -= 1;
    restore(history.stack[history.index]);
  }
  function redo() {
    clearTimeout(historyTimer);
    if (history.index >= history.stack.length - 1) return;
    history.index += 1;
    restore(history.stack[history.index]);
  }
  function resetHistory() {
    clearTimeout(historyTimer);
    history.stack = [];
    history.index = -1;
    pushHistory();
  }
  function updateUndo() {
    $('btn-undo').disabled = history.index <= 0;
    $('btn-redo').disabled = history.index >= history.stack.length - 1;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveLocal, 250);
  }
  function saveLocal() {
    try {
      syncHeaderFields();
      const payload = storageBook();
      const json = JSON.stringify(payload);
      if (json.length > AUTOSAVE_JSON_LIMIT) {
        showBanner('This book is too big for the browser’s quick autosave. Use Save Project to keep a copy.', 'error');
        return;
      }
      localStorage.setItem('kindleforge-book', json);
      localStorage.setItem('kindleforge-current-page', String(currentPageIndex));
      if (imageStore.total >= BIG_BOOK_BYTES) noteBigBook();
      persistNewAssets().catch((e) => {
        showBanner('The pictures could not be kept in this browser (' + (e.message || e) + '). Use Save Project before you close the tab.', 'error');
      });
    } catch (e) {
      console.warn('Autosave skipped', e);
      showBanner('The browser could not autosave this book (' + (e.name === 'QuotaExceededError' ? 'it is larger than the quick-save limit' : (e.message || e)) + '). Use Save Project.', 'error');
    }
  }
  function loadLocal() {
    try {
      const raw = localStorage.getItem('kindleforge-book');
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.pages)) return false;
      book = data;
      normalizeBookPages();
      currentPageIndex = clamp(parseInt(localStorage.getItem('kindleforge-current-page') || '0', 10) || 0, 0, book.pages.length - 1);
      return book.pages.length > 0;
    } catch (e) {
      return false;
    }
  }

  function syncHeaderFields() {
    book.title = $('book-title').value;
    book.author = $('book-author').value;
    const notes = $('book-style-notes');
    if (notes && document.activeElement !== notes) book.bookStyleNotes = notes.value;
    else if (notes && document.activeElement === notes) book.bookStyleNotes = notes.value;
  }
  function syncHeader() {
    $('book-title').value = book.title || '';
    $('book-author').value = book.author || '';
    const notes = $('book-style-notes');
    if (notes) notes.value = book.bookStyleNotes || '';
  }

  function imagePlacement(imgW, imgH, boxW, boxH, fit, scale, posX, posY) {
    if (!imgW || !imgH || !boxW || !boxH) return null;
    const ir = imgW / imgH;
    const cr = boxW / boxH;
    let w; let h;
    if ((fit === 'contain' && ir > cr) || (fit !== 'contain' && ir <= cr)) {
      w = boxW; h = boxW / ir;
    } else {
      h = boxH; w = boxH * ir;
    }
    w *= scale || 1; h *= scale || 1;
    return {
      x: (boxW - w) * ((posX ?? 50) / 100),
      y: (boxH - h) * ((posY ?? 50) / 100),
      w, h,
    };
  }
  function layoutSheetImage(sheet, page) {
    const img = sheet.querySelector('.sheet-img');
    if (!img || !img.naturalWidth) return;
    const place = imagePlacement(img.naturalWidth, img.naturalHeight, sheet.clientWidth, sheet.clientHeight, page.bgFit, page.bgScale, page.bgX, page.bgY);
    if (!place) return;
    img.style.left = (place.x / sheet.clientWidth * 100) + '%';
    img.style.top = (place.y / sheet.clientHeight * 100) + '%';
    img.style.width = (place.w / sheet.clientWidth * 100) + '%';
    img.style.height = (place.h / sheet.clientHeight * 100) + '%';
  }

  function guidesHtml(trim, spread) {
    if (!showGuides) return '';
    const g = insets(trim, spread);
    if (!spread) {
      return `<div class="guide trim" style="left:${g.bleedX}%;top:${g.bleedY}%;right:${g.bleedX}%;bottom:${g.bleedY}%"></div>
        <div class="guide safe" style="left:${g.safeX}%;top:${g.safeY}%;right:${g.safeX}%;bottom:${g.safeY}%"></div>`;
    }
    const leftTrimW = 50 - g.bleedX;
    const leftSafeW = 50 - g.gutterSafe - g.safeX;
    return `<div class="guide trim" style="left:${g.bleedX}%;top:${g.bleedY}%;width:${leftTrimW}%;bottom:${g.bleedY}%"></div>
      <div class="guide trim" style="left:50%;top:${g.bleedY}%;right:${g.bleedX}%;bottom:${g.bleedY}%"></div>
      <div class="gutter"></div>
      <div class="guide safe" style="left:${g.safeX}%;top:${g.safeY}%;width:${leftSafeW}%;bottom:${g.safeY}%"></div>
      <div class="guide safe" style="left:${50 + g.gutterSafe}%;top:${g.safeY}%;right:${g.safeX}%;bottom:${g.safeY}%"></div>`;
  }

  function textBoxHtml(tb, i, selected) {
    const st = normalizeTextStyle(tb, PICTURE_TEXT);
    const pad = st.panelPad * CSS_DPI / 72;
    const radius = st.panelRadius * CSS_DPI / 72;
    const bg = st.panelOn ? hexToRgba(st.panelColor, st.panelOpacity) : 'transparent';
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<i data-handle="${h}" class="handle ${h}"></i>`).join('');
    const empty = !(tb.content || '').trim();
    return `<div class="tbox${selected ? ' selected' : ''}${empty ? ' is-empty' : ''}" data-slot="${i}" style="left:${tb.x}%;top:${tb.y}%;width:${tb.w}%;height:${tb.h}%;background:${bg};border-radius:${radius}px;padding:${pad}px">
      <div class="grip" data-grip>Drag</div>
      <div class="tbox-text" contenteditable="${selected ? 'true' : 'false'}" spellcheck="false" style="${textCss(st)}">${markupToHtml(tb.content)}</div>
      ${handles}
    </div>`;
  }

  function sheetHtml(page, opts = {}) {
    const trim = getTrim();
    const spread = isSpread(page);
    const px = sheetPixels(trim, spread);
    const src = page.images?.[0]?.src || '';
    const shown = opts.measure ? '' : viewUrl(src, 'preview');
    const img = !src
      ? `<div class="sheet-empty">Drop a picture here<br><span style="font-size:12px">It stays whole. Words go on top.</span></div>`
      : `<img class="sheet-img" alt="" decoding="async" ${shown ? `src="${escapeHtml(shown)}"` : `data-wait="${escapeHtml(src)}"`}>`;
    const texts = (page.texts || []).map((tb, i) => textBoxHtml(tb, i, i === activeTextSlot)).join('');
    return `<div class="sheet-outer" style="width:${px.wPx}px;height:${px.hPx}px">
      <div class="sheet-clip">${img}</div>
      <div class="text-layer">${texts}</div>
      <div class="guide-layer">${guidesHtml(trim, spread)}<div class="snap-layer"></div></div>
    </div>`;
  }

  function previewImage(src, maxH, label) {
    const shown = src ? viewUrl(src, 'preview') : '';
    if (shown) return `<img class="paper-img" style="max-height:${maxH}px" src="${escapeHtml(shown)}" alt="" data-zoom="1">`;
    if (isAssetId(src)) return `<img class="paper-img" data-wait="${escapeHtml(src)}" style="max-height:${maxH}px" alt="">`;
    return `<div class="ph-empty" style="min-height:${Math.min(maxH, 140)}px">${label || 'No picture yet'}</div>`;
  }
  function flowText(page) {
    const st = normalizeTextStyle(page.textStyle, CLASSIC_TEXT);
    const raw = page.text || '';
    const html = raw ? escapeHtml(raw).replace(/\n/g, '<br><br>') : '<span style="color:#8a7566;font-style:italic">No text yet.</span>';
    return `<div class="flow-text" style="${textCss(st)};${st.panelOn ? `background:${hexToRgba(st.panelColor, st.panelOpacity)};border-radius:${st.panelRadius}px;padding:${st.panelPad}px;` : ''}">${html}</div>`;
  }
  function customHtml(page) {
    const images = (page.images || []).map((im, i) => {
      const f = frameCustom(im, defaultImageFrame(i, page.images.length), 12, 12);
      const shown = im.src ? viewUrl(im.src, 'preview') : '';
      const inner = !im.src
        ? `<div class="ph-empty" style="height:100%">Image ${i + 1}</div>`
        : (shown
          ? `<img src="${escapeHtml(shown)}" alt="">`
          : `<img alt="" data-wait="${escapeHtml(im.src)}">`);
      return `<div class="custom-box${i === activeImageSlot ? ' selected' : ''}" data-slot="${i}" data-kind="image" style="left:${f.x}%;top:${f.y}%;width:${f.w}%;height:${f.h}%">
        <div class="custom-box-badge">Img ${i + 1}</div>${inner}
        <div class="custom-resize" data-kind="resize" data-slot="${i}"></div>
      </div>`;
    }).join('');
    const texts = (page.texts || []).map((tb, i) => {
      const f = frameCustom(tb, defaultTextFrame(i, page.texts.length), 12, 8);
      const st = normalizeTextStyle(tb, CLASSIC_TEXT);
      return `<div class="custom-text-box${i === activeTextSlot ? ' selected' : ''}" data-slot="${i}" data-kind="text" style="left:${f.x}%;top:${f.y}%;width:${f.w}%;height:${f.h}%">
        <div class="custom-box-badge">Txt ${i + 1}</div>
        <div class="flow-text" style="${textCss(st)}">${markupToHtml(tb.content) || 'Text'}</div>
        <div class="custom-resize" data-kind="text-resize" data-slot="${i}"></div>
      </div>`;
    }).join('');
    return `<div class="custom-canvas" id="custom-canvas">${images}${texts}</div><div class="custom-hint">Drag to move · corner to resize · up to 3 pictures and 3 text boxes</div>`;
  }

  function renderPreview() {
    const page = currentPage();
    const host = $('book-preview');
    if (!page) { host.innerHTML = ''; return; }
    book.pages[currentPageIndex] = normalizePage(page, currentPageIndex);
    const p = book.pages[currentPageIndex];
    if (isPictureLayout(p)) {
      const src = p.images?.[0]?.src || '';
      if (isAssetId(src)) releasePreview(src);
      host.innerHTML = sheetHtml(p);
      const sheet = host.querySelector('.sheet-outer');
      const img = sheet.querySelector('.sheet-img');
      if (img) {
        const place = () => layoutSheetImage(sheet, p);
        if (img.complete && img.naturalWidth) place();
        img.addEventListener('load', place, { once: true });
        if (!img.getAttribute('src') && isAssetId(src)) {
          ensureScaled(src, 'preview').then(() => paintCurrentPreview()).catch((e) => console.warn(e));
        }
      }
      $('stage-hint').textContent = 'Dashed line is the trim. Green is the safe area. Drag text; the picture stays locked.';
      return;
    }
    const imgs = p.images || [];
    const text = flowText(p);
    let body = '';
    const s0 = imgs[0]?.src || '';
    const s1 = imgs[1]?.src || '';
    const s2 = imgs[2]?.src || '';
    switch (p.layout) {
      case 'text-only': body = text; break;
      case 'custom': body = customHtml(p); break;
      case 'image-only':
        body = previewImage(s0, 640, 'Full-page picture');
        if (p.text) body += `<div style="margin-top:12px">${text}</div>`;
        break;
      case 'image-bottom': body = text + `<div style="margin-top:16px">${previewImage(s0, 280, 'Picture')}</div>`; break;
      case 'split':
        body = `<div class="layout-split"><div>${previewImage(s0, 420, 'Picture')}</div><div>${text}</div></div>`;
        break;
      case 'two-stack':
        body = `<div class="layout-stack">${previewImage(s0, 200, 'Image 1')}${previewImage(s1, 200, 'Image 2')}</div>${text}`;
        break;
      case 'two-side':
        body = `<div class="layout-two">${previewImage(s0, 220, 'Image 1')}${previewImage(s1, 220, 'Image 2')}</div>${text}`;
        break;
      case 'three-row':
        body = `<div class="layout-three">${previewImage(s0, 160, '1')}${previewImage(s1, 160, '2')}${previewImage(s2, 160, '3')}</div>${text}`;
        break;
      default:
        body = `${previewImage(s0, 320, 'Picture')}<div style="margin-top:16px">${text}</div>`;
    }
    host.innerHTML = `<article class="paper">
      <div class="paper-top"><h2 class="paper-title">${escapeHtml(p.title || 'Untitled')}</h2><div class="paper-folio">${currentPageIndex + 1} / ${book.pages.length}</div></div>
      ${body}
      <div class="paper-end">end of page</div>
    </article>`;
    host.querySelectorAll('img[data-wait]').forEach((img) => {
      const id = img.getAttribute('data-wait');
      if (isAssetId(id)) ensureScaled(id, 'preview').then((url) => { if (url) img.src = url; }).catch((e) => console.warn(e));
    });
    $('stage-hint').textContent = p.layout === 'custom'
      ? 'Custom layout: drag the boxes. Picture pages and spreads keep the art locked.'
      : 'This page uses a classic book layout. Switch to Picture or Spread for a full-bleed illustration.';
  }

  function renderPageList() {
    const list = $('page-list');
    list.innerHTML = '';
    book.pages.forEach((raw, index) => {
      const p = book.pages[index];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb' + (index === currentPageIndex ? ' active' : '');
      const src = p.images?.[0]?.src || '';
      const spread = isSpread(p);
      const artClass = spread || (src && isPictureLayout(p)) ? '' : ' page';
      const thumb = isAssetId(src) ? viewUrl(src, 'thumb') : src;
      const bg = thumb ? `background-image:url('${String(thumb).replace(/'/g, '%27')}')` : '';
      const assetAttr = isAssetId(src) ? ` data-asset="${src}"` : '';
      btn.innerHTML = `<div class="thumb-art${artClass}"${assetAttr} style="${bg}">${(p.texts || []).some((t) => (t.content || '').trim()) || p.text ? '<i class="mini-text"></i>' : ''}</div>
        <div class="thumb-meta"><strong>${escapeHtml(p.title || 'Untitled')}</strong><em>${escapeHtml(PAGE_LAYOUTS[p.layout]?.label || '')}</em></div>`;
      btn.addEventListener('click', () => selectPage(index));
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm(`Delete “${p.title || 'this page'}”?`)) deletePage(index);
      });
      list.appendChild(btn);
    });
    $('page-count').textContent = String(book.pages.length);
    queueThumbs();
  }

  function setFormValue(id, value) {
    const el = $(id);
    if (!el || document.activeElement === el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value;
  }

  function syncInspector() {
    const page = currentPage();
    if (!page) return;
    const picture = isPictureLayout(page);
    const custom = isCustomLayout(page);
    const boxes = picture || custom;
    $('picture-tools').classList.toggle('hidden', !picture);
    $('custom-tools').classList.toggle('hidden', !custom);
    $('card-bg').classList.toggle('hidden', !picture);
    $('card-align').classList.toggle('hidden', !boxes);
    $('card-boxes').classList.toggle('hidden', !boxes);
    $('custom-trim-fields').classList.toggle('hidden', getTrim().preset !== 'custom');
    setFormValue('page-title-input', page.title || '');
    setFormValue('page-start', page.pageStart || '');
    $('layout-desc').textContent = PAGE_LAYOUTS[page.layout]?.desc || '';
    const primary = ['picture', 'spread', 'custom'];
    const chips = primary.map((id) => {
      const L = PAGE_LAYOUTS[id];
      return `<button type="button" class="layout-chip${L.id === page.layout ? ' active' : ''}" data-layout="${L.id}">${L.label}</button>`;
    }).join('');
    const classic = Object.values(PAGE_LAYOUTS).filter((L) => !primary.includes(L.id));
    const more = classic.map((L) => `<option value="${L.id}"${L.id === page.layout ? ' selected' : ''}>${L.label}</option>`).join('');
    $('layout-picker').innerHTML = `${chips}<select id="layout-more" class="trim-select" aria-label="Other layouts"><option value="">Other layouts</option>${more}</select>`;

    const texts = boxes ? (page.texts || []) : [];
    $('text-box-list').innerHTML = texts.map((t, i) => {
      const label = (t.content || '').trim().split('\n')[0].slice(0, 42) || 'Empty text';
      return `<button type="button" class="slot-chip${i === activeTextSlot ? ' active' : ''}" data-text-slot="${i}">${i + 1}. ${escapeHtml(label)}</button>`;
    }).join('') || '<p class="hint">No text boxes yet.</p>';

    const content = boxes
      ? (texts[activeTextSlot]?.content || '')
      : (page.text || '');
    setFormValue('page-text-editor', content);
    const st = getActiveStyle();
    paintStyleForm(st);
    fillPresets();

    if (picture) {
      setFormValue('bg-fit', page.bgFit || 'cover');
      setFormValue('bg-scale', page.bgScale ?? 1);
      setFormValue('bg-scale-num', page.bgScale ?? 1);
      setFormValue('bg-x', page.bgX ?? 50);
      setFormValue('bg-y', page.bgY ?? 50);
      const src = page.images?.[0]?.src || '';
      const thumb = $('bg-thumb');
      const shown = viewUrl(src, 'preview') || viewUrl(src, 'thumb');
      thumb.style.display = shown ? 'block' : 'none';
      if (shown) thumb.src = shown;
      $('bg-empty').style.display = src ? 'none' : 'block';
    }
    const slots = picture ? 1 : (custom ? (page.images || []).length : (PAGE_LAYOUTS[page.layout].slots));
    const slotRow = $('image-slot-row');
    if (slots > 1) {
      slotRow.classList.remove('hidden');
      slotRow.innerHTML = Array.from({ length: slots }, (_, i) =>
        `<button type="button" class="slot-chip${i === activeImageSlot ? ' active' : ''}" data-image-slot="${i}">${page.images?.[i]?.src ? '●' : '○'} Image ${i + 1}</button>`
      ).join('');
    } else slotRow.classList.add('hidden');
    setFormValue('image-prompt', page.images?.[activeImageSlot]?.prompt || page.imagePrompt || '');
    setFormValue('text-prompt', page.textPrompt || '');

    const trim = getTrim();
    setFormValue('trim-select', trim.preset);
    setFormValue('bleed-in', trim.bleedIn);
    setFormValue('safety-in', trim.safetyIn);
    setFormValue('trim-w', trim.widthIn);
    setFormValue('trim-h', trim.heightIn);
    $('page-indicator').textContent = `Page ${currentPageIndex + 1} of ${book.pages.length}`;
    $('btn-guides').classList.toggle('on', showGuides);
    $('btn-snap').classList.toggle('on', snapEnabled);
  }

  function paintStyleForm(st) {
    setFormValue('style-font', st.font);
    setFormValue('style-size', st.sizePt);
    setFormValue('style-size-num', st.sizePt);
    setFormValue('style-leading', st.leading);
    setFormValue('style-leading-num', st.leading);
    setFormValue('style-tracking', st.tracking);
    setFormValue('style-tracking-num', round4(st.tracking));
    setFormValue('style-color', st.color);
    setFormValue('style-color-hex', st.color);
    setFormValue('style-stroke-on', st.strokeOn);
    setFormValue('style-stroke-width', st.strokeWidth);
    setFormValue('style-stroke-width-num', st.strokeWidth);
    setFormValue('style-stroke-color', st.strokeColor);
    setFormValue('style-stroke-hex', st.strokeColor);
    setFormValue('style-shadow-on', st.shadowOn);
    setFormValue('style-shadow-x', st.shadowX);
    setFormValue('style-shadow-y', st.shadowY);
    setFormValue('style-shadow-blur', st.shadowBlur);
    setFormValue('style-shadow-color', st.shadowColor);
    setFormValue('style-shadow-opacity', st.shadowOpacity);
    setFormValue('style-panel-on', st.panelOn);
    setFormValue('style-panel-color', st.panelColor);
    setFormValue('style-panel-opacity', st.panelOpacity);
    setFormValue('style-panel-radius', st.panelRadius);
    setFormValue('style-panel-pad', st.panelPad);
    $('block-stroke').classList.toggle('is-off', !st.strokeOn);
    $('block-shadow').classList.toggle('is-off', !st.shadowOn);
    $('block-panel').classList.toggle('is-off', !st.panelOn);
    $('style-bold').classList.toggle('on', st.weight === 'bold');
    $('style-italic').classList.toggle('on', st.style === 'italic');
    document.querySelectorAll('#style-align button').forEach((b) => b.classList.toggle('on', b.dataset.align === st.align));
    const ta = $('page-text-editor');
    ta.style.fontFamily = FONTS[st.font]?.css || 'serif';
    ta.style.fontSize = Math.min(22, Math.max(13, st.sizePt * 0.55)) + 'px';
    ta.style.textAlign = st.align;
    ta.style.fontWeight = st.weight === 'bold' ? '700' : '400';
    ta.style.fontStyle = st.style;
  }
  function round4(n) { return Math.round(n * 1000) / 1000; }

  function fillPresets() {
    const sel = $('preset-select');
    const cur = sel.value;
    const saved = book.stylePresets || [];
    const opts = [
      ...BUILTIN_PRESETS.map((p, i) => `<option value="built:${i}">${escapeHtml(p.name)}</option>`),
      ...saved.map((p, i) => `<option value="user:${i}">${escapeHtml(p.name)}</option>`),
    ];
    sel.innerHTML = opts.join('');
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
  }
  function presetByValue(v) {
    if (!v) return null;
    if (v.startsWith('built:')) return BUILTIN_PRESETS[Number(v.slice(6))]?.style;
    if (v.startsWith('user:')) return book.stylePresets[Number(v.slice(5))]?.style;
    return null;
  }

  function renderAll() {
    renderPageList();
    renderPreview();
    syncInspector();
    updateUndo();
  }

  function getActiveStyle() {
    const page = currentPage();
    if (!page) return normalizeTextStyle(null);
    if (isBoxText(page) && page.texts?.length && activeTextSlot >= 0 && page.texts[activeTextSlot]) {
      return normalizeTextStyle(page.texts[activeTextSlot], isPictureLayout(page) ? PICTURE_TEXT : CLASSIC_TEXT);
    }
    return normalizeTextStyle(page.textStyle, isPictureLayout(page) ? PICTURE_TEXT : CLASSIC_TEXT);
  }
  function writeActiveStyle(partial) {
    const page = currentPage();
    if (!page) return;
    const next = normalizeTextStyle({ ...getActiveStyle(), ...partial }, isPictureLayout(page) ? PICTURE_TEXT : CLASSIC_TEXT);
    if (isBoxText(page)) {
      if (!page.texts?.length) return;
      if (activeTextSlot < 0 || activeTextSlot >= page.texts.length) activeTextSlot = 0;
      Object.assign(page.texts[activeTextSlot], next);
      syncLegacy(page);
      paintBox(activeTextSlot);
    } else {
      page.textStyle = next;
      const el = document.querySelector('#book-preview .flow-text');
      if (el) el.setAttribute('style', textCss(next));
    }
    paintStyleForm(next);
    scheduleSave();
    commitSoon();
  }
  function paintBox(slot) {
    const page = currentPage();
    const tb = page?.texts?.[slot];
    const el = document.querySelector(`#book-preview .tbox[data-slot="${slot}"]`);
    if (!tb || !el) return;
    const st = normalizeTextStyle(tb, PICTURE_TEXT);
    el.style.background = st.panelOn ? hexToRgba(st.panelColor, st.panelOpacity) : 'transparent';
    el.style.borderRadius = (st.panelRadius * CSS_DPI / 72) + 'px';
    el.style.padding = (st.panelPad * CSS_DPI / 72) + 'px';
    const text = el.querySelector('.tbox-text');
    if (text) text.setAttribute('style', textCss(st));
  }

  function selectPage(index) {
    if (index < 0 || index >= book.pages.length) return;
    syncEditorToModel();
    currentPageIndex = index;
    activeTextSlot = 0;
    activeImageSlot = 0;
    renderAll();
    scheduleSave();
    requestAnimationFrame(zoomFit);
  }
  function syncEditorToModel() {
    const page = currentPage();
    const editor = $('page-text-editor');
    if (!page || !editor) return;
    if (isBoxText(page) && page.texts?.[activeTextSlot]) page.texts[activeTextSlot].content = editor.value;
    else page.text = editor.value;
    page.title = $('page-title-input').value;
    syncLegacy(page);
  }

  function addPage(layout) {
    syncEditorToModel();
    commitNow();
    const n = book.pages.length + 1;
    const page = normalizePage({
      id: Date.now(),
      title: layout === 'spread' ? `Spread ${n}` : `Page ${n}`,
      layout: layout || 'image-top',
      text: '',
    }, n);
    if (isPictureLayout(page)) {
      page.texts = [makeText({ content: '' }, defaultPictureFrame(page, 0), true)];
    }
    book.pages.push(page);
    currentPageIndex = book.pages.length - 1;
    activeTextSlot = 0;
    renderAll();
    commitNow();
    scheduleSave();
    requestAnimationFrame(zoomFit);
  }
  function deletePage(index) {
    if (book.pages.length <= 1) { showToast('Keep at least one page.'); return; }
    commitNow();
    book.pages.splice(index, 1);
    if (currentPageIndex >= book.pages.length) currentPageIndex = book.pages.length - 1;
    activeTextSlot = 0;
    renderAll();
    commitNow();
    scheduleSave();
  }
  function setLayout(id) {
    const page = currentPage();
    if (!page || !PAGE_LAYOUTS[id] || page.layout === id) return;
    commitNow();
    const prevImages = page.images || [];
    const prevTexts = page.texts ? page.texts.map((t) => ({ ...t })) : null;
    page.layout = id;
    if (isPictureLayout(id)) {
      page.images = [{ src: prevImages[0]?.src || page.image || '', prompt: prevImages[0]?.prompt || '' }];
      page.bgFit = page.bgFit || 'cover';
      page.bgScale = page.bgScale || 1;
      page.bgX = page.bgX ?? 50;
      page.bgY = page.bgY ?? 50;
      if (prevTexts?.length) page.texts = prevTexts;
      else page.texts = [makeText({ content: page.text || '' }, defaultPictureFrame(page, 0), true)];
    }
    book.pages[currentPageIndex] = normalizePage(page, currentPageIndex);
    activeTextSlot = 0;
    activeImageSlot = 0;
    renderAll();
    commitNow();
    scheduleSave();
    requestAnimationFrame(zoomFit);
  }

  function addTextBox() {
    const page = currentPage();
    if (!page || !isBoxText(page)) return;
    if (isCustomLayout(page) && (page.texts || []).length >= 3) { showToast('Custom pages hold 3 text boxes. Picture pages hold more.'); return; }
    commitNow();
    if (!page.texts) page.texts = [];
    const frame = isPictureLayout(page) ? defaultPictureFrame(page, page.texts.length) : defaultTextFrame(page.texts.length, page.texts.length + 1);
    page.texts.push(makeText({ content: '' }, frame, isPictureLayout(page)));
    activeTextSlot = page.texts.length - 1;
    syncLegacy(page);
    renderAll();
    commitNow();
    scheduleSave();
  }
  function removeTextBox() {
    const page = currentPage();
    if (!page || !isBoxText(page) || !page.texts?.length) return;
    if (isCustomLayout(page) && page.texts.length <= 1) { showToast('Custom pages keep one text box.'); return; }
    commitNow();
    page.texts.splice(Math.max(0, activeTextSlot), 1);
    if (activeTextSlot >= page.texts.length) activeTextSlot = page.texts.length - 1;
    syncLegacy(page);
    renderAll();
    commitNow();
    scheduleSave();
  }
  function duplicateTextBox() {
    const page = currentPage();
    if (!isPictureLayout(page) || !page.texts?.[activeTextSlot]) return;
    commitNow();
    const src = page.texts[activeTextSlot];
    const copy = makeText({ ...src, content: src.content }, framePicture({ ...src, x: src.x + 2, y: src.y + 2 }, src), true);
    page.texts.splice(activeTextSlot + 1, 0, copy);
    activeTextSlot += 1;
    syncLegacy(page);
    renderAll();
    commitNow();
    scheduleSave();
  }
  function addImageBox() {
    const page = currentPage();
    if (!isCustomLayout(page)) return;
    if ((page.images || []).length >= 3) { showToast('Three pictures is the maximum on a custom page.'); return; }
    commitNow();
    const n = page.images.length + 1;
    page.images.push({ src: '', prompt: '', ...defaultImageFrame(n - 1, n) });
    activeImageSlot = page.images.length - 1;
    syncLegacy(page);
    renderAll();
    commitNow();
  }
  function removeImageBox() {
    const page = currentPage();
    if (!isCustomLayout(page) || page.images.length <= 1) { showToast('Keep at least one image box, or switch layout.'); return; }
    commitNow();
    page.images.splice(activeImageSlot, 1);
    if (activeImageSlot >= page.images.length) activeImageSlot = page.images.length - 1;
    syncLegacy(page);
    renderAll();
    commitNow();
  }

  function selectText(slot) {
    const page = currentPage();
    if (!page?.texts || slot < 0 || slot >= page.texts.length) {
      activeTextSlot = -1;
      document.querySelectorAll('#book-preview .tbox').forEach((el) => {
        el.classList.remove('selected');
        const t = el.querySelector('.tbox-text');
        if (t) t.contentEditable = 'false';
      });
      syncInspector();
      return;
    }
    activeTextSlot = slot;
    document.querySelectorAll('#book-preview .tbox').forEach((el) => {
      const on = Number(el.dataset.slot) === slot;
      el.classList.toggle('selected', on);
      const t = el.querySelector('.tbox-text');
      if (t) t.contentEditable = on ? 'true' : 'false';
    });
    syncInspector();
  }

  function safeBounds(page, box) {
    const g = insets(getTrim(), isSpread(page));
    if (!isSpread(page)) return { l: g.safeX, r: 100 - g.safeX, t: g.safeY, b: 100 - g.safeY };
    const mid = box.x + box.w / 2;
    if (mid < 50) return { l: g.safeX, r: 50 - g.gutterSafe, t: g.safeY, b: 100 - g.safeY };
    return { l: 50 + g.gutterSafe, r: 100 - g.safeX, t: g.safeY, b: 100 - g.safeY };
  }
  function alignBox(which) {
    const page = currentPage();
    if (!isBoxText(page) || !page.texts?.[activeTextSlot]) return;
    const box = page.texts[activeTextSlot];
    const b = safeBounds(page, box);
    if (which === 'left') box.x = b.l;
    if (which === 'right') box.x = b.r - box.w;
    if (which === 'hcenter' || which === 'center') box.x = (b.l + b.r) / 2 - box.w / 2;
    if (which === 'top') box.y = b.t;
    if (which === 'bottom') box.y = b.b - box.h;
    if (which === 'vcenter' || which === 'center') box.y = (b.t + b.b) / 2 - box.h / 2;
    box.x = clamp(box.x, 0, 100 - box.w);
    box.y = clamp(box.y, 0, 100 - box.h);
    const el = document.querySelector(`#book-preview .tbox[data-slot="${activeTextSlot}"]`);
    if (el) { el.style.left = box.x + '%'; el.style.top = box.y + '%'; }
    else renderPreview();
    scheduleSave();
    commitNow();
  }
  function nudgeBox(dx, dy) {
    const page = currentPage();
    if (!isBoxText(page) || activeTextSlot < 0 || !page.texts?.[activeTextSlot]) return;
    const box = page.texts[activeTextSlot];
    box.x = clamp(box.x + dx, 0, 100 - box.w);
    box.y = clamp(box.y + dy, 0, 100 - box.h);
    const el = document.querySelector(`#book-preview .tbox[data-slot="${activeTextSlot}"], #book-preview .custom-text-box[data-slot="${activeTextSlot}"]`);
    if (el) { el.style.left = box.x + '%'; el.style.top = box.y + '%'; }
    scheduleSave();
    commitSoon();
  }

  function snapTargets(page, ignore) {
    const g = insets(getTrim(), isSpread(page));
    const xs = [0, 100, g.bleedX, 100 - g.bleedX, g.safeX, 100 - g.safeX, 50];
    const ys = [0, 100, g.bleedY, 100 - g.bleedY, g.safeY, 100 - g.safeY, 50];
    if (isSpread(page)) {
      xs.push(50 - g.gutterSafe, 50 + g.gutterSafe);
      xs.push((g.safeX + 50 - g.gutterSafe) / 2, (50 + g.gutterSafe + 100 - g.safeX) / 2);
    }
    (page.texts || []).forEach((t, i) => {
      if (i === ignore) return;
      xs.push(t.x, t.x + t.w, t.x + t.w / 2);
      ys.push(t.y, t.y + t.h, t.y + t.h / 2);
    });
    return { xs, ys };
  }
  function applySnap(frame, page, ignore, alt) {
    if (!snapEnabled || alt) return { frame, lines: [] };
    const { xs, ys } = snapTargets(page, ignore);
    const thresh = 0.85;
    let { x, y, w, h } = frame;
    const lines = [];
    let bestX = null;
    [{ edge: x, set: (v) => { x = v; } }, { edge: x + w, set: (v) => { x = v - w; } }, { edge: x + w / 2, set: (v) => { x = v - w / 2; } }].forEach((c) => {
      xs.forEach((line) => {
        const d = Math.abs(c.edge - line);
        if (d < thresh && (!bestX || d < bestX.d)) bestX = { d, line, set: c.set };
      });
    });
    if (bestX) { bestX.set(bestX.line); lines.push({ axis: 'v', at: bestX.line }); }
    let bestY = null;
    [{ edge: y, set: (v) => { y = v; } }, { edge: y + h, set: (v) => { y = v - h; } }, { edge: y + h / 2, set: (v) => { y = v - h / 2; } }].forEach((c) => {
      ys.forEach((line) => {
        const d = Math.abs(c.edge - line);
        if (d < thresh && (!bestY || d < bestY.d)) bestY = { d, line, set: c.set };
      });
    });
    if (bestY) { bestY.set(bestY.line); lines.push({ axis: 'h', at: bestY.line }); }
    x = clamp(x, 0, 100 - w);
    y = clamp(y, 0, 100 - h);
    return { frame: { x, y, w, h }, lines };
  }
  function showSnapLines(lines) {
    const host = document.querySelector('#book-preview .snap-layer');
    if (!host) return;
    host.innerHTML = lines.map((l) => l.axis === 'v'
      ? `<div class="snap-line v" style="left:${l.at}%"></div>`
      : `<div class="snap-line h" style="top:${l.at}%"></div>`).join('');
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    const custom = e.target.closest('#custom-canvas [data-kind], #custom-canvas .custom-box, #custom-canvas .custom-text-box');
    if (custom) { startCustomDrag(e); return; }
    const box = e.target.closest('#book-preview .tbox');
    if (!box) {
      if (e.target.closest('#book-preview .sheet-outer')) selectText(-1);
      return;
    }
    const handle = e.target.closest('[data-handle]');
    const onText = e.target.closest('.tbox-text');
    const slot = Number(box.dataset.slot);
    if (onText && !handle && activeTextSlot === slot) return;
    e.preventDefault();
    selectText(slot);
    const sheet = document.querySelector('#book-preview .sheet-outer');
    const rect = sheet.getBoundingClientRect();
    const tb = currentPage().texts[slot];
    drag = {
      kind: 'picture',
      slot,
      mode: handle ? handle.dataset.handle : 'move',
      startX: e.clientX, startY: e.clientY,
      rectW: rect.width, rectH: rect.height,
      orig: { x: tb.x, y: tb.y, w: tb.w, h: tb.h },
      moved: false,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }
  function onPointerMove(e) {
    if (!drag || drag.kind !== 'picture') return;
    const page = currentPage();
    const dx = (e.clientX - drag.startX) / drag.rectW * 100;
    const dy = (e.clientY - drag.startY) / drag.rectH * 100;
    const o = drag.orig;
    let x = o.x; let y = o.y; let w = o.w; let h = o.h;
    const mode = drag.mode;
    if (mode === 'move') { x = o.x + dx; y = o.y + dy; }
    else {
      if (mode.includes('e')) w = o.w + dx;
      if (mode.includes('s')) h = o.h + dy;
      if (mode.includes('w')) { x = o.x + dx; w = o.w - dx; }
      if (mode.includes('n')) { y = o.y + dy; h = o.h - dy; }
    }
    w = clamp(w, 4, 100); h = clamp(h, 3, 100);
    x = clamp(x, 0, 100 - w); y = clamp(y, 0, 100 - h);
    const snapped = applySnap({ x, y, w, h }, page, drag.slot, e.altKey);
    const f = snapped.frame;
    Object.assign(page.texts[drag.slot], f);
    const el = document.querySelector(`#book-preview .tbox[data-slot="${drag.slot}"]`);
    if (el) { el.style.left = f.x + '%'; el.style.top = f.y + '%'; el.style.width = f.w + '%'; el.style.height = f.h + '%'; }
    showSnapLines(snapped.lines);
    drag.moved = true;
  }
  function onPointerUp() {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    showSnapLines([]);
    if (moved) { syncLegacy(currentPage()); commitNow(); scheduleSave(); renderPageList(); }
  }

  function startCustomDrag(e) {
    const page = currentPage();
    if (!isCustomLayout(page)) return;
    const kindEl = e.target.closest('[data-kind]') || e.target.closest('[data-slot]');
    if (!kindEl) return;
    e.preventDefault();
    const slot = Number(kindEl.dataset.slot);
    const kind = kindEl.dataset.kind || (kindEl.classList.contains('custom-text-box') ? 'text' : 'image');
    if (kind === 'image' || kind === 'resize') activeImageSlot = slot;
    if (kind === 'text' || kind === 'text-resize') activeTextSlot = slot;
    const canvas = $('custom-canvas');
    const rect = canvas.getBoundingClientRect();
    const src = (kind === 'text' || kind === 'text-resize') ? page.texts[slot] : page.images[slot];
    drag = {
      kind: 'custom', mode: kind, slot,
      startX: e.clientX, startY: e.clientY,
      rectW: rect.width, rectH: rect.height,
      orig: { x: src.x, y: src.y, w: src.w, h: src.h },
      moved: false,
    };
    document.querySelectorAll('#custom-canvas .custom-box, #custom-canvas .custom-text-box').forEach((el) => {
      el.classList.toggle('selected', Number(el.dataset.slot) === slot && ((kind.startsWith('text') && el.classList.contains('custom-text-box')) || (!kind.startsWith('text') && el.classList.contains('custom-box'))));
    });
    window.addEventListener('pointermove', onCustomMove);
    window.addEventListener('pointerup', onCustomUp);
  }
  function onCustomMove(e) {
    if (!drag || drag.kind !== 'custom') return;
    const page = currentPage();
    const dx = (e.clientX - drag.startX) / drag.rectW * 100;
    const dy = (e.clientY - drag.startY) / drag.rectH * 100;
    const o = drag.orig;
    const resizing = drag.mode === 'resize' || drag.mode === 'text-resize';
    const min = 12;
    const next = resizing
      ? { x: o.x, y: o.y, w: clamp(o.w + dx, min, 100 - o.x), h: clamp(o.h + dy, min, 100 - o.y) }
      : { x: clamp(o.x + dx, 0, 100 - o.w), y: clamp(o.y + dy, 0, 100 - o.h), w: o.w, h: o.h };
    const target = (drag.mode === 'text' || drag.mode === 'text-resize') ? page.texts[drag.slot] : page.images[drag.slot];
    Object.assign(target, next);
    const sel = (drag.mode === 'text' || drag.mode === 'text-resize') ? '.custom-text-box' : '.custom-box';
    const el = document.querySelector(`#custom-canvas ${sel}[data-slot="${drag.slot}"]`);
    if (el) { el.style.left = next.x + '%'; el.style.top = next.y + '%'; el.style.width = next.w + '%'; el.style.height = next.h + '%'; }
    drag.moved = true;
  }
  function onCustomUp() {
    window.removeEventListener('pointermove', onCustomMove);
    window.removeEventListener('pointerup', onCustomUp);
    const moved = drag?.moved;
    drag = null;
    if (moved) { syncLegacy(currentPage()); commitNow(); scheduleSave(); syncInspector(); }
  }

  function setZoom(z) {
    zoom = clamp(z, 0.2, 2);
    $('stage-scaler').style.zoom = String(zoom);
    $('zoom-slider').value = String(Math.round(zoom * 100));
    $('zoom-label').textContent = Math.round(zoom * 100) + '%';
  }
  function zoomFit() {
    const vp = $('stage-viewport');
    const sheet = $('book-preview').firstElementChild;
    if (!sheet) return;
    const scale = Math.min((vp.clientWidth - 36) / sheet.offsetWidth, (vp.clientHeight - 28) / sheet.offsetHeight);
    setZoom(clamp(scale || 1, 0.2, 1.25));
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  function imageFileSize(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { const w = img.naturalWidth; const h = img.naturalHeight; URL.revokeObjectURL(url); resolve({ w, h }); };
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = url;
    });
  }
  async function setBackgroundFile(file) {
    const page = currentPage();
    if (!file) return;
    if (!isPictureLayout(page)) {
      setLayout('picture');
    }
    const id = putBlob(file, file.type);
    const p = currentPage();
    commitNow();
    p.images[0].src = id;
    p.images[0].prompt = p.images[0].prompt || file.name;
    syncLegacy(p);
    renderAll();
    commitNow();
    scheduleSave();
    showToast('Picture placed. The file is stored whole.');
  }
  async function stageImport(files) {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!images.length) { showToast('No images in that drop.'); return; }
    images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    if (images.length === 1 && isPictureLayout(currentPage())) {
      await setBackgroundFile(images[0]);
      return;
    }
    const pages = [];
    for (const file of images) {
      const size = await pixelSizeOfBlob(file);
      const id = putBlob(file, file.type);
      const spread = size && size.w / size.h >= 1.45;
      const page = normalizePage({
        id: Date.now() + pages.length,
        title: file.name.replace(/\.[^.]+$/, ''),
        layout: spread ? 'spread' : 'picture',
        images: [{ src: id, prompt: file.name }],
        bgFit: 'cover', bgScale: 1, bgX: 50, bgY: 50,
      }, pages.length);
      page.texts = [makeText({ content: '' }, defaultPictureFrame(page, 0), true)];
      pages.push(page);
    }
    pendingFiles = pages;
    const spreads = pages.filter((p) => p.layout === 'spread').length;
    $('import-summary').textContent = `${pages.length} picture${pages.length === 1 ? '' : 's'} in filename order (${spreads} wide enough to be spreads, ${pages.length - spreads} single pages).`;
    $('import-modal').classList.add('show');
  }
  function commitImport(replace) {
    if (!pendingFiles) return;
    commitNow();
    if (replace) {
      book.pages = pendingFiles;
      book.trim = { preset: 'kdp-8.5', widthIn: 8.5, heightIn: 8.5, bleedIn: 0.125, safetyIn: 0.5 };
      currentPageIndex = 0;
    } else {
      book.pages.push(...pendingFiles);
      currentPageIndex = book.pages.length - pendingFiles.length;
    }
    pendingFiles = null;
    $('import-modal').classList.remove('show');
    activeTextSlot = 0;
    renderAll();
    commitNow();
    scheduleSave();
    requestAnimationFrame(zoomFit);
    showToast('Pictures added in filename order.');
  }

  function parseManuscript(raw) {
    const text = String(raw || '').replace(/\r\n/g, '\n').trim();
    if (!text) return [];
    const lines = text.split('\n');
    if (lines.some((l) => /^###\s+Pages?\b/i.test(l))) {
      const chunks = [];
      let cur = null;
      let mode = '';
      const push = () => {
        if (!cur) return;
        const body = cur.lines.filter((l) => !l.trim().startsWith('*(')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        if (body) chunks.push({ title: cur.title, text: body });
      };
      for (const line of lines) {
        const h = line.match(/^###\s+Pages?\s+(.+)$/i);
        if (h) {
          push();
          cur = { title: h[1].replace(/\s+/g, ' ').trim(), lines: [] };
          mode = '';
          continue;
        }
        if (!cur) continue;
        if (/^\*\*Text:\*\*/i.test(line.trim())) { mode = 'text'; continue; }
        if (mode === 'text') {
          if (line.trim() === '---') { mode = ''; continue; }
          cur.lines.push(line);
        }
      }
      push();
      if (chunks.length) return chunks;
    }
    return text.split(/\n---\n/).map((part, i) => ({ title: `Page ${i + 1}`, text: part.trim() })).filter((p) => p.text);
  }
  function previewManuscript() {
    const chunks = parseManuscript($('manuscript-input').value);
    $('manuscript-preview').textContent = chunks.length
      ? `${chunks.length} page${chunks.length === 1 ? '' : 's'} found: ${chunks.slice(0, 6).map((c) => c.title).join(' · ')}${chunks.length > 6 ? '…' : ''}`
      : 'No pages recognised yet.';
  }
  function applyManuscript(addPages) {
    const chunks = parseManuscript($('manuscript-input').value);
    if (!chunks.length) { showToast('No pages found in that text.'); return; }
    commitNow();
    chunks.forEach((chunk, i) => {
      let page = book.pages[i];
      if (!page) {
        if (!addPages) return;
        page = normalizePage({ id: Date.now() + i, title: chunk.title, layout: 'picture', text: '' }, i);
        page.texts = [makeText({ content: '' }, defaultPictureFrame(page, 0), true)];
        book.pages.push(page);
      }
      if (!page.title || /^Page\b/i.test(page.title) || /^Spread\b/i.test(page.title)) page.title = chunk.title;
      if (isBoxText(page)) {
        if (!page.texts?.length) page.texts = [makeText({ content: '' }, isPictureLayout(page) ? defaultPictureFrame(page, 0) : defaultTextFrame(0, 1), isPictureLayout(page))];
        page.texts[0].content = chunk.text;
      } else page.text = chunk.text;
      syncLegacy(page);
    });
    $('manuscript-modal').classList.remove('show');
    renderAll();
    commitNow();
    scheduleSave();
    showToast(`Filled ${Math.min(chunks.length, book.pages.length)} page${chunks.length === 1 ? '' : 's'}.`);
  }

  function applyPreset() {
    const style = presetByValue($('preset-select').value);
    if (!style) return;
    writeActiveStyle(style);
    showToast('Style applied to this box.');
  }
  function savePreset() {
    const name = prompt('Name this text style', 'My story style');
    if (!name || !name.trim()) return;
    const style = getActiveStyle();
    book.stylePresets = book.stylePresets || [];
    const found = book.stylePresets.find((p) => p.name === name.trim());
    if (found) found.style = style;
    else book.stylePresets.push({ name: name.trim(), style });
    fillPresets();
    $('preset-select').value = 'user:' + (book.stylePresets.findIndex((p) => p.name === name.trim()));
    commitNow();
    scheduleSave();
    showToast('Style saved in this project.');
  }
  function applyStyleAll() {
    if (!confirm('Copy this look onto every text box in the book? Words and positions stay where they are.')) return;
    const style = getActiveStyle();
    book.pages.forEach((p) => {
      if (isBoxText(p)) (p.texts || []).forEach((t) => Object.assign(t, style));
      else p.textStyle = { ...style };
      syncLegacy(p);
    });
    renderAll();
    commitNow();
    scheduleSave();
    showToast('Style applied to every text box.');
  }

  function updateTrim(partial) {
    const trim = { ...getTrim(), ...partial };
    book.trim = trim;
    renderPreview();
    syncInspector();
    scheduleSave();
    commitSoon();
    requestAnimationFrame(zoomFit);
  }
  function updateBackground(partial) {
    const page = currentPage();
    if (!isPictureLayout(page)) return;
    Object.assign(page, partial);
    const sheet = document.querySelector('#book-preview .sheet-outer');
    if (sheet) layoutSheetImage(sheet, page);
    scheduleSave();
    commitSoon();
  }

  async function exportPDF() {
    if (!window.PDFLib) { showToast('PDF library failed to load.'); return; }
    syncEditorToModel();
    showToast('Building the print PDF…');
    try {
      const pdf = await PDFLib.PDFDocument.create();
      pdf.registerFontkit(window.fontkit);
      pdf.setTitle(book.title || 'Book');
      pdf.setAuthor(book.author || '');
      const fontCache = {};
      const imageCache = new Map();
      for (let i = 0; i < book.pages.length; i++) {
        const page = book.pages[i];
        if (isPictureLayout(page)) await addPicturePdf(pdf, page, fontCache, imageCache);
        else await addClassicPdf(pdf, page, fontCache, imageCache);
      }
      const bytes = await pdf.save();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${slug(book.title)}-print.pdf`);
      showToast('Print PDF downloaded.');
    } catch (e) {
      console.error(e);
      showToast('PDF export failed. Run the app from the local server (python -m http.server).');
    }
  }

  async function embedFace(pdf, cache, family, bold, italic) {
    const key = `${family}|${bold ? 'b' : 'n'}|${italic ? 'i' : 'n'}`;
    if (cache[key]) return cache[key];
    const spec = FONTS[family] || FONTS.serif;
    let font;
    if (!spec.files) {
      const map = {
        'times|n|n': PDFLib.StandardFonts.TimesRoman,
        'times|b|n': PDFLib.StandardFonts.TimesRomanBold,
        'times|n|i': PDFLib.StandardFonts.TimesRomanItalic,
        'times|b|i': PDFLib.StandardFonts.TimesRomanBoldItalic,
        'helvetica|n|n': PDFLib.StandardFonts.Helvetica,
        'helvetica|b|n': PDFLib.StandardFonts.HelveticaBold,
        'helvetica|n|i': PDFLib.StandardFonts.HelveticaOblique,
        'helvetica|b|i': PDFLib.StandardFonts.HelveticaBoldOblique,
      };
      const which = `${spec.pdf}|${bold ? 'b' : 'n'}|${italic ? 'i' : 'n'}`;
      font = await pdf.embedFont(map[which] || map['times|n|n']);
    } else {
      let file = spec.files.regular;
      if (bold && italic && spec.files.boldItalic) file = spec.files.boldItalic;
      else if (bold && spec.files.bold) file = spec.files.bold;
      else if (italic && spec.files.italic) file = spec.files.italic;
      const bytes = await fetch(file).then((r) => r.arrayBuffer());
      font = await pdf.embedFont(bytes, { subset: true });
    }
    cache[key] = font;
    return font;
  }
  async function fetchBytes(src) {
    if (!src) return null;
    if (isAssetId(src)) {
      const item = assetOf(src);
      if (!item) return null;
      return { bytes: new Uint8Array(await item.blob.arrayBuffer()), mime: item.mime || item.blob.type || 'image/png' };
    }
    if (src.startsWith('data:')) {
      const comma = src.indexOf(',');
      const mime = (src.slice(5, src.indexOf(';')) || 'image/jpeg');
      const bin = atob(src.slice(comma + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { bytes, mime };
    }
    const res = await fetch(src);
    if (!res.ok) throw new Error('image fetch failed');
    const mime = res.headers.get('content-type') || (/\.png($|\?)/i.test(src) ? 'image/png' : 'image/jpeg');
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
  }
  async function embedPicture(pdf, cache, src) {
    if (!src) return null;
    if (cache.has(src)) return cache.get(src);
    const got = await fetchBytes(src);
    if (!got) return null;
    const img = got.mime.includes('png') ? await pdf.embedPng(got.bytes) : await pdf.embedJpg(got.bytes);
    cache.set(src, img);
    return img;
  }

  async function measurePicture(page) {
    const host = $('measure-host');
    const trim = getTrim();
    const px = sheetPixels(trim, isSpread(page));
    host.innerHTML = sheetHtml(page, { measure: true });
    host.style.width = px.wPx + 'px';
    const sheet = host.querySelector('.sheet-outer');
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sheetRect = sheet.getBoundingClientRect();
    const scale = sheetRect.width / sheet.offsetWidth || 1;
    const boxes = [];
    const runs = [];
    sheet.querySelectorAll('.tbox').forEach((box) => {
      const slot = Number(box.dataset.slot);
      const tb = page.texts[slot];
      const st = normalizeTextStyle(tb, PICTURE_TEXT);
      const br = box.getBoundingClientRect();
      boxes.push({
        st,
        x: (br.left - sheetRect.left) / scale,
        y: (br.top - sheetRect.top) / scale,
        w: br.width / scale,
        h: br.height / scale,
      });
      const textEl = box.querySelector('.tbox-text');
      const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const value = node.nodeValue || '';
        const re = /\S+/g;
        let m;
        const bold = st.weight === 'bold' || !!node.parentElement?.closest('strong, b');
        const italic = st.style === 'italic' || !!node.parentElement?.closest('em, i');
        while ((m = re.exec(value))) {
          const word = m[0];
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + word.length);
          const rects = [...range.getClientRects()].filter((r) => r.width >= 0.4);
          let frags;
          if (rects.length <= 1) {
            frags = rects.map((r) => ({ text: word, x: r.left, y: r.top, w: r.width, h: r.height }));
          } else {
            const glyphRects = [];
            for (let i = 0; i < word.length; i++) {
              range.setStart(node, m.index + i);
              range.setEnd(node, m.index + i + 1);
              const g = [...range.getClientRects()].find((r) => r.width > 0.1);
              glyphRects.push(g ? { left: g.left, top: g.top, width: g.width, height: g.height } : null);
            }
            frags = (window.KFText ? KFText.groupGlyphs(word, glyphRects) : []);
          }
          frags.forEach((frag) => {
            if (!frag.text) return;
            runs.push({
              text: frag.text, bold, italic, st,
              x: (frag.x - sheetRect.left) / scale,
              y: (frag.y - sheetRect.top) / scale,
              w: frag.w / scale,
              h: frag.h / scale,
            });
          });
        }
      }
    });
    host.innerHTML = '';
    return { runs, boxes, wPx: px.wPx, hPx: px.hPx };
  }

  function baselineInRect(run) {
    const fontPx = run.st.sizePt * CSS_DPI / 72;
    const css = FONTS[run.st.font]?.css || 'sans-serif';
    measureCanvas.font = `${run.italic ? 'italic' : 'normal'} ${run.bold ? 700 : 400} ${fontPx}px ${css}`;
    const metrics = measureCanvas.measureText(run.text || 'H');
    const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent || fontPx * 0.8;
    const half = Math.max(0, (run.h - fontPx) / 2);
    return run.y + half + ascent;
  }

  async function addPicturePdf(pdf, page, fontCache, imageCache) {
    const trim = getTrim();
    const spread = isSpread(page);
    const media = {
      w: (trim.widthIn + trim.bleedIn * 2) * 72,
      h: (trim.heightIn + trim.bleedIn * 2) * 72,
    };
    const measured = await measurePicture(page);
    const slices = spread
      ? [
        { origin: 0, spreadSide: 'left' },
        { origin: (measured.wPx - Math.round(media.w / 72 * CSS_DPI)), spreadSide: 'right' },
      ]
      : [{ origin: 0, spreadSide: null }];
    const embedded = page.images?.[0]?.src ? await embedPicture(pdf, imageCache, page.images[0].src) : null;
    let place = null;
    if (embedded) {
      place = imagePlacement(embedded.width, embedded.height, measured.wPx, measured.hPx, page.bgFit || 'cover', page.bgScale || 1, page.bgX ?? 50, page.bgY ?? 50);
    }
    for (const slice of slices) {
      const pdfPage = pdf.addPage([media.w, media.h]);
      const bleedPt = trim.bleedIn * 72;
      pdfPage.setTrimBox(bleedPt, bleedPt, trim.widthIn * 72, trim.heightIn * 72);
      const toPt = (px) => px * 72 / CSS_DPI;
      if (embedded && place) {
        const x = toPt(place.x - slice.origin);
        const y = media.h - toPt(place.y) - toPt(place.h);
        pdfPage.drawImage(embedded, { x, y, width: toPt(place.w), height: toPt(place.h) });
      }
      measured.boxes.forEach((box) => {
        if (!box.st.panelOn) return;
        const xPt = toPt(box.x - slice.origin);
        const yPt = media.h - toPt(box.y) - toPt(box.h);
        const wPt = toPt(box.w);
        const hPt = toPt(box.h);
        if (xPt > media.w || xPt + wPt < 0) return;
        const c = hexToRgb(box.st.panelColor);
        const r = Math.min(box.st.panelRadius, wPt / 2, hPt / 2);
        pdfPage.drawSvgPath(roundedPath(xPt, yPt, wPt, hPt, r), {
          color: PDFLib.rgb(c.r / 255, c.g / 255, c.b / 255),
          opacity: box.st.panelOpacity,
        });
      });
      for (const run of measured.runs) {
        const xPx = run.x - slice.origin;
        const pageCssW = media.w / 72 * CSS_DPI;
        if (xPx > pageCssW + 8 || xPx + run.w < -8) continue;
        const font = await embedFace(pdf, fontCache, run.st.font, run.bold, run.italic);
        const size = run.st.sizePt;
        const y = media.h - toPt(baselineInRect(run));
        const tracking = run.st.tracking * size;
        const drawRun = (xShift, yShift, col, opacity, stroke) => {
          const color = PDFLib.rgb(col.r / 255, col.g / 255, col.b / 255);
          const show = () => {
            if (Math.abs(tracking) < 0.05) {
              pdfPage.drawText(run.text, { x: toPt(xPx) + xShift, y: y + yShift, size, font, color, opacity });
              return;
            }
            let cx = toPt(xPx) + xShift;
            for (const ch of run.text) {
              pdfPage.drawText(ch, { x: cx, y: y + yShift, size, font, color, opacity });
              cx += font.widthOfTextAtSize(ch, size) + tracking;
            }
          };
          const plan = stroke ? KFText.outlineDrawPlan(run.st.strokeWidth) : null;
          if (plan) {
            pdfPage.pushOperators(
              PDFLib.setStrokingRgbColor(stroke.r, stroke.g, stroke.b),
              PDFLib.setLineWidth(plan.lineWidth),
              PDFLib.setLineJoin(PDFLib.LineJoinStyle.Round),
              PDFLib.setLineCap(PDFLib.LineCapStyle.Round),
              PDFLib.setTextRenderingMode(PDFLib.TextRenderingMode.Outline),
            );
            show();
            pdfPage.pushOperators(PDFLib.setTextRenderingMode(PDFLib.TextRenderingMode.Fill));
          }
          show();
        };
        for (const layer of shadowLayers(run.st)) {
          drawRun(layer.dx, -layer.dy, hexToRgb(run.st.shadowColor), layer.op, null);
        }
        const stroke = run.st.strokeOn ? hexToRgb(run.st.strokeColor) : null;
        drawRun(0, 0, hexToRgb(run.st.color), 1, stroke && { r: stroke.r / 255, g: stroke.g / 255, b: stroke.b / 255 });
      }
    }
  }

  function roundedPath(x, y, w, h, r) {
    // pdf-lib flips SVG path Y, so these coordinates are negated PDF points.
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const Y = (v) => -v;
    const y0 = y;
    const y1 = y + h;
    return [
      `M ${x + r} ${Y(y0)}`,
      `L ${x + w - r} ${Y(y0)}`,
      `Q ${x + w} ${Y(y0)} ${x + w} ${Y(y0 + r)}`,
      `L ${x + w} ${Y(y1 - r)}`,
      `Q ${x + w} ${Y(y1)} ${x + w - r} ${Y(y1)}`,
      `L ${x + r} ${Y(y1)}`,
      `Q ${x} ${Y(y1)} ${x} ${Y(y1 - r)}`,
      `L ${x} ${Y(y0 + r)}`,
      `Q ${x} ${Y(y0)} ${x + r} ${Y(y0)}`,
      'Z',
    ].join(' ');
  }

  async function addClassicPdf(pdf, page, fontCache, imageCache) {
    const trim = getTrim();
    const media = { w: (trim.widthIn + trim.bleedIn * 2) * 72, h: (trim.heightIn + trim.bleedIn * 2) * 72 };
    const pdfPage = pdf.addPage([media.w, media.h]);
    const bleed = trim.bleedIn * 72;
    pdfPage.setTrimBox(bleed, bleed, trim.widthIn * 72, trim.heightIn * 72);
    const margin = bleed + 36;
    let y = media.h - margin;
    const st = normalizeTextStyle(page.textStyle, CLASSIC_TEXT);
    const font = await embedFace(pdf, fontCache, st.font, st.weight === 'bold', st.style === 'italic');
    const titleFont = await embedFace(pdf, fontCache, 'serif', true, false);
    if (page.title) {
      pdfPage.drawText(page.title, { x: margin, y: y - 18, size: 18, font: titleFont, color: PDFLib.rgb(0.17, 0.14, 0.12) });
      y -= 36;
    }
    for (const im of page.images || []) {
      if (!im.src || y < margin + 40) break;
      try {
        const img = await embedPicture(pdf, imageCache, im.src);
        const maxW = media.w - margin * 2;
        const maxH = Math.min(220, y - margin);
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        y -= h;
        pdfPage.drawImage(img, { x: margin, y, width: w, height: h });
        y -= 14;
      } catch (e) { console.warn(e); }
    }
    const body = (page.text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const size = st.sizePt;
    const col = hexToRgb(st.color);
    for (const para of body) {
      const words = para.split(/\s+/);
      let line = '';
      const maxW = media.w - margin * 2;
      const lines = [];
      words.forEach((word) => {
        const trial = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(trial, size) > maxW && line) { lines.push(line); line = word; }
        else line = trial;
      });
      if (line) lines.push(line);
      for (const ln of lines) {
        y -= size * st.leading;
        if (y < margin) return;
        let x = margin;
        const w = font.widthOfTextAtSize(ln, size);
        if (st.align === 'center') x = margin + (maxW - w) / 2;
        if (st.align === 'right') x = margin + maxW - w;
        pdfPage.drawText(ln, { x, y, size, font, color: PDFLib.rgb(col.r / 255, col.g / 255, col.b / 255) });
      }
      y -= size * 0.4;
    }
  }

  async function rasterPages(mime) {
    syncEditorToModel();
    showToast('Drawing pages…');
    const canvases = [];
    const names = [];
    let count = 0;
    for (const page of book.pages) {
      if (isPictureLayout(page)) {
        const made = await rasterPicture(page);
        made.forEach((c, i) => {
          count += 1;
          canvases.push(c);
          names.push(`${String(count).padStart(2, '0')}${isSpread(page) ? (i === 0 ? '-left' : '-right') : ''}.${mime === 'image/jpeg' ? 'jpg' : 'png'}`);
        });
      } else {
        count += 1;
        canvases.push(await rasterClassic(page));
        names.push(`${String(count).padStart(2, '0')}.${mime === 'image/jpeg' ? 'jpg' : 'png'}`);
      }
    }
    return { canvases, names };
  }
  async function rasterPicture(page) {
    const trim = getTrim();
    const spread = isSpread(page);
    const measured = await measurePicture(page);
    const mediaIn = { w: trim.widthIn + trim.bleedIn * 2, h: trim.heightIn + trim.bleedIn * 2 };
    const pagePxW = Math.round(mediaIn.w * CSS_DPI);
    const slices = spread ? [0, measured.wPx - pagePxW] : [0];
    const img = page.images?.[0]?.src ? await loadImage(page.images[0].src) : null;
    const place = img ? imagePlacement(img.naturalWidth, img.naturalHeight, measured.wPx, measured.hPx, page.bgFit || 'cover', page.bgScale || 1, page.bgX ?? 50, page.bgY ?? 50) : null;
    const scale = PNG_DPI / CSS_DPI;
    return slices.map((origin) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(pagePxW * scale);
      canvas.height = Math.round(measured.hPx * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pagePxW, measured.hPx);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, pagePxW, measured.hPx);
      ctx.clip();
      if (img && place) ctx.drawImage(img, place.x - origin, place.y, place.w, place.h);
      measured.boxes.forEach((box) => {
        if (!box.st.panelOn) return;
        const x = box.x - origin;
        if (x > pagePxW || x + box.w < 0) return;
        ctx.fillStyle = hexToRgba(box.st.panelColor, box.st.panelOpacity);
        roundRectPath(ctx, x, box.y, box.w, box.h, box.st.panelRadius * CSS_DPI / 72);
        ctx.fill();
      });
      measured.runs.forEach((run) => {
        const x = run.x - origin;
        if (x > pagePxW + 2 || x + run.w < -2) return;
        const fontPx = run.st.sizePt * CSS_DPI / 72;
        const css = FONTS[run.st.font]?.css || 'sans-serif';
        ctx.font = `${run.italic ? 'italic' : 'normal'} ${run.bold ? 700 : 400} ${fontPx}px ${css}`;
        ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const baseline = baselineInRect(run);
        const paint = (dx, dy, fill, stroke) => {
          const tracking = run.st.tracking * fontPx;
          ctx.fillStyle = fill || run.st.color;
          ctx.strokeStyle = run.st.strokeColor;
          ctx.lineWidth = run.st.strokeWidth * CSS_DPI / 72;
          if (Math.abs(tracking) < 0.2) {
            if (stroke && run.st.strokeOn) ctx.strokeText(run.text, x + dx, baseline + dy);
            if (fill) ctx.fillText(run.text, x + dx, baseline + dy);
            return;
          }
          let cx = x + dx;
          for (const ch of run.text) {
            if (stroke && run.st.strokeOn) ctx.strokeText(ch, cx, baseline + dy);
            if (fill) ctx.fillText(ch, cx, baseline + dy);
            cx += ctx.measureText(ch).width + tracking;
          }
        };
        shadowLayers(run.st).forEach((layer) => {
          const dx = layer.dx * CSS_DPI / 72;
          const dy = layer.dy * CSS_DPI / 72;
          paint(dx, dy, hexToRgba(run.st.shadowColor, layer.op), false);
        });
        paint(0, 0, run.st.color, run.st.strokeOn);
      });
      ctx.restore();
      return canvas;
    });
  }
  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      let url = src;
      let revoke = false;
      if (isAssetId(src)) {
        const item = assetOf(src);
        if (!item) { reject(new Error('Missing picture')); return; }
        url = URL.createObjectURL(item.blob);
        revoke = true;
      }
      const img = new Image();
      const done = () => { if (revoke) URL.revokeObjectURL(url); };
      img.onload = () => { done(); resolve(img); };
      img.onerror = () => { done(); reject(new Error('Could not read a picture')); };
      img.src = url;
    });
  }
  async function rasterClassic(page) {
    const trim = getTrim();
    const wIn = trim.widthIn + trim.bleedIn * 2;
    const hIn = trim.heightIn + trim.bleedIn * 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(wIn * PNG_DPI);
    canvas.height = Math.round(hIn * PNG_DPI);
    const ctx = canvas.getContext('2d');
    ctx.scale(PNG_DPI / 72, PNG_DPI / 72);
    const W = wIn * 72; const H = hIn * 72;
    ctx.fillStyle = '#f7f1e6';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2c2522';
    ctx.font = '18px Georgia, serif';
    const margin = trim.bleedIn * 72 + 36;
    let y = margin + 22;
    if (page.title) { ctx.fillText(page.title, margin, y); y += 28; }
    for (const im of page.images || []) {
      if (!im.src) continue;
      try {
        const img = await loadImage(im.src);
        const maxW = W - margin * 2;
        const maxH = 240;
        const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        ctx.drawImage(img, margin, y, img.naturalWidth * s, img.naturalHeight * s);
        y += img.naturalHeight * s + 16;
      } catch (e) { /* skip */ }
    }
    ctx.font = '12px Georgia, serif';
    const text = page.text || '';
    const maxW = W - margin * 2;
    text.split(/\n+/).forEach((para) => {
      const words = para.trim().split(/\s+/);
      let line = '';
      words.forEach((word) => {
        const trial = line ? line + ' ' + word : word;
        if (ctx.measureText(trial).width > maxW && line) {
          ctx.fillText(line, margin, y);
          y += 18;
          line = word;
        } else line = trial;
      });
      if (line) { ctx.fillText(line, margin, y); y += 18; }
      y += 8;
    });
    return canvas;
  }
  function canvasBlob(canvas, mime) {
    return new Promise((resolve) => canvas.toBlob(resolve, mime, 0.92));
  }
  async function exportImages(mime) {
    try {
      const { canvases, names } = await rasterPages(mime);
      const zip = new JSZip();
      for (let i = 0; i < canvases.length; i++) {
        const blob = await canvasBlob(canvases[i], mime);
        zip.file(names[i], blob);
      }
      const out = await zip.generateAsync({ type: 'blob' });
      downloadBlob(out, `${slug(book.title)}-${mime === 'image/jpeg' ? 'jpg' : 'png'}-pages.zip`);
      showToast('Page images downloaded as a zip.');
    } catch (e) {
      console.error(e);
      showToast('Image export failed.');
    }
  }
  async function exportScroll() {
    try {
      const { canvases } = await rasterPages('image/jpeg');
      const gap = 28;
      const width = Math.max(...canvases.map((c) => c.width));
      const height = canvases.reduce((sum, c) => sum + c.height, 0) + gap * (canvases.length + 1);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, width, height);
      let y = gap;
      canvases.forEach((c) => {
        const x = Math.round((width - c.width) / 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 8, y - 8, c.width + 16, c.height + 16);
        ctx.drawImage(c, x, y);
        y += c.height + gap;
      });
      const blob = await canvasBlob(canvas, 'image/jpeg');
      downloadBlob(blob, `${slug(book.title)}-review.jpg`);
      showToast('Tall review image downloaded.');
    } catch (e) {
      console.error(e);
      showToast('Could not build the review image.');
    }
  }

  async function exportEPUB() {
    if (typeof JSZip === 'undefined') { showToast('EPUB library failed to load.'); return; }
    syncEditorToModel();
    showToast('Building EPUB…');
    try {
      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
      zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
      const oebps = zip.folder('OEBPS');
      const textFolder = oebps.folder('Text');
      const imagesFolder = oebps.folder('images');
      const fontsFolder = oebps.folder('fonts');
      const fontHrefs = {};
      async function ensureFont(file, name) {
        if (fontHrefs[file]) return fontHrefs[file];
        const bytes = new Uint8Array(await fetch(file).then((r) => r.arrayBuffer()));
        fontsFolder.file(name, bytes);
        fontHrefs[file] = `../fonts/${name}`;
        return fontHrefs[file];
      }
      const allPicture = book.pages.every((p) => isPictureLayout(p));
      const manifest = [];
      const spine = [];
      const nav = [];
      let imgN = 0;
      const cssBits = [`body{margin:0;padding:0;} .flow{font-family:Georgia,serif;line-height:1.5;}`];
      for (const spec of Object.values(FONTS)) {
        if (!spec.files) continue;
        for (const [kind, file] of Object.entries(spec.files)) {
          const name = file.split('/').pop();
          const href = await ensureFont(file, name);
          const weight = kind.toLowerCase().includes('bold') ? 700 : 400;
          const style = kind.toLowerCase().includes('italic') ? 'italic' : 'normal';
          cssBits.push(`@font-face{font-family:${spec.css.split(',')[0]};src:url(${href.replace('../', '')}) format('truetype');font-weight:${weight};font-style:${style};}`);
        }
      }
      let spineIndex = 0;
      for (let i = 0; i < book.pages.length; i++) {
        const page = book.pages[i];
        if (isPictureLayout(page)) {
          const parts = await pictureEpubPages(page, imagesFolder, () => {
            imgN += 1;
            return `img_${String(imgN).padStart(2, '0')}`;
          });
          parts.forEach((part) => {
            const id = `p${String(++spineIndex).padStart(2, '0')}`;
            textFolder.file(`${id}.xhtml`, part.xhtml);
            manifest.push(`<item id="${id}" href="Text/${id}.xhtml" media-type="application/xhtml+xml"/>`);
            const props = ['rendition:layout-pre-paginated'];
            if (part.side === 'left') props.push('page-spread-left');
            if (part.side === 'right') props.push('page-spread-right');
            spine.push(`<itemref idref="${id}"${allPicture ? '' : ` properties="${props.join(' ')}"`}/>`);
            if (allPicture && part.side) spine[spine.length - 1] = `<itemref idref="${id}" properties="${part.side === 'left' ? 'page-spread-left' : 'page-spread-right'}"/>`;
            if (part.nav) nav.push({ href: `Text/${id}.xhtml`, title: part.nav });
            part.images.forEach((im) => {
              manifest.push(`<item id="${im.id}" href="images/${im.file}" media-type="${im.mime}"/>`);
            });
          });
        } else {
          const built = await classicEpubPage(page, imagesFolder, () => {
            imgN += 1;
            return `img_${String(imgN).padStart(2, '0')}`;
          });
          const id = `p${String(++spineIndex).padStart(2, '0')}`;
          textFolder.file(`${id}.xhtml`, built.xhtml);
          manifest.push(`<item id="${id}" href="Text/${id}.xhtml" media-type="application/xhtml+xml"/>`);
          spine.push(`<itemref idref="${id}"/>`);
          nav.push({ href: `Text/${id}.xhtml`, title: page.title || `Page ${i + 1}` });
          built.images.forEach((im) => manifest.push(`<item id="${im.id}" href="images/${im.file}" media-type="${im.mime}"/>`));
        }
      }
      Object.entries(fontHrefs).forEach(([file, href], idx) => {
        manifest.push(`<item id="font${idx}" href="${href.replace('../', '')}" media-type="font/ttf"/>`);
      });
      oebps.file('style.css', cssBits.join('\n'));
      const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head><body><nav epub:type="toc"><ol>
${nav.map((n) => `<li><a href="${n.href}">${escapeXml(n.title)}</a></li>`).join('\n')}
</ol></nav></body></html>`;
      oebps.file('nav.xhtml', navXhtml);
      const uid = uuid();
      const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(book.title || 'Untitled')}</dc:title>
    <dc:creator>${escapeXml(book.author || '')}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="BookID">urn:uuid:${uid}</dc:identifier>
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
    ${allPicture ? '<meta property="rendition:layout">pre-paginated</meta><meta property="rendition:spread">auto</meta>' : ''}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
    ${manifest.join('\n    ')}
  </manifest>
  <spine>
    ${spine.join('\n    ')}
  </spine>
</package>`;
      oebps.file('content.opf', opf);
      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
      downloadBlob(blob, `${slug(book.title)}.epub`);
      showToast(allPicture ? 'Fixed-layout EPUB downloaded.' : 'EPUB downloaded.');
    } catch (e) {
      console.error(e);
      showToast('EPUB export failed.');
    }
  }

  async function pictureEpubPages(page, imagesFolder, nextId) {
    const trim = getTrim();
    const spread = isSpread(page);
    const px = sheetPixels(trim, spread);
    const pageW = Math.round((trim.widthIn + trim.bleedIn * 2) * CSS_DPI);
    const pageH = px.hPx;
    const slices = spread
      ? [{ origin: 0, side: evenSide(page, 'left'), nav: page.title || 'Spread' }, { origin: px.wPx - pageW, side: 'right', nav: null }]
      : [{ origin: 0, side: evenSide(page, 'right'), nav: page.title || 'Page' }];
    // fix sides: even pageStart => left then right
    if (spread) {
      const start = page.pageStart || 2;
      slices[0].side = start % 2 === 0 ? 'left' : 'right';
      slices[1].side = slices[0].side === 'left' ? 'right' : 'left';
    }
    const images = [];
    let imgTag = '';
    if (page.images?.[0]?.src) {
      const got = await fetchBytes(page.images[0].src);
      const ext = got.mime.includes('png') ? 'png' : 'jpg';
      const id = nextId();
      const file = `${id}.${ext}`;
      imagesFolder.file(file, got.bytes);
      images.push({ id, file, mime: got.mime.includes('png') ? 'image/png' : 'image/jpeg' });
      const size = blobPixelSize(got.bytes) || { w: px.wPx, h: px.hPx };
      const place = imagePlacement(size.w, size.h, px.wPx, px.hPx, page.bgFit || 'cover', page.bgScale || 1, page.bgX ?? 50, page.bgY ?? 50);
      imgTag = { file, place };
    }
    return slices.map((slice) => {
      const imgHtml = imgTag ? `<img alt="" src="../images/${imgTag.file}" style="position:absolute;left:${(imgTag.place.x - slice.origin).toFixed(1)}px;top:${imgTag.place.y.toFixed(1)}px;width:${imgTag.place.w.toFixed(1)}px;height:${imgTag.place.h.toFixed(1)}px"/>` : '';
      const texts = (page.texts || []).map((tb) => {
        const st = normalizeTextStyle(tb, PICTURE_TEXT);
        const left = (tb.x / 100) * px.wPx - slice.origin;
        const top = (tb.y / 100) * px.hPx;
        const width = (tb.w / 100) * px.wPx;
        const height = (tb.h / 100) * px.hPx;
        if (left > pageW || left + width < 0) return '';
        const bg = st.panelOn ? `background:${hexToRgba(st.panelColor, st.panelOpacity)};border-radius:${st.panelRadius}px;` : '';
        return `<div style="position:absolute;left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${width.toFixed(1)}px;height:${height.toFixed(1)}px;overflow:hidden;box-sizing:border-box;padding:${st.panelPad}px;${bg}"><div style="${textCss(st)}">${markupToHtml(tb.content)}</div></div>`;
      }).join('');
      const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(page.title || '')}</title>
  <link rel="stylesheet" type="text/css" href="../style.css"/>
  <meta name="viewport" content="width=${pageW}, height=${pageH}"/>
</head>
<body style="margin:0;width:${pageW}px;height:${pageH}px;overflow:hidden;position:relative;">
  ${imgHtml}
  ${texts}
</body></html>`;
      return { xhtml, side: slice.side, nav: slice.nav, images: slice === slices[0] ? images : [] };
    });
  }
  function evenSide(page, fallback) {
    if (!page.pageStart) return fallback;
    return page.pageStart % 2 === 0 ? 'left' : 'right';
  }
  async function classicEpubPage(page, imagesFolder, nextId) {
    const images = [];
    let body = '';
    if (page.title) body += `<h1>${escapeXml(page.title)}</h1>`;
    const st = textCss(normalizeTextStyle(page.textStyle, CLASSIC_TEXT));
    for (const im of page.images || []) {
      if (!im.src) continue;
      try {
        const got = await fetchBytes(im.src);
        const ext = got.mime.includes('png') ? 'png' : 'jpg';
        const id = nextId();
        const file = `${id}.${ext}`;
        imagesFolder.file(file, got.bytes);
        images.push({ id, file, mime: got.mime.includes('png') ? 'image/png' : 'image/jpeg' });
        body += `<p><img src="../images/${file}" alt="" style="max-width:100%"/></p>`;
      } catch (e) { console.warn(e); }
    }
    const paras = isBoxText(page)
      ? (page.texts || []).map((t) => t.content)
      : (page.text || '').split(/\n+/);
    paras.filter((p) => (p || '').trim()).forEach((p) => {
      body += `<p class="flow" style="${st}">${escapeXml(p.trim())}</p>`;
    });
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(page.title || '')}</title>
<link rel="stylesheet" href="../style.css"/></head><body>${body}</body></html>`;
    return { xhtml, images };
  }

  function exportHTML() {
    syncEditorToModel();
    const trim = getTrim();
    const parts = book.pages.map((page) => {
      if (!isPictureLayout(page)) {
        const imgs = (page.images || []).filter((i) => i.src).map((i) => `<img src="${i.src}" style="max-width:100%">`).join('');
        return `<section style="max-width:640px;margin:40px auto;font-family:Georgia,serif"><h2>${escapeHtml(page.title || '')}</h2>${imgs}<div style="${textCss(normalizeTextStyle(page.textStyle))}">${escapeHtml(page.text || '').replace(/\n/g, '<br>')}</div></section>`;
      }
      const px = sheetPixels(trim, isSpread(page));
      return `<section style="margin:24px auto">${sheetHtml(page).replace('class="guide-layer"', 'class="guide-layer" style="display:none"')}</section>`;
    }).join('\n');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(book.title || '')}</title>
<link rel="stylesheet" href="css/app.css"></head><body style="overflow:auto;height:auto;background:#e4ddd4">${parts}</body></html>`;
    downloadBlob(new Blob([html], { type: 'text/html' }), `${slug(book.title)}.html`);
    showToast('HTML preview downloaded. Open it beside this folder so the pictures and fonts resolve.');
  }

  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2500);
  }

  async function buildProject() {
    syncEditorToModel();
    const pages = [];
    for (const page of book.pages) {
      const norm = normalizePage(page, pages.length);
      const images = [];
      for (const im of norm.images || []) {
        let src = im.src || '';
        if (src && !src.startsWith('data:')) {
          try { src = await srcToData(src); } catch (e) { /* keep the original path */ }
        }
        const entry = { src, prompt: im.prompt || '' };
        if (norm.layout === 'custom') { entry.x = im.x; entry.y = im.y; entry.w = im.w; entry.h = im.h; }
        images.push(entry);
      }
      const out = {
        id: norm.id, title: norm.title, text: norm.text, textPrompt: norm.textPrompt,
        layout: norm.layout,
        images,
        image: (images[0]?.src || '').length > 200000 ? '' : (images[0]?.src || ''),
        imagePrompt: images[0]?.prompt || '',
        textStyle: norm.textStyle,
      };
      if (norm.pageStart) out.pageStart = norm.pageStart;
      if (isPictureLayout(norm)) {
        out.bgFit = norm.bgFit; out.bgScale = norm.bgScale; out.bgX = norm.bgX; out.bgY = norm.bgY;
        out.texts = (norm.texts || []).map(serializeText);
      } else if (norm.layout === 'custom') {
        out.textFrame = norm.textFrame;
        out.texts = (norm.texts || []).map(serializeText);
      }
      pages.push(out);
    }
    return {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      guide: PROJECT_GUIDE,
      savedAt: new Date().toISOString(),
      currentPageIndex,
      book: {
        title: book.title, author: book.author, bookStyleNotes: book.bookStyleNotes || '',
        trim: getTrim(), stylePresets: book.stylePresets || [], pages,
      },
    };
  }
  function serializeText(t) {
    const st = normalizeTextStyle(t, PICTURE_TEXT);
    return { content: t.content || '', x: t.x, y: t.y, w: t.w, h: t.h, ...st };
  }
  function bytesToDataUrl(bytes, mime) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return `data:${mime || 'image/png'};base64,${btoa(binary)}`;
  }
  async function srcToData(src) {
    if (!src || src.startsWith('data:')) return src || '';
    const got = await fetchBytes(src);
    if (!got) return '';
    return bytesToDataUrl(got.bytes, got.mime);
  }
  async function saveProjectFile() {
    try {
      showBanner(imageStore.total >= BIG_BOOK_BYTES
        ? 'Packing the project… a large book takes a moment, and the file holds every picture.'
        : 'Packing the project…');
      const project = await buildProject();
      const pretty = imageStore.total < BIG_BOOK_BYTES;
      const blob = new Blob([JSON.stringify(project, null, pretty ? 2 : 0)], { type: 'application/json' });
      downloadBlob(blob, `${slug(project.book.title)}-${new Date().toISOString().slice(0, 10)}.kindleforge.json`);
      saveLocal();
      showToast('Project saved. Pictures are packed inside the file.');
      if (imageStore.total < BIG_BOOK_BYTES) hideBanner();
    } catch (e) {
      console.error(e);
      showBanner('Could not save the project. ' + (e.message || ''), 'error');
    }
  }
  async function loadProjectObject(data) {
    let loaded; let index = 0;
    if (data && data.format === PROJECT_FORMAT && data.book) {
      loaded = data.book; index = data.currentPageIndex || 0;
    } else if (data && Array.isArray(data.pages)) loaded = data;
    else if (data && data.book && Array.isArray(data.book.pages)) {
      loaded = data.book; index = data.currentPageIndex || 0;
    } else throw new Error('This is not a KindleForge project.');
    await ingestBookImages(loaded, (n, total) => {
      if (total > 1) showBanner(`Unpacking pictures… ${n} of ${total}`);
    });
    book = {
      title: loaded.title || 'Untitled',
      author: loaded.author || '',
      bookStyleNotes: loaded.bookStyleNotes || '',
      trim: loaded.trim || blankBook().trim,
      stylePresets: loaded.stylePresets || [],
      pages: loaded.pages || [],
    };
    normalizeBookPages();
    if (!book.pages.length) throw new Error('That project has no pages.');
    currentPageIndex = clamp(index, 0, book.pages.length - 1);
    activeTextSlot = 0;
    syncHeader();
    renderAll();
    resetHistory();
    saveLocal();
    requestAnimationFrame(zoomFit);
    if (imageStore.total >= BIG_BOOK_BYTES) {
      imageStore.bigNoted = true;
      showBanner('This book is too big for the browser’s quick autosave (that store only holds a few megabytes). The pictures stay in this browser so a refresh can find them. Use Save Project for one file you can move to another computer.');
    } else {
      hideBanner();
    }
  }
  function loadProjectFromFile(file) {
    if (!file) return;
    const mb = file.size / (1024 * 1024);
    const label = file.name || 'this project';
    if (mb > 8) {
      if (!confirm(`This project is ${mb.toFixed(0)} MB, pictures included.\n\nKindleForge will show smaller previews and keep the full pictures for export. The browser’s quick autosave cannot hold a file this big — use Save Project for a copy you can move.\n\nOpen “${label}”?`)) return;
    } else if (!confirm(`Load “${label}”? This replaces the book on screen.`)) return;
    showBanner(mb > 8 ? `Reading ${mb.toFixed(0)} MB…` : 'Reading the project…');
    const reader = new FileReader();
    reader.onerror = () => showBanner('Could not read that file.', 'error');
    reader.onload = () => {
      setTimeout(async () => {
        try {
          const data = JSON.parse(reader.result);
          await loadProjectObject(data);
          const name = data.book?.title || data.title || label;
          showToast(`Loaded ${name}.`);
          if (imageStore.total < BIG_BOOK_BYTES) hideBanner();
        } catch (e) {
          console.error(e);
          showBanner('Could not open that project. ' + (e.message || 'It may be damaged, or too large for this browser to read.'), 'error');
        }
      }, 40);
    };
    reader.readAsText(file);
  }
  async function loadPictureDemo(silent) {
    const res = await fetch('demo/wide-awake-kip-sample.kindleforge.json');
    if (!res.ok) throw new Error('demo missing');
    const data = await res.json();
    if (!silent && !confirm('Load the Wide-Awake Kip picture-book sample? This replaces the book on screen.')) return;
    loadProjectObject(data);
    if (!silent) showToast('Picture-book sample loaded.');
  }
  function loadFoxDemo() {
    if (!confirm('Load the classic fox demo? This replaces the book on screen.')) return;
    book = blankBook();
    book.title = 'The Fox and the Forgotten Star';
    book.author = 'by Elara Voss';
    book.bookStyleNotes = 'warm whimsical children\'s storybook tone';
    book.pages = [
      normalizePage({ id: 1, title: 'Cover', layout: 'image-only', text: '', image: 'generated/cover.jpg', imagePrompt: 'Storybook cover of a red fox and a glowing star' }, 0),
      normalizePage({ id: 2, title: 'The Discovery', layout: 'image-top', text: 'In the quiet hours between dusk and true night, a small red fox named Lira followed a thread of golden light.\n\nA star, no bigger than a hazelnut, rested on the moss and glowed with a patient warmth.', image: 'generated/1.jpg' }, 1),
      normalizePage({ id: 3, title: 'The Lantern', layout: 'two-side', text: 'Lira carried the star to an old lantern in the hollow of the oldest oak. The clearing lit up like summer.', images: [{ src: 'generated/2.jpg', prompt: '' }, { src: '', prompt: '' }] }, 2),
      normalizePage({ id: 4, title: 'What the Light Revealed', layout: 'split', text: 'The animals gathered. They did not speak. They sat in the circle of light and remembered what it felt like to be young.', image: '' }, 3),
    ];
    currentPageIndex = 0;
    syncHeader();
    renderAll();
    resetHistory();
    saveLocal();
  }
  async function makePortable() {
    let n = 0;
    for (const page of book.pages) {
      for (const im of page.images || []) {
        if (im.src && !im.src.startsWith('data:') && !isAssetId(im.src)) {
          try {
            const res = await fetch(im.src);
            const blob = await res.blob();
            im.src = putBlob(blob, blob.type);
            n += 1;
          } catch (e) { console.warn(e); }
        }
      }
      syncLegacy(page);
    }
    renderAll();
    saveLocal();
    showToast(n ? `Packed ${n} picture${n === 1 ? '' : 's'} into the book.` : 'Pictures were already packed in.');
  }

  function getBackend() {
    return {
      url: localStorage.getItem('kindleforge_backend_url') || 'http://localhost:8001',
      model: localStorage.getItem('kindleforge_ollama_model') || 'llama3.2',
    };
  }
  async function generateText() {
    const page = currentPage();
    const prompt = $('text-prompt').value.trim();
    if (!prompt) { showToast('Write a prompt first.'); return; }
    page.textPrompt = prompt;
    const multi = isBoxText(page) && (page.texts || []).length > 1;
    const instruction = multi
      ? `Write a short children's picture-book line (1–4 lines) for text box ${activeTextSlot + 1}. Request: ${prompt}\nBook: ${book.title}. Output only the line.`
      : `Write a warm page of about 160 words for a children's book. Request: ${prompt}\nBook: ${book.title}. Output only the page text.`;
    $('text-full-prompt').value = instruction;
    try {
      const { url, model } = getBackend();
      const res = await fetch(`${url}/generate-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: instruction, model }) });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const text = (data.text || '').trim();
      if (!text) throw new Error('Empty');
      $('page-text-editor').value = text;
      syncEditorToModel();
      renderAll();
      commitNow();
      showToast('Text is on the page.');
    } catch (e) {
      showToast('Backend unavailable. Paste text into the box, or start the local backend.');
      $('card-ai-text').open = true;
    }
  }
  async function generateImage() {
    const page = currentPage();
    const prompt = $('image-prompt').value.trim();
    if (!prompt) { showToast('Describe the picture first.'); return; }
    if (!page.images?.length) page.images = [{ src: '', prompt }];
    const slot = Math.min(activeImageSlot, page.images.length - 1);
    page.images[slot].prompt = prompt;
    try {
      const { url } = getBackend();
      const res = await fetch(`${url}/generate-image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      let src = '';
      if (data.image_base64) src = `data:image/png;base64,${data.image_base64}`;
      else if (data.image_path) src = data.image_path.startsWith('http') ? data.image_path : `${url.replace(/\/$/, '')}/${data.image_path.replace(/^\/+/, '')}`;
      if (!src) throw new Error('No image');
      page.images[slot].src = ingestSrc(src);
      syncLegacy(page);
      renderAll();
      commitNow();
      showToast('Picture placed.');
    } catch (e) {
      showToast('Image backend unavailable. Drop a picture on the page instead.');
    }
  }

  function bind() {
    document.body.addEventListener('click', (e) => {
      const menuBtn = e.target.closest('[data-menu]');
      if (menuBtn) {
        const menu = menuBtn.closest('.menu');
        const open = menu.classList.contains('open');
        document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
        if (!open) menu.classList.add('open');
        return;
      }
      if (!e.target.closest('.menu-pop')) document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
      const layout = e.target.closest('[data-layout]');
      if (layout) { setLayout(layout.dataset.layout); return; }
      const textSlot = e.target.closest('[data-text-slot]');
      if (textSlot) { selectText(Number(textSlot.dataset.textSlot)); return; }
      const imageSlot = e.target.closest('[data-image-slot]');
      if (imageSlot) { activeImageSlot = Number(imageSlot.dataset.imageSlot); syncInspector(); return; }
      const nudge = e.target.closest('[data-nudge]');
      if (nudge) {
        const [dx, dy] = nudge.dataset.nudge.split(',').map(Number);
        nudgeBox(dx, dy);
        return;
      }
      const align = e.target.closest('[data-align]');
      if (align && align.closest('#card-align')) { alignBox(align.dataset.align); return; }
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      const actions = {
        'import-images': () => $('images-file-input').click(),
        'import-folder': () => $('folder-file-input').click(),
        'import-manuscript': () => $('manuscript-modal').classList.add('show'),
        'export-pdf': exportPDF,
        'export-png': () => exportImages('image/png'),
        'export-jpg': () => exportImages('image/jpeg'),
        'export-scroll': exportScroll,
        'export-epub': exportEPUB,
        'export-html': exportHTML,
        'save-project': saveProjectFile,
        'load-project': () => { $('project-file-input').value = ''; $('project-file-input').click(); },
        'load-picture-demo': () => loadPictureDemo(false).catch(() => showToast('Could not load the sample. Use the local server.')),
        'load-fox-demo': loadFoxDemo,
        'make-portable': makePortable,
        settings: () => {
          $('backend-url').value = getBackend().url;
          $('ollama-model').value = getBackend().model;
          $('settings-modal').classList.add('show');
        },
        help: () => alert(helpText()),
        reset: resetBook,
        'add-page': () => addPage('image-top'),
        'add-picture': () => addPage('picture'),
        'add-spread': () => addPage('spread'),
        'prev-page': () => selectPage(currentPageIndex - 1),
        'next-page': () => selectPage(currentPageIndex + 1),
        'zoom-out': () => setZoom(zoom / 1.1),
        'zoom-in': () => setZoom(zoom * 1.1),
        'zoom-fit': zoomFit,
        'add-image': addImageBox,
        'remove-image': removeImageBox,
        'add-text': addTextBox,
        'remove-text': removeTextBox,
        'duplicate-text': duplicateTextBox,
        'delete-page': () => deletePage(currentPageIndex),
        'upload-bg': () => $('image-file-input').click(),
        'clear-bg': () => {
          const page = currentPage();
          if (!isPictureLayout(page)) return;
          page.images[0].src = '';
          syncLegacy(page);
          renderAll();
          commitNow();
        },
        'apply-preset': applyPreset,
        'save-preset': savePreset,
        'apply-all': applyStyleAll,
        'align-center': () => alignBox('center'),
        'generate-text': generateText,
        'regen-text': generateText,
        'apply-chat': () => {
          const v = $('text-grok-response').value.trim();
          if (!v) return;
          $('page-text-editor').value = v;
          syncEditorToModel();
          renderAll();
          commitNow();
        },
        'generate-image': generateImage,
        'regen-image': generateImage,
        'test-backend': testBackend,
        'close-settings': () => $('settings-modal').classList.remove('show'),
        'save-settings': () => {
          localStorage.setItem('kindleforge_backend_url', $('backend-url').value.trim() || 'http://localhost:8001');
          localStorage.setItem('kindleforge_ollama_model', $('ollama-model').value.trim() || 'llama3.2');
          $('settings-modal').classList.remove('show');
          showToast('Settings saved.');
        },
        'close-manuscript': () => $('manuscript-modal').classList.remove('show'),
        'fill-manuscript': () => applyManuscript(false),
        'fill-manuscript-new': () => applyManuscript(true),
        'close-import': () => { pendingFiles = null; $('import-modal').classList.remove('show'); },
        'import-append': () => commitImport(false),
        'import-replace': () => commitImport(true),
      };
      const fn = actions[action];
      if (fn) fn();
    });

    $('btn-undo').addEventListener('click', undo);
    $('btn-redo').addEventListener('click', redo);
    $('btn-theme').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('kindleforge-theme', next);
    });
    $('btn-guides').addEventListener('click', () => { showGuides = !showGuides; renderPreview(); syncInspector(); });
    $('btn-snap').addEventListener('click', () => { snapEnabled = !snapEnabled; syncInspector(); });
    $('rail-collapse').addEventListener('click', () => $('rail').classList.toggle('collapsed'));
    $('zoom-slider').addEventListener('input', () => setZoom(Number($('zoom-slider').value) / 100));
    $('stage-viewport').addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(zoom * (e.deltaY > 0 ? 0.94 : 1.06));
    }, { passive: false });
    $('layout-picker').addEventListener('change', (e) => {
      if (e.target.id === 'layout-more' && e.target.value) setLayout(e.target.value);
    });
    $('stage-viewport').addEventListener('pointerdown', onPointerDown);
    $('stage-viewport').addEventListener('dblclick', (e) => {
      const text = e.target.closest('.tbox-text');
      if (text) text.focus();
    });
    $('stage-viewport').addEventListener('input', (e) => {
      const text = e.target.closest('.tbox-text');
      if (!text) return;
      const slot = Number(text.closest('.tbox').dataset.slot);
      const page = currentPage();
      if (!page?.texts?.[slot]) return;
      page.texts[slot].content = htmlToMarkup(text);
      text.closest('.tbox').classList.toggle('is-empty', !page.texts[slot].content.trim());
      if (slot === activeTextSlot && document.activeElement !== $('page-text-editor')) {
        $('page-text-editor').value = page.texts[slot].content;
      }
      syncLegacy(page);
      scheduleSave();
      commitSoon();
    });
    $('stage-viewport').addEventListener('dragover', (e) => { e.preventDefault(); $('stage-viewport').classList.add('drop-hot'); });
    $('stage-viewport').addEventListener('dragleave', () => $('stage-viewport').classList.remove('drop-hot'));
    $('stage-viewport').addEventListener('drop', (e) => {
      e.preventDefault();
      $('stage-viewport').classList.remove('drop-hot');
      if (e.dataTransfer.files?.length) stageImport(e.dataTransfer.files);
    });
    $('book-preview').addEventListener('click', (e) => {
      const img = e.target.closest('[data-zoom], .paper-img');
      if (img?.src) { $('modal-image').src = img.src; $('image-modal').classList.add('show'); }
    });
    $('image-modal').addEventListener('click', () => $('image-modal').classList.remove('show'));

    $('page-text-editor').addEventListener('input', () => {
      const page = currentPage();
      if (!page) return;
      if (isBoxText(page) && page.texts?.[activeTextSlot]) {
        page.texts[activeTextSlot].content = $('page-text-editor').value;
        const el = document.querySelector(`#book-preview .tbox[data-slot="${activeTextSlot}"] .tbox-text`);
        if (el && document.activeElement !== el) el.innerHTML = markupToHtml(page.texts[activeTextSlot].content);
        const box = el?.closest('.tbox');
        if (box) box.classList.toggle('is-empty', !page.texts[activeTextSlot].content.trim());
        if (!el && isCustomLayout(page)) renderPreview();
      } else {
        page.text = $('page-text-editor').value;
        const el = document.querySelector('#book-preview .flow-text');
        if (el) el.innerHTML = escapeHtml(page.text).replace(/\n/g, '<br><br>') || '<span style="color:#8a7566">No text yet.</span>';
      }
      syncLegacy(page);
      scheduleSave();
      commitSoon();
    });
    $('page-title-input').addEventListener('input', () => {
      const page = currentPage();
      if (!page) return;
      page.title = $('page-title-input').value;
      const h = document.querySelector('#book-preview .paper-title');
      if (h) h.textContent = page.title;
      renderPageList();
      scheduleSave();
      commitSoon();
    });
    $('page-start').addEventListener('change', () => {
      const page = currentPage();
      const n = parseInt($('page-start').value, 10);
      if (n > 0) page.pageStart = n; else delete page.pageStart;
      commitNow();
      scheduleSave();
    });
    $('book-title').addEventListener('input', () => { book.title = $('book-title').value; scheduleSave(); });
    $('book-author').addEventListener('input', () => { book.author = $('book-author').value; scheduleSave(); });
    $('book-style-notes').addEventListener('input', () => { book.bookStyleNotes = $('book-style-notes').value; scheduleSave(); });
    $('text-prompt').addEventListener('input', () => { if (currentPage()) currentPage().textPrompt = $('text-prompt').value; scheduleSave(); });
    $('image-prompt').addEventListener('input', () => {
      const page = currentPage();
      if (!page?.images?.length) return;
      page.images[Math.min(activeImageSlot, page.images.length - 1)].prompt = $('image-prompt').value;
      syncLegacy(page);
      scheduleSave();
    });

    const styleMap = [
      ['style-font', 'change', (v) => ({ font: v })],
      ['style-size', 'input', (v) => ({ sizePt: Number(v), size: 'custom' })],
      ['style-size-num', 'input', (v) => ({ sizePt: Number(v), size: 'custom' })],
      ['style-leading', 'input', (v) => ({ leading: Number(v) })],
      ['style-leading-num', 'input', (v) => ({ leading: Number(v) })],
      ['style-tracking', 'input', (v) => ({ tracking: Number(v) })],
      ['style-tracking-num', 'input', (v) => ({ tracking: Number(v) })],
      ['style-color', 'input', (v) => ({ color: v })],
      ['style-color-hex', 'change', (v) => ({ color: v })],
      ['style-stroke-on', 'change', (v, el) => ({ strokeOn: el.checked })],
      ['style-stroke-width', 'input', (v) => ({ strokeWidth: Number(v) })],
      ['style-stroke-width-num', 'input', (v) => ({ strokeWidth: Number(v) })],
      ['style-stroke-color', 'input', (v) => ({ strokeColor: v })],
      ['style-stroke-hex', 'change', (v) => ({ strokeColor: v })],
      ['style-shadow-on', 'change', (v, el) => ({ shadowOn: el.checked })],
      ['style-shadow-x', 'input', (v) => ({ shadowX: Number(v) })],
      ['style-shadow-y', 'input', (v) => ({ shadowY: Number(v) })],
      ['style-shadow-blur', 'input', (v) => ({ shadowBlur: Number(v) })],
      ['style-shadow-color', 'input', (v) => ({ shadowColor: v })],
      ['style-shadow-opacity', 'input', (v) => ({ shadowOpacity: Number(v) })],
      ['style-panel-on', 'change', (v, el) => ({ panelOn: el.checked })],
      ['style-panel-color', 'input', (v) => ({ panelColor: v })],
      ['style-panel-opacity', 'input', (v) => ({ panelOpacity: Number(v) })],
      ['style-panel-radius', 'input', (v) => ({ panelRadius: Number(v) })],
      ['style-panel-pad', 'input', (v) => ({ panelPad: Number(v) })],
    ];
    styleMap.forEach(([id, ev, fn]) => {
      $(id).addEventListener(ev, (e) => writeActiveStyle(fn(e.target.value, e.target)));
    });
    $('style-bold').addEventListener('click', () => writeActiveStyle({ weight: getActiveStyle().weight === 'bold' ? 'normal' : 'bold' }));
    $('style-italic').addEventListener('click', () => writeActiveStyle({ style: getActiveStyle().style === 'italic' ? 'normal' : 'italic' }));
    document.querySelectorAll('#style-align button').forEach((b) => b.addEventListener('click', () => writeActiveStyle({ align: b.dataset.align })));
    $('btn-bold-sel').addEventListener('click', () => wrapSelection('**'));
    $('btn-italic-sel').addEventListener('click', () => wrapSelection('*'));

    $('bg-fit').addEventListener('change', () => updateBackground({ bgFit: $('bg-fit').value }));
    $('bg-scale').addEventListener('input', () => updateBackground({ bgScale: Number($('bg-scale').value) }));
    $('bg-scale-num').addEventListener('input', () => updateBackground({ bgScale: Number($('bg-scale-num').value) }));
    $('bg-x').addEventListener('input', () => updateBackground({ bgX: Number($('bg-x').value) }));
    $('bg-y').addEventListener('input', () => updateBackground({ bgY: Number($('bg-y').value) }));
    $('trim-select').addEventListener('change', () => {
      const id = $('trim-select').value;
      const preset = TRIM_PRESETS.find((p) => p.id === id);
      updateTrim({ preset: id, widthIn: preset.w, heightIn: preset.h });
    });
    $('bleed-in').addEventListener('change', () => updateTrim({ bleedIn: Number($('bleed-in').value) }));
    $('safety-in').addEventListener('change', () => updateTrim({ safetyIn: Number($('safety-in').value) }));
    $('trim-w').addEventListener('change', () => updateTrim({ preset: 'custom', widthIn: Number($('trim-w').value) }));
    $('trim-h').addEventListener('change', () => updateTrim({ preset: 'custom', heightIn: Number($('trim-h').value) }));
    $('manuscript-input').addEventListener('input', previewManuscript);

    $('project-file-input').addEventListener('change', (e) => { if (e.target.files[0]) loadProjectFromFile(e.target.files[0]); });
    $('image-file-input').addEventListener('change', (e) => { if (e.target.files[0]) setBackgroundFile(e.target.files[0]); e.target.value = ''; });
    $('images-file-input').addEventListener('change', (e) => { stageImport(e.target.files); e.target.value = ''; });
    $('folder-file-input').addEventListener('change', (e) => { stageImport(e.target.files); e.target.value = ''; });

    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); saveProjectFile(); return; }
      if (meta && e.key.toLowerCase() === 'o') { e.preventDefault(); $('project-file-input').click(); return; }
      if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateTextBox(); return; }
      if (meta && e.key === '0') { e.preventDefault(); zoomFit(); return; }
      if (meta && e.key === '1') { e.preventDefault(); setZoom(1); return; }
      if (e.key === 'Escape') { selectText(-1); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && isPictureLayout(currentPage()) && activeTextSlot >= 0) {
        e.preventDefault();
        removeTextBox();
        return;
      }
      if (!typing && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const page = currentPage();
        if (isBoxText(page) && activeTextSlot >= 0 && page.texts?.[activeTextSlot]) {
          e.preventDefault();
          const step = e.altKey ? 0.08 : (e.shiftKey ? 1 : 0.35);
          const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          nudgeBox(...map[e.key]);
          return;
        }
        if (e.key === 'ArrowLeft') selectPage(currentPageIndex - 1);
        if (e.key === 'ArrowRight') selectPage(currentPageIndex + 1);
      }
    });
    window.addEventListener('resize', () => { if (zoom < 1.05) zoomFit(); });
    window.addEventListener('beforeunload', saveLocal);

    const fontSel = $('style-font');
    fontSel.innerHTML = Object.entries(FONTS).map(([id, f]) => `<option value="${id}">${f.label}</option>`).join('');
    $('trim-select').innerHTML = TRIM_PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
    $('style-presets').innerHTML = ILLUSTRATION_STYLES.map((s) => `<button type="button" class="mini" data-illu="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('');
    $('style-presets').addEventListener('click', (e) => {
      const b = e.target.closest('[data-illu]');
      if (!b) return;
      const area = $('image-prompt');
      const add = ` in ${b.dataset.illu.toLowerCase()} style`;
      if (!area.value.toLowerCase().includes(b.dataset.illu.toLowerCase())) area.value = (area.value.trim() || 'A children\'s book illustration') + add;
      area.dispatchEvent(new Event('input'));
    });
  }

  function wrapSelection(marker) {
    const live = document.activeElement?.closest?.('.tbox-text');
    if (live) {
      document.execCommand(marker === '**' ? 'bold' : 'italic');
      live.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const ta = $('page-text-editor');
    const a = ta.selectionStart; const b = ta.selectionEnd;
    const sel = ta.value.slice(a, b) || 'word';
    ta.value = ta.value.slice(0, a) + marker + sel + marker + ta.value.slice(b);
    ta.focus();
    ta.selectionStart = a + marker.length;
    ta.selectionEnd = a + marker.length + sel.length;
    ta.dispatchEvent(new Event('input'));
  }

  async function testBackend() {
    const { url } = getBackend();
    const el = $('backend-status');
    el.textContent = 'Testing…';
    try {
      const res = await fetch(`${url}/health`);
      const data = await res.json();
      el.textContent = data.ollama_ok ? 'Backend is up and Ollama answered.' : 'Backend is up. Ollama did not answer.';
    } catch (e) {
      el.textContent = 'Could not reach the backend. Picture books still work without it.';
    }
  }
  function resetBook() {
    if (!confirm('Start a new book? The one on screen will be replaced.')) return;
    book = blankBook();
    book.pages = [normalizePage({ id: Date.now(), title: 'Page 1', layout: 'picture', text: '' }, 0)];
    book.pages[0].texts = [makeText({ content: '' }, defaultPictureFrame(book.pages[0], 0), true)];
    currentPageIndex = 0;
    syncHeader();
    renderAll();
    resetHistory();
    saveLocal();
  }
  function helpText() {
    return `KindleForge picture books

The picture stays locked. Words are a separate layer you can drag.

• Picture — one full-bleed page.
• Spread — one wide picture across two pages. Text can sit on either side.
• Guides — dashed trim, green safe area (0.5 in inside the trim).
• Snap and the arrow keys nudge a selected box. Shift is a bigger step. Alt is finer, and Alt while dragging ignores snap.
• **Whoosh!** bolds a word. *soft* makes it italic. Or select a word and press B or I.
• Outline, shadow, and the cream panel each have their own on/off switch.
• Save style… keeps a look in the project. Apply to every text box copies it everywhere.
• Import images from a folder (filename order). Wide pictures become spreads.
• Paste a manuscript whose pages are split by headings or a line of ---.
• Export PDF is the trim size plus 0.125 in bleed, with the original picture and vector text.
• PNG/JPG zip and the tall review JPG are for checking pages on a phone.
• EPUB stays available. A book made only of picture pages exports as fixed-layout.

Save Project packs everything into one .kindleforge.json. Older projects still open.

Run with: python -m http.server 8000`;
  }

  async function init() {
    const theme = localStorage.getItem('kindleforge-theme') || 'light';
    document.documentElement.dataset.theme = theme;
    bind();
    const bannerClose = $('app-banner-close');
    if (bannerClose) bannerClose.addEventListener('click', hideBanner);
    try {
      if (location.hash === '#picture-demo') await loadPictureDemo(true);
      else if (loadLocal()) await rehydrateAssets();
      else loadFoxDemoSilent();
    } catch (e) {
      console.warn(e);
      showBanner('Could not restore the last book. ' + (e.message || ''), 'error');
      if (!book.pages.length) loadFoxDemoSilent();
    }
    if (!book.pages.length) loadFoxDemoSilent();
    syncHeader();
    renderAll();
    resetHistory();
    requestAnimationFrame(zoomFit);
  }
  function loadFoxDemoSilent() {
    book = blankBook();
    book.title = 'The Fox and the Forgotten Star';
    book.author = 'by Elara Voss';
    book.pages = [
      normalizePage({ id: 1, title: 'Cover', layout: 'image-only', image: 'generated/cover.jpg', text: '' }, 0),
      normalizePage({ id: 2, title: 'The Discovery', layout: 'image-top', image: 'generated/1.jpg', text: 'In the quiet hours between dusk and true night, a small red fox named Lira followed a thread of golden light.' }, 1),
    ];
    currentPageIndex = 0;
  }

  window.KF = {
    get book() { return book; },
    undo, redo, exportPDF, measurePicture, loadProjectObject,
    memoryReport() {
      let thumbs = 0;
      let previews = 0;
      imageStore.items.forEach((item) => {
        if (item.thumbUrl) thumbs += 1;
        if (item.previewUrl) previews += 1;
      });
      return {
        assets: imageStore.items.size,
        bytes: imageStore.total,
        snapChars: history.stack[history.index] ? history.stack[history.index].length : 0,
        snaps: history.stack.length,
        thumbs,
        previews,
      };
    },
  };
  init();
})();
