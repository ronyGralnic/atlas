/* Atlas core — shared by every page. No modules, no fetch: works over file:// */
(function () {
  'use strict';
  var A = (window.Atlas = window.Atlas || {});

  /* ---------- Theme ---------- */
  var THEME_KEY = 'atlas-theme';
  function storedTheme() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme(storedTheme());
  A.isDark = function () {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  };
  A.toggleTheme = function () {
    var next = A.isDark() ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('aria-label', next === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה');
    });
    document.dispatchEvent(new CustomEvent('atlas:theme'));
  };
  A.reducedMotion = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };

  /* ---------- Closed tag list → 8 colour families (validated palette; each also has an icon) ---------- */
  A.FAMILIES = [
    { id: 1, name: 'כסף, ממשל ונתונים', short: 'כסף וממשל', tags: ['ממשל דיגיטלי', 'פינטק וכסף', 'נתונים ומדידה'],
      glyph: 'M2 10h2V5H2zM5.5 10h2V2h-2zM9 10h2V6.5H9z' },
    { id: 2, name: 'סחר ולוגיסטיקה', short: 'סחר', tags: ['שרשראות אספקה', 'תחבורה ולוגיסטיקה'],
      glyph: 'M1.5 4 6 1.5 10.5 4v4.5L6 11 1.5 8.5zM6 6v4.5M1.8 4.2 6 6.4l4.2-2.2', stroke: true },
    { id: 3, name: 'מים, מזון וסביבה', short: 'מים ומזון', tags: ['מים', 'מזון וחקלאות', 'אקלים וסביבה'],
      glyph: 'M6 1C6 1 2.2 5.4 2.2 7.6a3.8 3.8 0 0 0 7.6 0C9.8 5.4 6 1 6 1z' },
    { id: 4, name: 'אנרגיה', short: 'אנרגיה', tags: ['אנרגיה'],
      glyph: 'M7 .8 2.2 6.8h3.3L4.6 11.2l5.2-6.4H6.4z' },
    { id: 5, name: 'בריאות', short: 'בריאות', tags: ['בריאות'],
      glyph: 'M4.6 1.5h2.8v3.1h3.1v2.8H7.4v3.1H4.6V7.4H1.5V4.6h3.1z' },
    { id: 6, name: 'עבודה וחינוך', short: 'עבודה', tags: ['חינוך ועבודה'],
      glyph: 'M6 1.2a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM1.8 11c.3-2.6 2-4.2 4.2-4.2s3.9 1.6 4.2 4.2z' },
    { id: 7, name: 'סייבר ודיגיטל', short: 'סייבר', tags: ['סייבר ופרטיות', 'תקשורת ותשתית דיגיטלית'],
      glyph: 'M3.2 5.2V4a2.8 2.8 0 0 1 5.6 0v1.2h.8v5.6H2.4V5.2zm1.5 0h2.6V4a1.3 1.3 0 0 0-2.6 0z' },
    { id: 8, name: 'ביטחון ומשבר', short: 'ביטחון', tags: ['ביטחון ומשבר'],
      glyph: 'M6 .8 10.6 2.6v3.3c0 2.6-2 4.6-4.6 5.4C3.4 10.5 1.4 8.5 1.4 5.9V2.6z' }
  ];
  A.TAGS = [];
  A.TAG_FAMILY = {};
  A.FAMILIES.forEach(function (f) { f.tags.forEach(function (t) { A.TAGS.push(t); A.TAG_FAMILY[t] = f.id; }); });
  A.famOf = function (pin) { return A.TAG_FAMILY[pin.tags[0]] || 1; };
  A.famById = function (id) { return A.FAMILIES[id - 1]; };
  A.pinFamilies = function (pin) { var s = {}; pin.tags.forEach(function (t) { s[A.TAG_FAMILY[t]] = 1; }); return Object.keys(s).map(Number); };
  A.glyphSvg = function (famId, cls) {
    var f = A.famById(famId);
    var attr = f.stroke ? ' style="fill:none;stroke:currentColor;stroke-width:1.4;stroke-linejoin:round"' : '';
    return '<svg class="' + (cls || '') + '" viewBox="0 0 12 12" aria-hidden="true"><path d="' + f.glyph + '"' + attr + '/></svg>';
  };
  A.swatch = function (famId) {
    return '<span class="fam-swatch" data-fam="' + famId + '" style="--fam:var(--fam-' + famId + ')">' + A.glyphSvg(famId) + '</span>';
  };

  A.SCALE = { local: 'מקומי', national: 'ארצי', regional: 'אזורי', global: 'עולמי' };
  var MONTHS = ['בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני', 'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר'];
  A.dateHe = function (iso) { var p = iso.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; };
  A.dateShort = function (iso) { var p = iso.split('-'); return +p[2] + '.' + +p[1] + '.' + p[0].slice(2); };

  /* ---------- Flags (flag-icons, MIT; copied into assets/flags by the build) ---------- */
  A.base = '';
  A.flag = function (iso2, cls, alt) {
    if (!iso2) return '';
    return '<img class="flag ' + (cls || '') + '" src="' + A.base + 'assets/flags/' + iso2 + '.svg" alt="' + A.esc(alt || '') + '" width="20" height="15" loading="lazy" decoding="async">';
  };
  A.flagPlace = function (pin, cls) { return A.flag(pin.place.iso2, cls, ''); };

  /* ---------- Local time at the pin ("alive") ---------- */
  var fmtCache = {};
  A.localHour = function (tz) {
    try {
      var f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }));
      var s = f.format(new Date()); return { text: s, h: parseInt(s, 10) };
    } catch (e) { return null; }
  };
  A.dayPart = function (h) {
    if (h >= 5 && h < 11) return 'בוקר';
    if (h >= 11 && h < 17) return 'צהריים';
    if (h >= 17 && h < 21) return 'ערב';
    return 'לילה';
  };
  A.localTimeChip = function (pin) {
    var t = A.localHour(pin.place.tz);
    if (!t) return '';
    var part = A.dayPart(t.h);
    var icon = part === 'לילה' ? '<path d="M9.5 7.2A4 4 0 1 1 4.8 2.5a3.2 3.2 0 0 0 4.7 4.7z"/>' : '<circle cx="6" cy="6" r="2.6"/><path d="M6 .8v1.4M6 9.8v1.4M.8 6h1.4M9.8 6h1.4M2.3 2.3l1 1M8.7 8.7l1 1M2.3 9.7l1-1M8.7 3.3l1-1" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>';
    return '<span class="localtime" data-tz="' + A.esc(pin.place.tz) + '"><svg viewBox="0 0 12 12" aria-hidden="true">' + icon + '</svg>עכשיו שם <b class="num">' + t.text + '</b> · ' + part + '</span>';
  };

  /* ---------- Fictional persona avatars (flat, generated; never a real person) ---------- */
  var avN = 0;
  var SKIN = ['#f6d7c3', '#eec39a', '#d49e7a', '#b07650', '#8d5524', '#5c3a21'];
  A.avatar = function (av, size) {
    av = av || {};
    var skin = SKIN[Math.max(0, Math.min(5, (av.skin || 3) - 1))];
    var hc = av.hairColor || '#2b1d14', sh = av.shirt || '#888', hs = av.hair || 'short';
    var back = '', front = '', acc = '';
    switch (hs) {
      case 'long': back = '<path d="M17 30C17 13 47 13 47 30L48 50H16Z" fill="' + hc + '"/>'; front = '<path d="M20 26C21 16 43 16 44 26C40 20 26 19 20 26Z" fill="' + hc + '"/>'; break;
      case 'bob': back = '<path d="M18 29C18 14 46 14 46 29L46 39H18Z" fill="' + hc + '"/>'; front = '<path d="M20 26C21 16 43 16 44 26C40 21 26 21 20 26Z" fill="' + hc + '"/>'; break;
      case 'bun': front = '<circle cx="32" cy="13" r="6" fill="' + hc + '"/><path d="M20 27C20 15 44 15 44 27C41 20 23 20 20 27Z" fill="' + hc + '"/>'; break;
      case 'pony': back = '<path d="M43 22C52 24 52 38 46 42C48 34 46 28 43 26Z" fill="' + hc + '"/>'; front = '<path d="M20 27C20 15 44 15 44 27C41 20 23 20 20 27Z" fill="' + hc + '"/>'; break;
      case 'curly': front = '<g fill="' + hc + '"><circle cx="22" cy="21" r="5"/><circle cx="28" cy="17" r="5"/><circle cx="35" cy="16.5" r="5"/><circle cx="41" cy="20" r="5"/><circle cx="20" cy="27" r="3.5"/><circle cx="44" cy="26" r="3.5"/></g>'; break;
      case 'afro': back = '<circle cx="32" cy="24" r="17" fill="' + hc + '"/>'; break;
      case 'wavy': front = '<path d="M20 27C19 15 45 14 44 27C42 22 39 24 36 21C33 24 29 21 26 23C24 21 22 24 20 27Z" fill="' + hc + '"/>'; break;
      case 'cap': front = '<path d="M20 25C20 14 44 14 44 25Z" fill="' + sh + '"/><path d="M42 24.5H51C50 27 46 27 42 26.5Z" fill="' + sh + '"/>'; break;
      case 'scarf': back = '<path d="M16 31C16 11 48 11 48 31L50 52C40 56 24 56 14 52Z" fill="' + hc + '"/>'; break;
      case 'wrap': front = '<path d="M19 25C19 10 45 10 45 25C42 18 22 18 19 25Z" fill="' + hc + '"/><path d="M23 14C27 4 39 4 42 14C37 11 28 11 23 14Z" fill="' + hc + '"/>'; break;
      default: front = '<path d="M20 26C20 15 44 15 44 26C41 20 23 20 20 26Z" fill="' + hc + '"/>';
    }
    if (av.acc === 'glasses') acc = '<g fill="none" stroke="#1d1d1b" stroke-width="1.3"><circle cx="27" cy="29" r="3.4"/><circle cx="37" cy="29" r="3.4"/><path d="M30.4 29h3.2"/></g>';
    if (av.acc === 'helmet') front = '<path d="M18.5 25C18.5 12 45.5 12 45.5 25Z" fill="#f2c14e"/><rect x="16.5" y="24" width="31" height="3" rx="1.5" fill="#e0a82e"/>';
    if (av.acc === 'headset') acc = '<path d="M19 29C19 15 45 15 45 29" fill="none" stroke="#1d1d1b" stroke-width="2"/><rect x="16.5" y="27" width="4" height="7" rx="2" fill="#1d1d1b"/><path d="M20 33C22 38 26 39 29 39" fill="none" stroke="#1d1d1b" stroke-width="1.4"/>';
    if (av.acc === 'beard') acc = '<path d="M22 31C23 41 41 41 42 31C40 36 24 36 22 31Z" fill="' + hc + '"/>';
    var apron = av.acc === 'apron' ? '<path d="M25 46H39V64H25Z" fill="#fdfdfb" opacity=".9"/>' : '';
    var face = hs === 'scarf' ? '<ellipse cx="32" cy="29" rx="10" ry="11.5" fill="' + skin + '"/>' : '<circle cx="32" cy="28" r="12" fill="' + skin + '"/>';
    var s = size || 56, cid = 'avc' + (++avN);
    return '<svg class="avatar" width="' + s + '" height="' + s + '" viewBox="0 0 64 64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="32" fill="var(--avatar-bg)"/>' +
      '<clipPath id="' + cid + '"><circle cx="32" cy="32" r="32"/></clipPath><g clip-path="url(#' + cid + ')">' +
      back + '<path d="M9 66C9 50 19 43 32 43S55 50 55 66Z" fill="' + sh + '"/>' + apron +
      '<rect x="28" y="36" width="8" height="8" rx="3" fill="' + skin + '"/>' + face + front +
      '<circle cx="27.5" cy="29" r="1.4" fill="#1d1d1b"/><circle cx="36.5" cy="29" r="1.4" fill="#1d1d1b"/>' +
      '<path d="M28.5 33.6C30.5 35.4 33.5 35.4 35.5 33.6" fill="none" stroke="#1d1d1b" stroke-width="1.2" stroke-linecap="round"/>' + acc + '</g></svg>';
  };

  /* ---------- Data ---------- */
  A.allPins = function () {
    var out = [];
    var byIssue = window.ATLAS_PINS || {};
    (window.ATLAS_INDEX ? window.ATLAS_INDEX.issues : []).forEach(function (iss) {
      (byIssue[iss.issue] || []).forEach(function (p) { out.push(p); });
    });
    return out;
  };
  /** Load data/pins-<issue>.js files listed in ATLAS_INDEX by script injection (works on file://). */
  A.loadIssues = function (base, done) {
    A.base = base || '';
    var issues = (window.ATLAS_INDEX && window.ATLAS_INDEX.issues) || [];
    var left = issues.length;
    if (!left) { done(); return; }
    issues.forEach(function (iss) {
      if (window.ATLAS_PINS && window.ATLAS_PINS[iss.issue]) { if (--left === 0) done(); return; }
      var s = document.createElement('script');
      s.src = base + 'data/' + iss.file;
      s.onload = s.onerror = function () { if (--left === 0) done(); };
      document.head.appendChild(s);
    });
  };

  /* ---------- Text helpers ---------- */
  A.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  A.norm = function (s) {
    return String(s || '').toLowerCase()
      .replace(/[֑-ׇ]/g, '')
      .replace(/[״"׳'`]/g, '')
      .replace(/[-–—_.,:;!?()]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  };
  A.placeLine = function (p) {
    var bits = [];
    if (p.place.city) bits.push(p.place.city);
    else if (p.place.region) bits.push(p.place.region);
    bits.push(p.place.country);
    return bits.join(', ');
  };

  /* Wrap the first occurrence of each glossary term (per card) in a term button. */
  function termify(html, pin, used) {
    (pin.terms || []).forEach(function (term) {
      if (used[term.t]) return;
      var needle = A.esc(term.t);
      var i = html.indexOf(needle);
      while (i >= 0 && html.lastIndexOf('<', i) > html.lastIndexOf('>', i)) i = html.indexOf(needle, i + 1);
      while (i >= 0 && /<button[^>]*class="term"[^>]*>[^<]*$/.test(html.slice(0, i))) i = html.indexOf(needle, i + 1);
      if (i < 0) return;
      used[term.t] = true;
      html = html.slice(0, i) +
        '<button type="button" class="term" aria-expanded="false" data-term="' + A.esc(term.t) + '" data-def="' + A.esc(term.d) + '">' + needle + '</button>' +
        html.slice(i + needle.length);
    });
    return html;
  }

  A.tagChip = function (t) {
    var fam = A.TAG_FAMILY[t];
    return '<span class="chip chip--static"><span class="dot" style="--fam:var(--fam-' + fam + ')"></span>' + A.esc(t) + '</span>';
  };

  var ICON = {
    problem: '<path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6v3.6M8 11.4v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    people: '<circle cx="5.5" cy="5" r="2.3" fill="currentColor"/><circle cx="11" cy="5.6" r="1.9" fill="currentColor" opacity=".6"/><path d="M1.5 13.5C2 10.5 3.6 9 5.5 9s3.5 1.5 4 4.5z" fill="currentColor"/><path d="M9.6 13.5c-.1-1.6-.6-2.9-1.4-3.8.7-.5 1.6-.7 2.8-.7 1.7 0 3 1.3 3.5 4.5z" fill="currentColor" opacity=".6"/>',
    idea: '<path d="M8 1.5a4.6 4.6 0 0 0-2.7 8.3V12h5.4V9.8A4.6 4.6 0 0 0 8 1.5z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 14.2h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    check: '<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 8.2 7.1 10.3 11 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    clock: '<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.5V8l2.4 1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  };
  A.icon = function (k) { return '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true">' + ICON[k] + '</svg>'; };

  A.personaBlock = function (pin, T, opts) {
    var pe = pin.persona; if (!pe) return '';
    T = T || A.esc;
    return '<section class="persona" aria-label="הכירו את ' + A.esc(pe.name) + '">' +
      '<div class="persona__head">' + A.avatar(pe.avatar, (opts && opts.avatarSize) || 64) +
      '<div><span class="persona__kicker">הכירו את</span><b class="persona__name">' + A.esc(pe.name) + '</b>' +
      '<span class="persona__meta">' + pe.age + ' · ' + A.esc(pe.role) + ' · ' + A.esc(pe.home) + '</span></div></div>' +
      '<p class="persona__story">' + A.esc(pe.story) + '</p>' +
      '<span class="persona__fiction">דמות בדויה. הבעיה אמיתית.</span></section>';
  };

  /**
   * Full pin card. opts: {pinById, headingTag, onMap, scene:true}
   */
  A.renderCard = function (pin, opts) {
    opts = opts || {};
    var used = {};
    var T = function (s) { return termify(A.esc(s), pin, used); };
    var h = opts.headingTag || 'h2';
    var fam = A.famOf(pin);
    var pe = pin.persona || {};
    var first = (pe.name || '').split(' ')[0];
    var out = '<article class="card" id="pin-' + pin.id + '" style="--fam:var(--fam-' + fam + ')">';
    if (opts.scene !== false && A.scene) out += '<div class="card__scene">' + A.scene(pin.scene, fam) + '</div>';
    out += '<div class="card__body">';
    out += '<div class="card__place">' + A.flagPlace(pin, 'flag--md') + '<span>' + A.esc(A.placeLine(pin)) + '</span>' + A.localTimeChip(pin) + '</div>';
    out += '<' + h + ' class="card__title" tabindex="-1">' + A.esc(pin.title_he) + '</' + h + '>';
    out += '<div class="card__tags">' + pin.tags.map(A.tagChip).join('') +
      (pin.indirect ? '<span class="chip chip--static chip--indirect"><span class="dot dot--ring" style="--fam:var(--fam-' + fam + ')"></span>קשר עקיף</span>' : '') + '</div>';
    if (pin.indirect) out += '<p class="indirect-note"><b>למה זה כאן?</b> ' + T(pin.indirect_note) + '</p>';

    out += A.personaBlock(pin, T);

    out += '<section class="block"><h3>' + A.icon('problem') + 'הבעיה</h3><p>' + T(pin.problem_he) + '</p>' +
      '<p class="block__now">' + A.icon('clock') + '<span><b>למה עכשיו: </b>' + T(pin.why_now) + '</span></p></section>';
    out += '<section class="block"><h3>' + A.icon('people') + 'מי סובל ומי מרוויח</h3><div class="sides">' +
      '<div class="side side--hurt"><span class="side__k">סובלים</span><p>' + T(pin.who_hurts) + '</p></div>' +
      '<div class="side side--gain"><span class="side__k">מרוויחים או חוסמים</span><p>' + T(pin.who_gains) + '</p></div></div></section>';
    out += '<section class="block block--idea"><h3>' + A.icon('idea') + 'מה הייתי בונה</h3><p class="idea">' + T(pin.idea_he) + '</p>' +
      (pe.after ? '<div class="after">' + A.avatar(pe.avatar, 34) + '<p><b>איך זה משנה את היום של ' + A.esc(first) + ': </b>' + A.esc(pe.after) + '</p></div>' : '') + '</section>';
    out += '<section class="block"><h3>' + A.icon('check') + 'מה צריך להיות נכון</h3><p>' + T(pin.must_be_true) + '</p></section>';

    var rel = (pin.related || []).map(function (id) { return opts.pinById && opts.pinById[id]; }).filter(Boolean);
    if (rel.length) {
      out += '<section class="block"><h3>עוד מקומות עם בעיה דומה</h3><div class="related">';
      rel.forEach(function (r) {
        var label = A.flagPlace(r) + '<span>' + A.esc(r.title_he) + '</span><small>' + A.esc(r.place.country) + '</small>';
        if (opts.onMap) out += '<button type="button" data-open-pin="' + r.id + '">' + label + '</button>';
        else out += '<a href="' + A.base + 'index.html#pin=' + r.id + '">' + label + '</a>';
      });
      out += '</div></section>';
    }
    if (pin.full_item && pin.full_item.url) {
      out += '<p class="card__open"><a class="btn" href="' + A.esc(pin.full_item.url) + '">לפריט המלא: ' + A.esc(pin.full_item.label || '') + ' ←</a></p>';
    }
    if (!opts.onMap) out += '<p class="card__open"><a class="btn" href="' + A.base + 'index.html#pin=' + pin.id + '">פתחו על הגלובוס</a></p>';
    out += '</div></article>';
    return out;
  };

  /* ---------- Term windows ---------- */
  var pop, openTerm;
  function closeTerm(returnFocus) {
    if (!openTerm) return;
    openTerm.setAttribute('aria-expanded', 'false');
    if (returnFocus) openTerm.focus();
    openTerm = null;
    if (pop) pop.hidden = true;
  }
  function placePop(btn) {
    var r = btn.getBoundingClientRect();
    pop.hidden = false;
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var left = Math.min(Math.max(12, r.right - pw), vw - pw - 12);
    var top = r.bottom + 8;
    if (top + ph > vh - 12) top = Math.max(12, r.top - ph - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }
  function showTerm(btn) {
    if (openTerm === btn) { closeTerm(false); return; }
    closeTerm(false);
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'term-pop';
      pop.id = 'term-pop';
      pop.setAttribute('role', 'tooltip');
      pop.hidden = true;
      document.body.appendChild(pop);
    }
    var host = btn.closest('dialog[open]');
    if (host && pop.parentNode !== host) host.appendChild(pop);
    else if (!host && pop.parentNode !== document.body) document.body.appendChild(pop);
    pop.innerHTML = '<span class="term-pop__t">' + A.esc(btn.getAttribute('data-term')) + '</span>' + A.esc(btn.getAttribute('data-def'));
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-describedby', 'term-pop');
    openTerm = btn;
    placePop(btn);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.term');
    if (b) { e.preventDefault(); e.stopPropagation(); showTerm(b); return; }
    if (pop && !pop.contains(e.target)) closeTerm(false);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openTerm) { closeTerm(true); e.stopPropagation(); e.preventDefault(); } }, true);
  window.addEventListener('scroll', function () { closeTerm(false); }, true);
  window.addEventListener('resize', function () { closeTerm(false); });
  A.closeTerm = closeTerm;
  A.termOpen = function () { return !!openTerm; };

  /* ---------- Count-up numbers ---------- */
  A.countUp = function (el, to, ms) {
    if (!el) return;
    if (A.reducedMotion() || !ms) { el.textContent = to; return; }
    var t0 = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  };

  /* ---------- Shared chrome ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('aria-label', A.isDark() ? 'מעבר למצב בהיר' : 'מעבר למצב כהה');
      b.addEventListener('click', A.toggleTheme);
    });
  });

  /* ---------- GoatCounter: only on a real host (never file:// or localhost) ---------- */
  A.analytics = function () {
    var h = location.hostname;
    if (!/^https?:$/.test(location.protocol) || !h || h === 'localhost' || h === '127.0.0.1' || /^192\.168\./.test(h)) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', 'https://rony.goatcounter.com/count');
    document.body.appendChild(s);
  };
})();
