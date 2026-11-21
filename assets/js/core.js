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
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  A.toggleTheme = function () {
    var next = A.isDark() ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('aria-label', next === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה');
    });
  };

  /* ---------- Closed tag list → 8 colour families ---------- */
  // Hues are capped at 8 (validated palette); each family also carries a glyph so colour never works alone.
  A.FAMILIES = [
    { id: 1, name: 'ממשל, כסף ונתונים', tags: ['ממשל דיגיטלי', 'פינטק וכסף', 'נתונים ומדידה'],
      glyph: 'M2 10h2V5H2zM5.5 10h2V2h-2zM9 10h2V6.5H9z' },
    { id: 2, name: 'סחר ולוגיסטיקה', tags: ['שרשראות אספקה', 'תחבורה ולוגיסטיקה'],
      glyph: 'M1.5 4 6 1.5 10.5 4v4.5L6 11 1.5 8.5zM6 6v4.5M1.8 4.2 6 6.4l4.2-2.2', stroke: true },
    { id: 3, name: 'מים, מזון וסביבה', tags: ['מים', 'מזון וחקלאות', 'אקלים וסביבה'],
      glyph: 'M6 1C6 1 2.2 5.4 2.2 7.6a3.8 3.8 0 0 0 7.6 0C9.8 5.4 6 1 6 1z' },
    { id: 4, name: 'אנרגיה', tags: ['אנרגיה'],
      glyph: 'M7 .8 2.2 6.8h3.3L4.6 11.2l5.2-6.4H6.4z' },
    { id: 5, name: 'בריאות', tags: ['בריאות'],
      glyph: 'M4.6 1.5h2.8v3.1h3.1v2.8H7.4v3.1H4.6V7.4H1.5V4.6h3.1z' },
    { id: 6, name: 'עבודה וחינוך', tags: ['חינוך ועבודה'],
      glyph: 'M6 1.2a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM1.8 11c.3-2.6 2-4.2 4.2-4.2s3.9 1.6 4.2 4.2z' },
    { id: 7, name: 'סייבר ודיגיטל', tags: ['סייבר ופרטיות', 'תקשורת ותשתית דיגיטלית'],
      glyph: 'M3.2 5.2V4a2.8 2.8 0 0 1 5.6 0v1.2h.8v5.6H2.4V5.2zm1.5 0h2.6V4a1.3 1.3 0 0 0-2.6 0z' },
    { id: 8, name: 'ביטחון ומשבר', tags: ['ביטחון ומשבר'],
      glyph: 'M6 .8 10.6 2.6v3.3c0 2.6-2 4.6-4.6 5.4C3.4 10.5 1.4 8.5 1.4 5.9V2.6z' }
  ];
  A.TAGS = [];
  A.TAG_FAMILY = {};
  A.FAMILIES.forEach(function (f) { f.tags.forEach(function (t) { A.TAGS.push(t); A.TAG_FAMILY[t] = f.id; }); });
  A.famOf = function (pin) { return A.TAG_FAMILY[pin.tags[0]] || 1; };
  A.famById = function (id) { return A.FAMILIES[id - 1]; };
  A.glyphSvg = function (famId, cls) {
    var f = A.famById(famId);
    var attr = f.stroke ? ' fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" style="fill:none;stroke:' + (famId === 4 ? 'var(--glyph-on-4)' : '#fff') + '"' : '';
    return '<svg class="' + (cls || '') + '" viewBox="0 0 12 12" aria-hidden="true"><path d="' + f.glyph + '"' + attr + '/></svg>';
  };
  A.swatch = function (famId) {
    return '<span class="fam-swatch" data-fam="' + famId + '" style="--fam:var(--fam-' + famId + ')">' + A.glyphSvg(famId) + '</span>';
  };

  A.SCALE = { local: 'מקומי', national: 'ארצי', regional: 'אזורי', global: 'עולמי' };
  A.PRIORITY = { A: 'עדיפות A', B: 'עדיפות B', C: 'עדיפות C' };
  var MONTHS = ['בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני', 'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר'];
  A.dateHe = function (iso) { var p = iso.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; };
  A.dateShort = function (iso) { var p = iso.split('-'); return +p[2] + '.' + +p[1] + '.' + p[0].slice(2); };

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
    if (p.place.region && p.place.region !== p.place.city) bits.push(p.place.region);
    bits.push(p.place.country);
    return bits.join(', ');
  };

  /* Wrap the first occurrence of each glossary term (per card) in a term button. */
  function termify(html, pin, used) {
    (pin.terms || []).forEach(function (term) {
      if (used[term.t]) return;
      var needle = A.esc(term.t);
      var i = html.indexOf(needle);
      // skip matches that fall inside an already-inserted tag/attribute
      while (i >= 0 && html.lastIndexOf('<', i) > html.lastIndexOf('>', i)) i = html.indexOf(needle, i + 1);
      // and matches inside an existing term button's text
      while (i >= 0 && /<button[^>]*class="term"[^>]*>[^<]*$/.test(html.slice(0, i))) i = html.indexOf(needle, i + 1);
      if (i < 0) return;
      used[term.t] = true;
      html = html.slice(0, i) +
        '<button type="button" class="term" aria-expanded="false" data-term="' + A.esc(term.t) + '" data-def="' + A.esc(term.d) + '">' + needle + '</button>' +
        html.slice(i + needle.length);
    });
    return html;
  }

  A.tagChip = function (t, pressed, asButton) {
    var fam = A.TAG_FAMILY[t];
    var inner = '<span class="dot" style="--fam:var(--fam-' + fam + ')"></span>' + A.esc(t);
    if (asButton) return '<button type="button" class="chip" data-tag="' + A.esc(t) + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' + inner + '</button>';
    return '<span class="chip chip--static">' + inner + '</span>';
  };

  /**
   * Full pin card (section 4.2). opts: {pinById, headingTag, base, onMap}
   */
  A.renderCard = function (pin, opts) {
    opts = opts || {};
    var used = {};
    var T = function (s) { return termify(A.esc(s), pin, used); };
    var h = opts.headingTag || 'h2';
    var fam = A.famOf(pin);
    var out = '';
    out += '<article class="card" id="pin-' + pin.id + '" style="--fam:var(--fam-' + fam + ')">';
    out += '<' + h + ' class="card__title" tabindex="-1">' + A.esc(pin.title_he) + '</' + h + '>';
    out += '<div class="card__place"><span>' + A.esc(A.placeLine(pin)) + '</span><span aria-hidden="true">·</span><span>' + A.SCALE[pin.scale] + '</span>' +
      '<span aria-hidden="true">·</span><span>גיליון ' + A.dateShort(pin.issue_date) + '</span></div>';
    out += '<div class="card__tags">' + pin.tags.map(function (t) { return A.tagChip(t); }).join('') + '</div>';
    var flags = '<span class="badge">' + A.PRIORITY[pin.priority] + '</span>';
    if (pin.indirect) flags += '<span class="badge"><span class="dot dot--ring" style="--fam:var(--fam-' + fam + ')"></span>קשר עקיף</span>';
    if (pin.diff_candidate) flags += '<span class="badge badge--accent">★ מועמד ל-DIFF</span>';
    out += '<div class="card__flags">' + flags + '</div>';
    if (pin.indirect) out += '<p class="indirect-note"><b>קשר עקיף</b>' + T(pin.indirect_note) + '</p>';

    out += '<section class="block"><h3>הבעיה</h3><p>' + T(pin.problem_he) + '</p>' +
      '<p><span class="lbl">למה עכשיו: </span>' + T(pin.why_now) + '</p></section>';
    out += '<section class="block"><h3>מי סובל ומי מרוויח</h3><p><span class="lbl">סובלים: </span>' + T(pin.who_hurts) + '</p>' +
      '<p><span class="lbl">מרוויחים או חוסמים: </span>' + T(pin.who_gains) + '</p></section>';
    out += '<section class="block block--idea"><h3>מה הייתי בונה</h3><p>' + T(pin.idea_he) + '</p></section>';
    out += '<section class="block"><h3>מה צריך להיות נכון</h3><p>' + T(pin.must_be_true) + '</p></section>';
    if (pin.diff_candidate) out += '<section class="block"><h3>למה זה מועמד ל-DIFF</h3><p class="diff-note">' + T(pin.diff_reason) + '</p></section>';

    var rel = (pin.related || []).map(function (id) { return opts.pinById && opts.pinById[id]; }).filter(Boolean);
    if (rel.length) {
      out += '<section class="block"><h3>נעצים קשורים</h3><div class="related">';
      rel.forEach(function (r) {
        var rf = A.famOf(r);
        var label = '<span class="dot' + (r.indirect ? ' dot--ring' : '') + '" style="--fam:var(--fam-' + rf + ')"></span><span>' + A.esc(r.title_he) + '</span><small>' + A.esc(r.place.country) + '</small>';
        if (opts.onMap) out += '<button type="button" data-open-pin="' + r.id + '">' + label + '</button>';
        else out += '<a href="' + (opts.base || '') + 'index.html#pin=' + r.id + '">' + label + '</a>';
      });
      out += '</div></section>';
    }
    if (pin.full_item && pin.full_item.url) {
      out += '<p class="card__open"><a class="btn" href="' + A.esc(pin.full_item.url) + '">לפריט המלא: ' + A.esc(pin.full_item.label || '') + ' ←</a></p>';
    }
    if (!opts.onMap) out += '<p class="card__open"><a class="btn" href="' + (opts.base || '') + 'index.html#pin=' + pin.id + '">פתח על המפה</a></p>';
    out += '<p class="card__source">' + A.esc(pin.source) + '</p>';
    out += '</article>';
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
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openTerm) { closeTerm(true); e.stopPropagation(); } }, true);
  window.addEventListener('scroll', function () { closeTerm(false); }, true);
  window.addEventListener('resize', function () { closeTerm(false); });
  A.closeTerm = closeTerm;

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
