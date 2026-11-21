/* Atlas — the map page (index.html) */
(function () {
  'use strict';
  var A = window.Atlas, V = window.AtlasVendor;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var PIN_R = 9, CLUSTER_R = 24, MAX_K = 14;
  var state = {
    q: '', tags: new Set(), issue: 'all', area: 'all', prio: new Set(), mode: 'all', diff: false,
    upto: 0, pattern: null, selected: null, view: 'map'
  };
  var pins = [], pinById = {}, issues = [], patterns = [], areas = [];
  var svg, gLand, gPins, projection, path, transform, zoomer, mapW = 0, mapH = 0, countryPaths;
  var playing = null, newIds = {}, lastFocus = null;

  A.loadIssues('', init);

  function init() {
    var idx = window.ATLAS_INDEX || { issues: [], patterns: [] };
    issues = idx.issues.slice().sort(function (a, b) { return a.issue < b.issue ? -1 : 1; });
    patterns = idx.patterns || [];
    pins = A.allPins();
    pins.forEach(function (p) { pinById[p.id] = p; p._issueIdx = issues.findIndex(function (i) { return i.issue === p.issue_date; }) + 1; p._search = A.norm([p.title_he, p.problem_he, p.idea_he, p.who_hurts, p.who_gains, p.why_now, p.place.country, p.place.country_en, p.place.city, p.place.region, p.tags.join(' '), p.id].join(' ')); });
    areas = Array.from(new Set(pins.map(function (p) { return p.place.area; }))).sort(function (a, b) { return a.localeCompare(b, 'he'); });
    state.upto = issues.length;

    buildFilters();
    buildTimeline();
    buildPatterns();
    buildIssues();
    setupMap();
    bindChrome();
    update();
    routeFromHash();
    window.addEventListener('hashchange', routeFromHash);
    A.analytics();
  }

  /* ======================= Filtering ======================= */
  function passes(p) {
    if (p._issueIdx > state.upto) return false;
    if (state.issue !== 'all' && p.issue_date !== state.issue) return false;
    if (state.area !== 'all' && p.place.area !== state.area) return false;
    if (state.tags.size && !p.tags.some(function (t) { return state.tags.has(t); })) return false;
    if (state.prio.size && !state.prio.has(p.priority)) return false;
    if (state.mode === 'direct' && p.indirect) return false;
    if (state.mode === 'indirect' && !p.indirect) return false;
    if (state.diff && !p.diff_candidate) return false;
    if (state.q) {
      var words = A.norm(state.q).split(' ');
      for (var i = 0; i < words.length; i++) if (words[i] && p._search.indexOf(words[i]) < 0) return false;
    }
    return true;
  }
  function visiblePins() { return pins.filter(passes); }
  function activeFilterCount() {
    return (state.q ? 1 : 0) + state.tags.size + (state.issue !== 'all' ? 1 : 0) + (state.area !== 'all' ? 1 : 0) +
      state.prio.size + (state.mode !== 'all' ? 1 : 0) + (state.diff ? 1 : 0);
  }
  function inPattern(p) {
    if (!state.pattern) return true;
    var pat = patterns.find(function (x) { return x.id === state.pattern; });
    return pat ? pat.members.indexOf(p.id) >= 0 : true;
  }

  function buildFilters() {
    $('#f-tags').innerHTML = '<div class="chips">' + A.TAGS.map(function (t) { return A.tagChip(t, false, true); }).join('') + '</div>';
    $('#f-issue').innerHTML = '<option value="all">כל הגיליונות</option>' + issues.slice().reverse().map(function (i) {
      return '<option value="' + i.issue + '">' + A.dateHe(i.issue) + '</option>';
    }).join('');
    $('#f-area').innerHTML = '<option value="all">כל האזורים</option>' + areas.map(function (a) { return '<option>' + A.esc(a) + '</option>'; }).join('');

    $('#f-q').addEventListener('input', function (e) { state.q = e.target.value; update(); });
    $('#f-tags').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var t = b.getAttribute('data-tag');
      if (state.tags.has(t)) state.tags.delete(t); else state.tags.add(t);
      b.setAttribute('aria-pressed', state.tags.has(t));
      update();
    });
    $('#f-issue').addEventListener('change', function (e) { state.issue = e.target.value; update(); });
    $('#f-area').addEventListener('change', function (e) { state.area = e.target.value; update(); });
    $('#f-prio').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var v = b.getAttribute('data-prio');
      if (state.prio.has(v)) state.prio.delete(v); else state.prio.add(v);
      b.setAttribute('aria-pressed', state.prio.has(v));
      update();
    });
    $('#f-mode').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.mode = b.getAttribute('data-mode');
      $$('#f-mode button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      update();
    });
    $('#f-diff').addEventListener('change', function (e) { state.diff = e.target.checked; update(); });
    $('#f-reset').addEventListener('click', resetFilters);
  }
  function resetFilters() {
    state.q = ''; state.tags.clear(); state.issue = 'all'; state.area = 'all'; state.prio.clear(); state.mode = 'all'; state.diff = false;
    $('#f-q').value = ''; $('#f-issue').value = 'all'; $('#f-area').value = 'all'; $('#f-diff').checked = false;
    $$('#f-tags .chip, #f-prio .chip').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    $$('#f-mode button').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-mode') === 'all'); });
    update();
  }

  /* ======================= Update cycle ======================= */
  function update() {
    var vis = visiblePins();
    renderStats(vis);
    renderList(vis);
    drawPins();
    var n = activeFilterCount();
    $('#result-count').textContent = vis.length + ' מתוך ' + pins.length + ' נעצים';
    $('#filters-count').textContent = n ? ' (' + n + ')' : '';
    $('#map-empty').hidden = vis.length > 0;
  }

  function renderStats(vis) {
    var countries = new Set(vis.map(function (p) { return p.place.country_en; }));
    var counts = {};
    vis.forEach(function (p) { p.tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || A.TAGS.indexOf(a) - A.TAGS.indexOf(b); })[0];
    var visIds = new Set(vis.map(function (p) { return p.id; }));
    var patCount = patterns.filter(function (pt) { return pt.members.filter(function (m) { return visIds.has(m); }).length >= 3; }).length;
    $('#s-pins').textContent = vis.length;
    $('#s-countries').textContent = countries.size;
    $('#s-patterns').textContent = patCount;
    $('#s-tag').innerHTML = top ? A.swatch(A.TAG_FAMILY[top]) + '<span>' + A.esc(top) + '</span>' : '—';
    $('#s-tag').title = top ? top + ' · ' + counts[top] + ' נעצים' : '';
  }

  /* ======================= List view ======================= */
  var PR = { A: 0, B: 1, C: 2 };
  function renderList(vis) {
    var sorted = vis.slice().sort(function (a, b) {
      return (inPattern(b) - inPattern(a)) || PR[a.priority] - PR[b.priority] || (a.id < b.id ? 1 : -1);
    });
    if (!sorted.length) { $('#list').innerHTML = '<p class="list-empty">אין נעצים שמתאימים לסינון. <button type="button" class="btn" data-reset>נקה סינון</button></p>'; return; }
    $('#list').innerHTML = sorted.map(function (p) {
      var fam = A.famOf(p);
      return '<button type="button" class="pcard' + (inPattern(p) ? '' : ' is-dim') + (state.selected === p.id ? ' is-selected' : '') + '" data-open-pin="' + p.id + '" style="--fam:var(--fam-' + fam + ')">' +
        '<span class="pcard__top"><span class="dot' + (p.indirect ? ' dot--ring' : '') + '"></span><span class="place">' + A.esc(A.placeLine(p)) + '</span>' +
        (p.diff_candidate ? '<span class="badge badge--accent" title="מועמד ל-DIFF">★ DIFF</span>' : '') +
        '<span class="badge">' + p.priority + '</span></span>' +
        '<h3>' + A.esc(p.title_he) + '</h3><p>' + A.esc(p.problem_he) + '</p>' +
        '<span class="pcard__tags">' + p.tags.map(function (t) { return A.tagChip(t); }).join('') + (p.indirect ? '<span class="chip chip--static">קשר עקיף</span>' : '') + '</span></button>';
    }).join('');
  }

  /* ======================= Map ======================= */
  function setupMap() {
    var box = $('#mapbox');
    svg = V.select('#map');
    var world = window.ATLAS_WORLD;
    var land = V.feature(world, world.objects.countries);
    A.land = land;
    svg.append('path').attr('class', 'map-sphere');
    gLand = svg.append('g').attr('class', 'map-landg');
    gLand.append('path').attr('class', 'map-grat');
    countryPaths = gLand.selectAll('path.map-land').data(land.features).enter().append('path').attr('class', 'map-land');
    gPins = svg.append('g').attr('class', 'map-pins');
    transform = V.zoomIdentity;
    zoomer = V.zoom().scaleExtent([1, MAX_K]).on('zoom', function (e) {
      transform = e.transform;
      gLand.attr('transform', transform);
      svg.select('.map-sphere').attr('transform', transform);
      hideTip();
      drawPins();
    });
    svg.call(zoomer).on('dblclick.zoom', null);
    layout();
    if (window.ResizeObserver) new ResizeObserver(function () { if (box.clientWidth !== mapW || box.clientHeight !== mapH) layout(); }).observe(box);
    else window.addEventListener('resize', layout);

    // test/debug hook: centre a pin at zoom k without animation
    A.mapFocus = function (id, k) {
      var p = pinById[id]; if (!p) return null;
      svg.call(zoomer.transform, V.zoomIdentity.translate(mapW / 2, mapH / 2).scale(k || MAX_K).translate(-p._x, -p._y));
      var r = svg.node().getBoundingClientRect();
      return [r.left + mapW / 2 * (r.width / mapW), r.top + mapH / 2 * (r.height / mapH)];
    };
    A.mapReset = function () { svg.interrupt(); svg.call(zoomer.transform, V.zoomIdentity); };
    $('#z-in').addEventListener('click', function () { svg.transition().duration(300).call(zoomer.scaleBy, 1.8); });
    $('#z-out').addEventListener('click', function () { svg.transition().duration(300).call(zoomer.scaleBy, 1 / 1.8); });
    $('#z-reset').addEventListener('click', function () { svg.transition().duration(400).call(zoomer.transform, V.zoomIdentity); });
  }

  function layout() {
    var box = $('#mapbox');
    mapW = box.clientWidth; mapH = box.clientHeight;
    CLUSTER_R = mapW < 600 ? 30 : 22;
    if (!mapW || !mapH) return;
    box.style.setProperty('--mapH', mapH + 'px');
    svg.attr('viewBox', '0 0 ' + mapW + ' ' + mapH);
    projection = V.geoEqualEarth().fitExtent([[10, 10], [mapW - 10, mapH - 10]], A.land);
    path = V.geoPath(projection);
    svg.select('.map-sphere').attr('d', path({ type: 'Sphere' }));
    gLand.select('.map-grat').attr('d', path(V.geoGraticule10()));
    countryPaths.attr('d', path);
    zoomer.translateExtent([[0, 0], [mapW, mapH]]).extent([[0, 0], [mapW, mapH]]);
    pins.forEach(function (p) { var xy = projection([p.place.lng, p.place.lat]); p._x = xy[0]; p._y = xy[1]; });
    svg.call(zoomer.transform, V.zoomIdentity);
  }

  function screen(p) { return [transform.applyX(p._x), transform.applyY(p._y)]; }

  function clusterize(vis) {
    var items = vis.map(function (p) { var s = screen(p); return { p: p, x: s[0], y: s[1] }; })
      .sort(function (a, b) { return PR[a.p.priority] - PR[b.p.priority]; });
    var used = new Set(), out = [];
    items.forEach(function (it, i) {
      if (used.has(i)) return;
      var group = [it]; used.add(i);
      items.forEach(function (o, j) {
        if (used.has(j)) return;
        if (Math.hypot(o.x - it.x, o.y - it.y) < CLUSTER_R) { group.push(o); used.add(j); }
      });
      if (group.length === 1) out.push({ type: 'pin', key: it.p.id, x: it.x, y: it.y, pin: it.p });
      else {
        var x = 0, y = 0; group.forEach(function (g) { x += g.x; y += g.y; });
        out.push({ type: 'cluster', key: 'c:' + group.map(function (g) { return g.p.id; }).sort().join(','), x: x / group.length, y: y / group.length, pins: group.map(function (g) { return g.p; }) });
      }
    });
    return out;
  }

  var STAR = 'M0-4.2 1.2-1.4 4.2-1.3 1.9.6 2.6 3.6 0 2 -2.6 3.6 -1.9.6 -4.2-1.3 -1.2-1.4z';
  function drawPins() {
    if (!projection) return;
    var vis = visiblePins();
    var nodes = clusterize(vis);
    var sel = gPins.selectAll('g.node').data(nodes, function (d) { return d.key; });
    sel.exit().remove();
    var enter = sel.enter().append('g').attr('class', 'node').attr('tabindex', 0).attr('role', 'button');
    enter.each(function (d) {
      var g = V.select(this);
      var inner = g.append('g').attr('class', 'node__in');
      if (d.type === 'pin') {
        var p = d.pin, fam = A.famOf(p), f = A.famById(fam);
        g.classed('pin', true).classed('is-indirect', p.indirect).classed('is-diff', p.diff_candidate)
          .attr('data-id', p.id).attr('data-fam', fam).attr('style', '--fam:var(--fam-' + fam + ')')
          .attr('aria-label', p.title_he + ' — ' + A.placeLine(p) + (p.indirect ? ' (קשר עקיף)' : ''));
        inner.append('circle').attr('class', 'pin__halo').attr('r', PIN_R + 3);
        if (p.indirect) inner.append('circle').attr('class', 'pin__dash').attr('r', PIN_R + 3.2);
        inner.append('circle').attr('class', 'pin__body').attr('r', PIN_R).attr('fill', 'var(--fam-' + fam + ')');
        var gl = inner.append('path').attr('class', 'pin__glyph').attr('d', f.glyph).attr('transform', 'translate(-6,-6)');
        if (f.stroke) gl.attr('style', 'fill:none;stroke:' + (p.indirect ? 'var(--fam)' : '#fff') + ';stroke-width:1.4;stroke-linejoin:round');
        if (p.diff_candidate) inner.append('path').attr('class', 'pin__star').attr('d', STAR).attr('transform', 'translate(8,-8)');
      } else {
        g.classed('cluster', true).attr('aria-label', d.pins.length + ' נעצים באזור: ' + d.pins.map(function (p) { return p.title_he; }).join('; '));
        inner.append('circle').attr('r', 13 + Math.min(8, d.pins.length));
        inner.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').text(d.pins.length);
      }
    });
    var all = enter.merge(sel);
    all.attr('transform', function (d) { return 'translate(' + d.x.toFixed(1) + ',' + d.y.toFixed(1) + ')'; })
      .classed('is-dim', function (d) { return d.type === 'pin' ? !inPattern(d.pin) : !d.pins.some(inPattern); })
      .classed('is-selected', function (d) { return d.type === 'pin' && d.pin.id === state.selected; })
      .classed('is-new', function (d) { return d.type === 'pin' ? !!newIds[d.pin.id] : d.pins.some(function (p) { return newIds[p.id]; }); })
      .each(function (d) {
        var delay = d.type === 'pin' ? newIds[d.pin.id] : null;
        if (delay != null) this.firstChild.style.animationDelay = delay + 'ms';
      });
    // selected / highlighted on top
    all.filter(function (d) { return d.type === 'pin' && (d.pin.id === state.selected); }).raise();

    all.on('click', function (e, d) { e.stopPropagation(); activate(d); })
      .on('keydown', function (e, d) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(d); } })
      .on('mouseenter', function (e, d) { showTip(d); })
      .on('mouseleave', hideTip)
      .on('focus', function (e, d) { showTip(d); })
      .on('blur', hideTip);
    // countries with pins get a subtle tint
    var withPins = new Set(vis.map(function (p) { return p.place.iso_n3; }));
    countryPaths.classed('is-active', function (f) { return withPins.has(f.id); });
  }

  function activate(d) {
    hideTip();
    if (d.type === 'pin') { openPin(d.pin.id); return; }
    var xs = d.pins.map(function (p) { return p._x; }), ys = d.pins.map(function (p) { return p._y; });
    var dx = Math.max.apply(null, xs) - Math.min.apply(null, xs), dy = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    var spread = Math.max(dx, dy);
    var need = spread > 0.01 ? (CLUSTER_R * 1.6) / spread : Infinity;
    if (need > MAX_K || transform.k >= MAX_K * 0.98) { openCluster(d.pins); return; }
    var k = Math.min(MAX_K, Math.max(transform.k * 2, need));
    var cx = (Math.max.apply(null, xs) + Math.min.apply(null, xs)) / 2, cy = (Math.max.apply(null, ys) + Math.min.apply(null, ys)) / 2;
    svg.transition().duration(500).call(zoomer.transform, V.zoomIdentity.translate(mapW / 2, mapH / 2).scale(k).translate(-cx, -cy));
  }

  /* tooltip */
  var tip;
  function showTip(d) {
    tip = tip || $('#map-tip');
    if (window.matchMedia('(hover: none)').matches) return;
    var html;
    if (d.type === 'pin') html = '<b>' + A.esc(d.pin.title_he) + '</b>' + A.esc(A.placeLine(d.pin)) + ' · ' + A.esc(d.pin.tags[0]) + (d.pin.indirect ? ' · קשר עקיף' : '');
    else html = '<b>' + d.pins.length + ' נעצים</b>' + d.pins.map(function (p) { return A.esc(p.title_he); }).join('<br>');
    tip.innerHTML = html; tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var x = Math.min(Math.max(8, d.x - w / 2), mapW - w - 8), y = d.y - h - 18;
    if (y < 8) y = d.y + 18;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  function ensureOnMap(p) {
    if (!projection || !passes(p)) return;
    var s = screen(p);
    var m = 40, x0 = 0, x1 = mapW;
    // on desktop the drawer floats over part of the map: keep the pin in the uncovered part
    var dr = $('#drawer'), mb = $('#mapbox');
    if (dr.classList.contains('is-open') && window.matchMedia('(min-width: 861px)').matches) {
      var b = mb.getBoundingClientRect(), d = { left: dr.offsetLeft, right: dr.offsetLeft + dr.offsetWidth }; // offset* ignore the slide-in transform
      var coverL = Math.max(0, Math.min(mapW, d.right - b.left)), coverR = Math.max(0, Math.min(mapW, b.right - d.left));
      if (d.left <= b.left + 1) x0 = coverL; else if (d.right >= b.right - 1) x1 = mapW - coverR;
      if (x1 - x0 < 160) { x0 = 0; x1 = mapW; }
    }
    if (s[0] < x0 + m || s[0] > x1 - m || s[1] < m || s[1] > mapH - m) {
      var k = (x1 - x0 < mapW) ? Math.max(transform.k, 2) : transform.k;
      svg.transition().duration(450).call(zoomer.transform, V.zoomIdentity.translate((x0 + x1) / 2, mapH / 2).scale(k).translate(-p._x, -p._y));
    }
  }
  function fitPins(list) {
    if (!list.length || !projection) return;
    var xs = list.map(function (p) { return p._x; }), ys = list.map(function (p) { return p._y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var k = Math.min(MAX_K, 0.75 / Math.max((x1 - x0) / mapW, (y1 - y0) / mapH, 0.12));
    k = Math.max(1, k);
    svg.transition().duration(600).call(zoomer.transform, V.zoomIdentity.translate(mapW / 2, mapH / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
  }

  /* ======================= Drawer ======================= */
  function openPin(id, opts) {
    var p = pinById[id]; if (!p) return;
    opts = opts || {};
    if (!$('#drawer').classList.contains('is-open')) lastFocus = document.activeElement;
    state.selected = id;
    $('#drawer-crumb').textContent = A.placeLine(p);
    $('#drawer-body').innerHTML = A.renderCard(p, { pinById: pinById, onMap: true });
    $('#drawer-body').scrollTop = 0;
    showDrawer();
    if (!opts.noHash) setHash('pin=' + id);
    drawPins();
    $$('.pcard').forEach(function (c) { c.classList.toggle('is-selected', c.getAttribute('data-open-pin') === id); });
    ensureOnMap(p);
    var t = $('#drawer-body .card__title'); if (t) t.focus({ preventScroll: true });
  }
  function openCluster(list) {
    if (!$('#drawer').classList.contains('is-open')) lastFocus = document.activeElement;
    $('#drawer-crumb').textContent = list.length + ' נעצים באותו מקום';
    $('#drawer-body').innerHTML = '<h2 class="card__title" tabindex="-1" style="font-size:1.3rem">' + list.length + ' נעצים באותו מקום</h2><div class="cluster-list related">' +
      list.map(function (p) { return '<button type="button" data-open-pin="' + p.id + '"><span class="dot' + (p.indirect ? ' dot--ring' : '') + '" style="--fam:var(--fam-' + A.famOf(p) + ')"></span><span>' + A.esc(p.title_he) + '</span><small>' + A.esc(p.place.city || p.place.country) + '</small></button>'; }).join('') + '</div>';
    showDrawer();
    $('#drawer-body .card__title').focus({ preventScroll: true });
  }
  function showDrawer() {
    $('#drawer').classList.add('is-open');
    $('#drawer').removeAttribute('inert');
    if (window.matchMedia('(max-width: 860px)').matches) $('#scrim').hidden = false;
  }
  function closeDrawer() {
    $('#drawer').classList.remove('is-open');
    $('#drawer').setAttribute('inert', '');
    $('#scrim').hidden = !$('#filters').classList.contains('is-open');
    state.selected = null;
    setHash('');
    drawPins();
    $$('.pcard.is-selected').forEach(function (c) { c.classList.remove('is-selected'); });
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function setHash(h) {
    var url = location.href.split('#')[0] + (h ? '#' + h : '');
    try { history.replaceState(null, '', url); } catch (e) { /* some file:// contexts */ }
  }
  function routeFromHash() {
    var h = location.hash.replace(/^#/, '');
    var m = h.match(/^pin=([\w-]+)/);
    if (m && pinById[m[1]]) { openPin(m[1], { noHash: true }); return; }
    var pm = h.match(/^pattern=([\w-]+)/);
    if (pm) setPattern(pm[1], true);
  }

  /* ======================= Patterns ======================= */
  function patternCountries(pt) { return new Set(pt.members.map(function (id) { return pinById[id] && pinById[id].place.country_en; }).filter(Boolean)).size; }
  function buildPatterns() {
    var el = $('#patterns-list');
    if (!patterns.length) { el.innerHTML = '<p>עוד אין דפוסים. דפוס נוצר כשאותה בעיה מופיעה בשלושה מקומות או יותר.</p>'; return; }
    el.innerHTML = patterns.map(function (pt) {
      var n = patternCountries(pt);
      return '<button type="button" class="pattern" data-pattern="' + pt.id + '" aria-pressed="false">' +
        '<span class="pattern__count">אותה בעיה ב-' + n + ' מדינות · ' + pt.members.length + ' נעצים' + (pt.diff_candidate ? ' · ★ מועמד ל-DIFF' : '') + '</span>' +
        '<h3>' + A.esc(pt.title) + '</h3><p>' + A.esc(pt.summary) + '</p>' +
        '<span class="pattern__members">' + pt.members.map(function (id) { var p = pinById[id]; return p ? '<span class="chip chip--static"><span class="dot' + (p.indirect ? ' dot--ring' : '') + '" style="--fam:var(--fam-' + A.famOf(p) + ')"></span>' + A.esc(p.place.country) + '</span>' : ''; }).join('') + '</span>' +
        '<span class="pattern__lesson"><b>מה זה מלמד: </b>' + A.esc(pt.lesson) + '</span></button>';
    }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.pattern'); if (!b) return;
      var id = b.getAttribute('data-pattern');
      setPattern(state.pattern === id ? null : id);
      if (state.pattern) $('#explorer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  function setPattern(id, fromHash) {
    var pt = patterns.find(function (x) { return x.id === id; });
    state.pattern = pt ? id : null;
    $$('.pattern').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pattern') === state.pattern); });
    var ban = $('#pattern-banner');
    if (pt) {
      ban.hidden = false;
      $('#pattern-banner-text').textContent = 'דפוס: ' + pt.title;
      if (!fromHash) setHash('pattern=' + id);
      fitPins(pt.members.map(function (m) { return pinById[m]; }).filter(function (p) { return p && passes(p); }));
    } else {
      ban.hidden = true;
      if (!fromHash) setHash('');
    }
    update();
  }

  /* ======================= Issues ======================= */
  function buildIssues() {
    $('#issues-list').innerHTML = issues.slice().reverse().map(function (i) {
      return '<a class="issue-card" href="issue/' + i.issue + '.html"><span>המשלוח השבועי</span><b>' + A.dateHe(i.issue) + '</b><span>' + i.count + ' נעצים · ' + i.countries + ' מדינות</span></a>';
    }).join('');
  }

  /* ======================= Timeline ======================= */
  function buildTimeline() {
    var r = $('#tl-range');
    r.min = 0; r.max = issues.length; r.value = issues.length; r.step = 1;
    r.addEventListener('input', function () { stopPlay(); setUpto(+r.value, false); });
    $('#tl-play').addEventListener('click', function () { if (playing) stopPlay(); else startPlay(); });
    setUpto(issues.length, false);
  }
  function setUpto(i, animate) {
    newIds = {};
    if (animate && i > 0) {
      var iss = issues[i - 1].issue, n = 0;
      pins.filter(function (p) { return p.issue_date === iss; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; })
        .forEach(function (p) { newIds[p.id] = (n++) * 70; });
    }
    state.upto = i;
    $('#tl-range').value = i;
    var count = pins.filter(function (p) { return p._issueIdx <= i; }).length;
    var label = i === 0 ? 'לפני הגיליון הראשון' : 'עד גיליון <b>' + A.dateShort(issues[i - 1].issue) + '</b>';
    $('#tl-label').innerHTML = label + ' · <b class="num">' + count + '</b> נעצים';
    $('#tl-range').setAttribute('aria-valuetext', i === 0 ? 'לפני הגיליון הראשון' : 'עד גיליון ' + A.dateHe(issues[i - 1].issue) + ', ' + count + ' נעצים');
    update();
    if (animate) setTimeout(function () { newIds = {}; }, 2500);
  }
  function startPlay() {
    var step = 0;
    var btn = $('#tl-play');
    btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', 'עצור'); btn.querySelector('.i-play').style.display = 'none'; btn.querySelector('.i-pause').style.display = '';
    setUpto(0, false);
    playing = setInterval(function () {
      step++;
      setUpto(step, true);
      if (step >= issues.length) stopPlay();
    }, 1300);
  }
  function stopPlay() {
    if (playing) clearInterval(playing);
    playing = null;
    var btn = $('#tl-play');
    btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'נגן: הצג איך המפה גדלה'); btn.querySelector('.i-play').style.display = ''; btn.querySelector('.i-pause').style.display = 'none';
  }

  /* ======================= Chrome ======================= */
  function bindChrome() {
    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open-pin]');
      if (o) { e.preventDefault(); openPin(o.getAttribute('data-open-pin')); return; }
      if (e.target.closest('[data-reset]')) resetFilters();
    });
    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#pattern-clear').addEventListener('click', function () { setPattern(null); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if ($('#filters').classList.contains('is-open')) { toggleFilters(false); return; }
      if ($('#drawer').classList.contains('is-open')) closeDrawer();
    });
    $('#filters-toggle').addEventListener('click', function () { toggleFilters(true); });
    $('#filters-close').addEventListener('click', function () { toggleFilters(false); });
    $('#scrim').addEventListener('click', function () {
      if ($('#filters').classList.contains('is-open')) toggleFilters(false);
      else closeDrawer();
    });
    $$('#view-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.view = b.getAttribute('data-view');
        $$('#view-tabs button').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
        $('#stage').setAttribute('data-view', state.view);
        if (state.view === 'map') layout();
      });
    });
    $('#drawer').setAttribute('inert', '');
  }
  function toggleFilters(open) {
    $('#filters').classList.toggle('is-open', open);
    $('#filters-toggle').setAttribute('aria-expanded', open);
    $('#scrim').hidden = !open && !($('#drawer').classList.contains('is-open') && window.matchMedia('(max-width: 860px)').matches);
    if (open) $('#f-q').focus(); else $('#filters-toggle').focus();
  }
})();
