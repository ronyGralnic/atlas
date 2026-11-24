/* Atlas — the home page: living globe, ticker, playful filters, stories, dialogs */
(function () {
  'use strict';
  var A = window.Atlas, V = window.AtlasVendor;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var PR = { A: 0, B: 1, C: 2 };
  var PIN_R = 9;

  var state = { q: '', fams: new Set(), area: 'all', issue: 'all', upto: 0, pattern: null, selected: null, mode: 'globe' };
  var pins = [], pinById = {}, issues = [], patterns = [], areas = [], countries = {}, countryByN3 = {};

  /* ======================= Init ======================= */
  A.loadIssues('', init);

  function init() {
    var idx = window.ATLAS_INDEX || { issues: [], patterns: [] };
    issues = idx.issues.slice().sort(function (a, b) { return a.issue < b.issue ? -1 : 1; });
    patterns = idx.patterns || [];
    pins = A.allPins();
    pins.forEach(function (p) {
      pinById[p.id] = p;
      p._issueIdx = issues.findIndex(function (i) { return i.issue === p.issue_date; }) + 1;
      p._fams = A.pinFamilies(p);
      var pe = p.persona || {};
      p._search = A.norm([p.title_he, p.problem_he, p.idea_he, p.who_hurts, p.who_gains, p.why_now, p.hook_he, p.teaser_he, pe.name, pe.role, pe.home, p.place.country, p.place.country_en, p.place.city, p.place.region, p.place.area, p.tags.join(' ')].join(' '));
      var c = countries[p.place.iso2] || (countries[p.place.iso2] = { iso2: p.place.iso2, n3: p.place.iso_n3, name: p.place.country, pins: [] });
      c.pins.push(p);
      countryByN3[p.place.iso_n3] = c;
    });
    areas = Array.from(new Set(pins.map(function (p) { return p.place.area; }))).sort(function (a, b) { return a.localeCompare(b, 'he'); });
    state.upto = issues.length;

    var last = issues[issues.length - 1];
    if (last) $('#hero-kicker').textContent = 'עודכן ' + A.dateHe(last.issue) + ' · ' + last.count + ' סיפורים חדשים';
    buildFaces();
    buildTicker();
    buildExplore();
    buildGrid();
    buildTimeline();
    buildPatterns();
    buildIssues();
    setupMap();
    bindChrome();
    paintSky();
    update();
    routeFromHash();
    window.addEventListener('hashchange', routeFromHash);
    A.analytics();
  }

  /* ======================= Filtering ======================= */
  function passes(p, skip) {
    skip = skip || '';
    if (p._issueIdx > state.upto) return false;
    if (state.issue !== 'all' && p.issue_date !== state.issue) return false;
    if (skip !== 'area' && state.area !== 'all' && p.place.area !== state.area) return false;
    if (skip !== 'fam' && state.fams.size && !p._fams.some(function (f) { return state.fams.has(f); })) return false;
    if (state.q) {
      var words = A.norm(state.q).split(' ');
      for (var i = 0; i < words.length; i++) if (words[i] && p._search.indexOf(words[i]) < 0) return false;
    }
    return true;
  }
  function visiblePins() { return pins.filter(function (p) { return passes(p); }); }
  function inPattern(p) {
    if (!state.pattern) return true;
    var pat = patterns.find(function (x) { return x.id === state.pattern; });
    return pat ? pat.members.indexOf(p.id) >= 0 : true;
  }
  function anyFilter() { return !!(state.q || state.fams.size || state.area !== 'all' || state.issue !== 'all'); }

  function update() {
    var vis = visiblePins();
    renderTiles(); renderAreas(); renderStatus(vis); renderGrid(vis);
    drawPins();
    $('#map-empty').hidden = vis.length > 0;
    var withPins = new Set(vis.map(function (p) { return p.place.iso_n3; }));
    if (landSel) landSel.classed('has-pins', function (f) { return withPins.has(f.id); });
  }

  /* ======================= Hero bits ======================= */
  function byPriority(list) { return list.slice().sort(function (a, b) { return PR[a.priority] - PR[b.priority] || (a.id < b.id ? 1 : -1); }); }
  function buildFaces() {
    var list = byPriority(pins).slice(0, 7);
    var nCountries = Object.keys(countries).length;
    $('#faces').innerHTML = '<div class="faces__stack">' + list.map(function (p) {
      return '<button type="button" data-open-pin="' + p.id + '" aria-label="' + A.esc(p.persona.name + ', ' + p.place.country) + '" title="' + A.esc(p.persona.name + ' · ' + p.place.country) + '">' + A.avatar(p.persona.avatar, 44) + '</button>';
    }).join('') + '</div><p><b>' + pins.length + ' אנשים ב-' + nCountries + ' מדינות</b><br>וכל אחד מהם מחכה למשהו שעוד לא נבנה.</p>';
  }

  function buildTicker() {
    var list = byPriority(pins);
    var one = function (hidden) {
      return list.map(function (p) {
        return '<button type="button" class="ticker__item" data-open-pin="' + p.id + '"' + (hidden ? ' tabindex="-1" aria-hidden="true"' : '') + '>' +
          A.flag(p.place.iso2, '', '') + '<span class="ticker__hook">' + A.esc(p.hook_he) + '</span><span class="ticker__teaser">' + A.esc(p.teaser_he) + '</span></button>';
      }).join('');
    };
    var track = $('#ticker-track');
    track.innerHTML = one(false) + one(true);
    requestAnimationFrame(function () {
      var w = track.scrollWidth / 2;
      track.style.setProperty('--ticker-dur', Math.max(30, Math.round(w / 55)) + 's');
    });
    $('#ticker-pause').addEventListener('click', function () {
      var t = $('#ticker'), p = !t.classList.contains('is-paused');
      t.classList.toggle('is-paused', p);
      this.setAttribute('aria-pressed', p);
      this.setAttribute('aria-label', p ? 'הפעילו את פס ההתראות' : 'עצרו את פס ההתראות');
      this.querySelector('.i-pause').style.display = p ? 'none' : '';
      this.querySelector('.i-play').style.display = p ? '' : 'none';
    });
  }

  /* ======================= Explore (tiles, areas, search) ======================= */
  function buildExplore() {
    $('#tiles').innerHTML = A.FAMILIES.map(function (f) {
      return '<button type="button" class="tile" data-fam="' + f.id + '" style="--fam:var(--fam-' + f.id + ')" aria-pressed="false">' +
        '<span class="tile__icon">' + A.glyphSvg(f.id) + '</span><span class="tile__name">' + A.esc(f.name) + '</span><span class="tile__count"></span></button>';
    }).join('');
    $('#tiles').addEventListener('click', function (e) {
      var b = e.target.closest('.tile'); if (!b) return;
      var id = +b.getAttribute('data-fam');
      if (state.fams.has(id)) state.fams.delete(id); else state.fams.add(id);
      update(); focusGlobeOnVisible();
    });
    $('#areas').innerHTML = ['all'].concat(areas).map(function (a) {
      return '<button type="button" class="pill" data-area="' + A.esc(a) + '" aria-pressed="' + (a === 'all') + '">' + (a === 'all' ? 'כל העולם' : A.esc(a)) + ' <small></small></button>';
    }).join('');
    $('#areas').addEventListener('click', function (e) {
      var b = e.target.closest('.pill'); if (!b) return;
      state.area = b.getAttribute('data-area');
      update(); focusGlobeOnVisible();
    });
    var qt;
    $('#q').addEventListener('input', function (e) { state.q = e.target.value; clearTimeout(qt); qt = setTimeout(function () { update(); focusGlobeOnVisible(); }, 120); });
    if (issues.length > 1) {
      var sel = $('#f-issue'); sel.hidden = false;
      sel.innerHTML = '<option value="all">כל הגיליונות</option>' + issues.slice().reverse().map(function (i) { return '<option value="' + i.issue + '">' + A.dateHe(i.issue) + '</option>'; }).join('');
      sel.addEventListener('change', function () { state.issue = sel.value; update(); });
    }
  }
  function renderTiles() {
    var base = pins.filter(function (p) { return passes(p, 'fam'); });
    $$('#tiles .tile').forEach(function (b) {
      var id = +b.getAttribute('data-fam');
      var n = base.filter(function (p) { return p._fams.indexOf(id) >= 0; }).length;
      b.setAttribute('aria-pressed', state.fams.has(id));
      b.classList.toggle('is-empty', n === 0 && !state.fams.has(id));
      b.querySelector('.tile__count').textContent = n === 0 ? 'אין כרגע' : n === 1 ? 'סיפור אחד' : n + ' סיפורים';
    });
  }
  function renderAreas() {
    var base = pins.filter(function (p) { return passes(p, 'area'); });
    $$('#areas .pill').forEach(function (b) {
      var a = b.getAttribute('data-area');
      var n = a === 'all' ? base.length : base.filter(function (p) { return p.place.area === a; }).length;
      b.setAttribute('aria-pressed', state.area === a);
      b.querySelector('small').textContent = n;
    });
  }
  function renderStatus(vis) {
    var nc = new Set(vis.map(function (p) { return p.place.iso2; })).size;
    var html;
    if (!vis.length) html = 'אין סיפורים שמתאימים לבחירה. <button type="button" class="btn" data-reset>נקו הכל</button>';
    else if (!anyFilter()) html = '<span><b>' + vis.length + '</b> סיפורים מ-<b>' + nc + '</b> מדינות. בחרו נושא כדי לצמצם.</span>';
    else html = '<span>מציגים <b>' + vis.length + '</b> ' + (vis.length === 1 ? 'סיפור' : 'סיפורים') + ' מ-<b>' + nc + '</b> ' + (nc === 1 ? 'מדינה' : 'מדינות') + '</span><button type="button" class="btn btn--ghost" data-reset>נקו הכל</button>';
    $('#status').innerHTML = html;
  }
  function resetFilters() {
    state.q = ''; state.fams.clear(); state.area = 'all'; state.issue = 'all';
    $('#q').value = ''; if ($('#f-issue')) $('#f-issue').value = 'all';
    update();
  }

  /* ======================= Stories grid ======================= */
  var revealIO = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -40px 0px' }) : null;

  function storyCard(p) {
    var fam = A.famOf(p), f = A.famById(fam), pe = p.persona || {};
    return '<button type="button" class="story reveal" data-open-pin="' + p.id + '" data-id="' + p.id + '" style="--fam:var(--fam-' + fam + ')">' +
      '<span class="story__scene">' + A.scene(p.scene, fam) +
      '<span class="story__badge">' + A.swatch(fam) + A.esc(f.short) + '</span>' + (p.indirect ? '<span class="story__ind">קשר עקיף</span>' : '') + '</span>' +
      '<span class="story__body"><span class="story__place">' + A.flagPlace(p) + '<span>' + A.esc(A.placeLine(p)) + '</span></span>' +
      '<h3>' + A.esc(p.title_he) + '</h3>' +
      '<span class="story__who">' + A.avatar(pe.avatar, 40) + '<span><b>' + A.esc(pe.name) + '</b>' + A.esc(pe.role) + '</span></span>' +
      '<span class="story__idea">' + A.icon('idea') + '<span>' + A.esc(p.teaser_he) + '</span></span></span></button>';
  }
  function buildGrid() {
    $('#grid').innerHTML = byPriority(pins).map(storyCard).join('') + '<p class="grid-empty" id="grid-empty" hidden>אין סיפורים שמתאימים לבחירה. <button type="button" class="btn" data-reset>נקו הכל</button></p>';
    A.observeScenes($('#grid'));
    $$('#grid .story').forEach(function (el, i) {
      el.style.transitionDelay = (i % 3) * 70 + 'ms';
      if (revealIO) revealIO.observe(el); else el.classList.add('is-in');
    });
  }
  function renderGrid(vis) {
    var ok = new Set(vis.map(function (p) { return p.id; }));
    var order = byPriority(vis).sort(function (a, b) { return inPattern(b) - inPattern(a); });
    var rank = {}; order.forEach(function (p, i) { rank[p.id] = i; });
    $$('#grid .story').forEach(function (el) {
      var id = el.getAttribute('data-id'), p = pinById[id];
      el.hidden = !ok.has(id);
      el.style.order = rank[id] != null ? rank[id] : 999;
      el.classList.toggle('is-dim', !inPattern(p));
      el.classList.toggle('is-selected', state.selected === id);
    });
    var ge = $('#grid-empty'); if (ge) ge.hidden = vis.length > 0;
  }

  /* ======================= Map: globe + flat ======================= */
  var svg, defs, gAtmo, gOcean, gGrat, gLand, gNight, gTwi, gPins, landSel, zoomer;
  var W = 0, H = 0, R = 0;
  var rot = [-20, -18], gk = 1, prevT = null;
  var flatProj, flatPath, flatT = null, CLUSTER_R = 22, MAX_K = 14;
  var land110, land50, sunLL = [0, 0];
  var spinPaused = false, interactUntil = 0, hovering = false, tween = null, lastFrame = 0;
  var reduced = A.reducedMotion();

  function setupMap() {
    svg = V.select('#map');
    defs = svg.append('defs');
    defs.html('<radialGradient id="ocean" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="var(--ocean-1)"/><stop offset="1" stop-color="var(--ocean-2)"/></radialGradient>' +
      '<radialGradient id="atmo"><stop offset=".86" stop-color="#9fd3ff" stop-opacity=".55"/><stop offset="1" stop-color="#9fd3ff" stop-opacity="0"/></radialGradient>');
    gAtmo = svg.append('circle').attr('class', 'map-atmo');
    var gWorld = svg.append('g').attr('class', 'map-world');
    gOcean = gWorld.append('path').attr('class', 'map-ocean');
    gGrat = gWorld.append('path').attr('class', 'map-grat');
    gLand = gWorld.append('g');
    gTwi = gWorld.append('path').attr('class', 'map-twilight');
    gNight = gWorld.append('path').attr('class', 'map-night');
    gPins = svg.append('g').attr('class', 'map-pins');
    land110 = V.feature(window.ATLAS_WORLD_110, window.ATLAS_WORLD_110.objects.countries);
    land50 = V.feature(window.ATLAS_WORLD, window.ATLAS_WORLD.objects.countries);

    zoomer = V.zoom().on('zoom', onZoom).on('start', function (e) { if (e.sourceEvent) markInteract(); }).on('end', function (e) { if (e.sourceEvent) markInteract(); });
    svg.call(zoomer).on('dblclick.zoom', null);
    svg.on('pointerenter', function (e) { if (e.pointerType === 'mouse') hovering = true; }).on('pointerleave', function () { hovering = false; hideTip(); });

    layout();
    if (window.ResizeObserver) new ResizeObserver(function () { var b = $('#stage'); if (b.clientWidth !== W || b.clientHeight !== H) layout(); }).observe($('#stage'));
    else window.addEventListener('resize', layout);

    $('#z-in').addEventListener('click', function () { svg.transition().duration(300).call(zoomer.scaleBy, 1.7); });
    $('#z-out').addEventListener('click', function () { svg.transition().duration(300).call(zoomer.scaleBy, 1 / 1.7); });
    $('#z-reset').addEventListener('click', function () { svg.transition().duration(400).call(zoomer.transform, V.zoomIdentity); });
    $$('.mode button').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); }); });
    $('#spin').addEventListener('click', function () { setSpinPaused(!spinPaused); });
    if (reduced) setSpinPaused(true);
    document.addEventListener('atlas:theme', paintSky);
    requestAnimationFrame(frame);
    setInterval(function () { computeSun(); paintSky(); render(); }, 60000);
  }

  function setSpinPaused(p) {
    spinPaused = p;
    if (!p) interactUntil = 0;
    var b = $('#spin');
    b.setAttribute('aria-pressed', p);
    b.setAttribute('aria-label', p ? 'סובבו את הגלובוס' : 'עצרו את הסיבוב');
    b.querySelector('.i-pause').style.display = p ? 'none' : '';
    b.querySelector('.i-play').style.display = p ? '' : 'none';
    $('#stage').classList.toggle('is-still', reduced);
  }
  function markInteract() { interactUntil = performance.now() + 6000; }
  function drawerOpen() { return $('#drawer').classList.contains('is-open'); }
  function dialogOpen() { return !!document.querySelector('dialog[open]'); }
  function canSpin() {
    return state.mode === 'globe' && !spinPaused && !reduced && !document.hidden && !tween && !hovering &&
      performance.now() > interactUntil && !drawerOpen() && !dialogOpen();
  }
  function frame(t) {
    var dt = lastFrame ? Math.min(64, t - lastFrame) : 16;
    lastFrame = t;
    if (tween) {
      var k = Math.min(1, (t - tween.t0) / tween.ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      rot[0] = tween.from[0] + tween.d[0] * e; rot[1] = tween.from[1] + tween.d[1] * e;
      if (tween.gk) gk = tween.gk0 + (tween.gk - tween.gk0) * e;
      render();
      if (k >= 1) { var cb = tween.cb; tween = null; if (tween === null && cb) cb(); }
    } else if (canSpin()) {
      rot[0] = (rot[0] + dt * 0.0055) % 360;
      render();
    }
    requestAnimationFrame(frame);
  }
  function rotateTo(lng, lat, ms, cb, newK) {
    var to = [-lng, Math.max(-55, Math.min(55, -lat))];
    var d0 = ((to[0] - rot[0]) % 360 + 540) % 360 - 180;
    if (reduced) { rot = [rot[0] + d0, to[1]]; if (newK) gk = newK; syncZoomK(); render(); if (cb) cb(); return; }
    tween = { t0: performance.now(), ms: ms || 900, from: rot.slice(), d: [d0, to[1] - rot[1]], cb: function () { syncZoomK(); if (cb) cb(); }, gk0: gk, gk: newK || null };
  }
  function syncZoomK() {
    // keep d3-zoom's k in step with gk after a programmatic tween
    prevT = V.zoomIdentity.scale(gk);
    svg.property('__zoom', prevT);
  }

  function onZoom(e) {
    var t = e.transform;
    if (state.mode === 'globe') {
      if (!prevT) prevT = t;
      if (e.sourceEvent && e.sourceEvent.type !== 'wheel' && Math.abs(t.k - prevT.k) < 1e-6) {
        var s = 0.28 / gk;
        rot[0] = (rot[0] + (t.x - prevT.x) * s) % 360;
        rot[1] = Math.max(-75, Math.min(75, rot[1] - (t.y - prevT.y) * s));
      }
      gk = t.k; prevT = t;
      if (e.sourceEvent) markInteract();
    } else {
      flatT = t;
    }
    hideTip();
    render();
  }

  function setMode(m) {
    if (m === state.mode) return;
    state.mode = m;
    $$('.mode button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === m); });
    $('#stage').setAttribute('data-mode', m);
    $('#spin').hidden = m !== 'globe';
    prevT = null; gk = 1; flatT = V.zoomIdentity;
    configureZoom();
    svg.call(zoomer.transform, V.zoomIdentity);
    gNodesReset();
    render();
  }
  function configureZoom() {
    if (state.mode === 'globe') zoomer.scaleExtent([0.8, 8]).translateExtent([[-Infinity, -Infinity], [Infinity, Infinity]]);
    else zoomer.scaleExtent([1, MAX_K]).translateExtent([[0, 0], [W, H]]).extent([[0, 0], [W, H]]);
  }

  function layout() {
    var b = $('#stage');
    W = b.clientWidth; H = b.clientHeight;
    if (!W || !H) return;
    svg.attr('viewBox', '0 0 ' + W + ' ' + H);
    R = Math.min(W, H - 70) / 2 * 0.9;
    flatProj = V.geoEqualEarth().fitExtent([[10, 54], [W - 10, H - 64]], land50);
    flatPath = V.geoPath(flatProj);
    CLUSTER_R = W < 600 ? 26 : 22;
    pins.forEach(function (p) { var xy = flatProj([p.place.lng, p.place.lat]); p._fx = xy[0]; p._fy = xy[1]; });
    flatT = flatT || V.zoomIdentity;
    configureZoom();
    computeSun();
    landSel = null;
    gLand.selectAll('path').remove();
    render(true);
  }

  function globeProj() { return V.geoOrthographic().scale(R * gk).translate([W / 2, (H - 40) / 2 + 6]).rotate(rot).clipAngle(90).precision(0.6); }

  var lastLandMode = null;
  function render(force) {
    if (!W) return;
    var feats = state.mode === 'globe' ? land110.features : land50.features;
    if (lastLandMode !== state.mode || force || !landSel) {
      lastLandMode = state.mode;
      gLand.selectAll('path').remove();
      landSel = gLand.selectAll('path').data(feats).enter().append('path').attr('class', 'map-land')
        .on('click', function (e, f) { var c = countryByN3[f.id]; if (c && c.pins.some(function (p) { return passes(p); })) { e.stopPropagation(); openCountry(c.iso2); } })
        .on('mousemove', function (e, f) { var c = countryByN3[f.id]; if (c) showCountryTip(e, c); else hideTip(); })
        .on('mouseleave', hideTip);
      var withPins = new Set(visiblePins().map(function (p) { return p.place.iso_n3; }));
      landSel.classed('has-pins', function (f) { return withPins.has(f.id); });
    }
    var night = V.geoCircle().center([sunLL[0] + 180, -sunLL[1]]).radius(90)();
    var twi = V.geoCircle().center([sunLL[0] + 180, -sunLL[1]]).radius(97)();
    if (state.mode === 'globe') {
      var proj = globeProj(), path = V.geoPath(proj);
      var c = proj.translate();
      gAtmo.attr('cx', c[0]).attr('cy', c[1]).attr('r', R * gk * 1.07).attr('display', null);
      V.select('.map-world').attr('transform', null);
      gOcean.attr('class', 'map-ocean').attr('d', path({ type: 'Sphere' }));
      gGrat.attr('d', path(V.geoGraticule10()));
      landSel.attr('d', path);
      gNight.attr('d', path(night)); gTwi.attr('d', path(twi));
    } else {
      gAtmo.attr('display', 'none');
      gOcean.attr('class', 'map-flat-ocean').attr('d', flatPath({ type: 'Sphere' }));
      gGrat.attr('d', flatPath(V.geoGraticule10()));
      if (force || landSel.attr('data-p') !== 'flat') { landSel.attr('d', flatPath).attr('data-p', 'flat'); gNight.attr('d', flatPath(night)); gTwi.attr('d', flatPath(twi)); }
      V.select('.map-world').attr('transform', flatT);
    }
    drawPins();
  }

  /* ---- Sun & sky (time-of-day) ---- */
  function computeSun() {
    var d = new Date();
    var start = Date.UTC(d.getUTCFullYear(), 0, 0);
    var doy = (d - start) / 864e5;
    var decl = -23.44 * Math.cos(2 * Math.PI / 365 * (doy + 10));
    var b = 2 * Math.PI * (doy - 81) / 364;
    var eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b); // minutes
    var utcH = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    var lng = -15 * (utcH - 12 + eot / 60);
    lng = ((lng + 540) % 360) - 180;
    sunLL = [lng, decl];
    var dark = pins.filter(function (p) { return V.geoDistance([p.place.lng, p.place.lat], sunLL) > Math.PI / 2; }).length;
    var over = land110.features.find(function (f) { return V.geoContains(f, sunLL); });
    var c = over && countryByN3[over.id];
    var where = c ? c.name : (over ? 'יבשה' : 'האוקיינוס');
    $('#sunchip').innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3" fill="currentColor"/></svg><span>השמש עכשיו מעל ' + A.esc(where) + ' · לילה ב-' + dark + ' מתוך ' + pins.length + ' המקומות</span>';
  }
  var SKY = [
    [0, '#0e1a33', '#22345a', 1], [4.2, '#101c38', '#24365c', .95], [5.4, '#2b2f5c', '#e9a37f', .45], [6.5, '#f7c6a5', '#cfe0f1', .05], [9, '#b9dcf3', '#eef4f6', 0],
    [16, '#a9d4f0', '#f3efe6', 0], [18, '#ffcf9e', '#f2b8a0', 0], [19.5, '#6a5a9e', '#f09a7a', .3], [21, '#14203d', '#2a3a62', .9], [24, '#0e1a33', '#22345a', 1]
  ];
  function mix(a, b, k) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k), g = Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k), bl = Math.round((pa & 255) * (1 - k) + (pb & 255) * k);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  function paintSky() {
    var d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    var i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
    var a = SKY[i], b = SKY[i + 1], k = (h - a[0]) / (b[0] - a[0]);
    var top = mix(a[1], b[1], k), bot = mix(a[2], b[2], k), stars = a[3] + (b[3] - a[3]) * k;
    if (A.isDark()) { top = mix(top, '#0b0d12', .55); bot = mix(bot, '#0b0d12', .6); stars = Math.max(stars, .35); }
    var st = $('#stage').style;
    st.setProperty('--sky-top', top); st.setProperty('--sky-bot', bot); st.setProperty('--stars', stars.toFixed(2));
    $('#stage').setAttribute('data-daypart', A.dayPart(Math.floor(h)));
  }

  /* ---- Pins ---- */
  function pinXY(p, proj) {
    if (state.mode === 'globe') {
      var center = [-rot[0], -rot[1]];
      if (V.geoDistance([p.place.lng, p.place.lat], center) > Math.PI / 2 - 0.06) return null;
      return proj([p.place.lng, p.place.lat]);
    }
    return [flatT.applyX(p._fx), flatT.applyY(p._fy)];
  }
  function clusterize(list) {
    var proj = state.mode === 'globe' ? globeProj() : null;
    var items = [];
    list.forEach(function (p) { var s = pinXY(p, proj); if (s) items.push({ p: p, x: s[0], y: s[1] }); });
    items.sort(function (a, b) { return PR[a.p.priority] - PR[b.p.priority] || (a.p.id < b.p.id ? -1 : 1); });
    var used = new Set(), out = [];
    items.forEach(function (it, i) {
      if (used.has(i)) return;
      var group = [it]; used.add(i);
      items.forEach(function (o, j) { if (!used.has(j) && Math.hypot(o.x - it.x, o.y - it.y) < CLUSTER_R) { group.push(o); used.add(j); } });
      if (group.length === 1) out.push({ type: 'pin', key: it.p.id, x: it.x, y: it.y, pin: it.p });
      else {
        var x = 0, y = 0; group.forEach(function (g) { x += g.x; y += g.y; });
        out.push({ type: 'cluster', key: 'c:' + group.map(function (g) { return g.p.id; }).sort().join(','), x: x / group.length, y: y / group.length, pins: group.map(function (g) { return g.p; }) });
      }
    });
    return out;
  }
  var newIds = {};
  function gNodesReset() { if (gPins) gPins.selectAll('g.node').remove(); }
  function drawPins() {
    if (!W || !gPins) return;
    var nodes = clusterize(visiblePins());
    var sel = gPins.selectAll('g.node').data(nodes, function (d) { return d.key; });
    sel.exit().remove();
    var enter = sel.enter().append('g').attr('class', 'node').attr('tabindex', 0).attr('role', 'button');
    enter.each(function (d, i) {
      var g = V.select(this), inner = g.append('g').attr('class', 'node__in');
      if (d.type === 'pin') {
        var p = d.pin, fam = A.famOf(p), f = A.famById(fam);
        g.classed('pin', true).classed('is-indirect', p.indirect).attr('data-id', p.id).attr('data-fam', fam).attr('style', '--fam:var(--fam-' + fam + ')')
          .attr('aria-label', p.title_he + ' · ' + A.placeLine(p) + (p.indirect ? ' · קשר עקיף' : ''));
        inner.append('circle').attr('class', 'pin__pulse').attr('r', PIN_R).style('animation-delay', ((parseInt(p.id.slice(-2), 10) % 7) * 0.37) + 's');
        inner.append('circle').attr('class', 'pin__halo').attr('r', PIN_R + 3);
        if (p.indirect) inner.append('circle').attr('class', 'pin__dash').attr('r', PIN_R + 3.2);
        inner.append('circle').attr('class', 'pin__body').attr('r', PIN_R).attr('fill', 'var(--fam-' + fam + ')');
        var gl = inner.append('path').attr('class', 'pin__glyph').attr('d', f.glyph).attr('transform', 'translate(-6,-6)');
        if (f.stroke) gl.attr('style', 'fill:none;stroke:' + (p.indirect ? 'var(--fam)' : '#fff') + ';stroke-width:1.4;stroke-linejoin:round');
      } else {
        g.classed('cluster', true).attr('aria-label', d.pins.length + ' סיפורים קרובים: ' + d.pins.map(function (p) { return p.place.country; }).join(', '));
        inner.append('circle').attr('r', 13 + Math.min(8, d.pins.length));
        inner.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').text(d.pins.length);
      }
    });
    var all = enter.merge(sel);
    all.attr('transform', function (d) { return 'translate(' + d.x.toFixed(1) + ',' + d.y.toFixed(1) + ')'; })
      .classed('is-dim', function (d) { return d.type === 'pin' ? !inPattern(d.pin) : !d.pins.some(inPattern); })
      .classed('is-selected', function (d) { return d.type === 'pin' && d.pin.id === state.selected; })
      .classed('is-new', function (d) { return d.type === 'pin' ? newIds[d.pin.id] != null : d.pins.some(function (p) { return newIds[p.id] != null; }); })
      .each(function (d) { if (d.type === 'pin' && newIds[d.pin.id] != null) this.firstChild.style.animationDelay = newIds[d.pin.id] + 'ms'; });
    all.filter(function (d) { return d.type === 'pin' && d.pin.id === state.selected; }).raise();
    all.on('click', function (e, d) { e.stopPropagation(); activate(d); })
      .on('keydown', function (e, d) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(d); } })
      .on('mouseenter', function (e, d) { showTip(d); })
      .on('mouseleave', hideTip)
      .on('focus', function (e, d) { showTip(d); markInteract(); })
      .on('blur', hideTip);
  }

  function activate(d) {
    hideTip(); markInteract();
    if (d.type === 'pin') { openPin(d.pin.id); return; }
    var ps = d.pins;
    var spread = 0;
    ps.forEach(function (a) { ps.forEach(function (b) { spread = Math.max(spread, V.geoDistance([a.place.lng, a.place.lat], [b.place.lng, b.place.lat])); }); });
    if (state.mode === 'globe') {
      var cLng = ps.reduce(function (s, p) { return s + p.place.lng; }, 0) / ps.length, cLat = ps.reduce(function (s, p) { return s + p.place.lat; }, 0) / ps.length;
      if (spread < 0.002 || gk >= 7.5) { openCluster(ps); return; }
      var need = Math.min(8, Math.max(gk * 2, (CLUSTER_R * 1.8) / (spread * R)));
      rotateTo(cLng, cLat, 800, null, need);
    } else {
      var xs = ps.map(function (p) { return p._fx; }), ys = ps.map(function (p) { return p._fy; });
      var sp = Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys));
      var needK = sp > 0.01 ? (CLUSTER_R * 1.6) / sp : Infinity;
      if (needK > MAX_K || flatT.k >= MAX_K * 0.98) { openCluster(ps); return; }
      var k = Math.min(MAX_K, Math.max(flatT.k * 2, needK));
      var cx = (Math.max.apply(null, xs) + Math.min.apply(null, xs)) / 2, cy = (Math.max.apply(null, ys) + Math.min.apply(null, ys)) / 2;
      svg.transition().duration(500).call(zoomer.transform, V.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-cx, -cy));
    }
  }

  /* tooltips */
  var tip;
  function placeTip(x, y) {
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var tx = Math.min(Math.max(8, x - w / 2), W - w - 8), ty = y - h - 18;
    if (ty < 8) ty = y + 18;
    tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
  }
  function showTip(d) {
    tip = tip || $('#map-tip');
    if (window.matchMedia('(hover: none)').matches) return;
    if (d.type === 'pin') {
      var p = d.pin, t = A.localHour(p.place.tz);
      tip.innerHTML = A.avatar(p.persona.avatar, 36) + '<span><b>' + A.esc(p.title_he) + '</b>' + A.esc(p.persona.name) + ' · ' + A.esc(A.placeLine(p)) + (t ? '<br>עכשיו שם ' + t.text + ' · ' + A.dayPart(t.h) : '') + '</span>';
    } else tip.innerHTML = '<span><b>' + d.pins.length + ' סיפורים קרובים</b>' + d.pins.map(function (p) { return A.esc(p.place.country + ': ' + p.title_he); }).join('<br>') + '<br>לחצו כדי להתקרב</span>';
    tip.hidden = false;
    placeTip(d.x, d.y);
  }
  function showCountryTip(e, c) {
    tip = tip || $('#map-tip');
    var n = c.pins.filter(function (p) { return passes(p); }).length;
    if (!n) { hideTip(); return; }
    var r = $('#stage').getBoundingClientRect();
    tip.innerHTML = A.flag(c.iso2, 'flag--md', '') + '<span><b>' + A.esc(c.name) + '</b>' + (n === 1 ? 'סיפור אחד' : n + ' סיפורים') + ' · לחצו לכולם</span>';
    tip.hidden = false;
    placeTip(e.clientX - r.left, e.clientY - r.top);
  }
  function hideTip() { if (tip) tip.hidden = true; }

  function focusOnPin(p) {
    if (state.mode === 'globe') { rotateTo(p.place.lng, p.place.lat, 900, null, Math.max(gk, 1.6)); return; }
    var x = flatT.applyX(p._fx), y = flatT.applyY(p._fy), m = 50;
    if (x < m || x > W - m || y < m || y > H - m) {
      var k = Math.max(flatT.k, 2);
      svg.transition().duration(450).call(zoomer.transform, V.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-p._fx, -p._fy));
    }
  }
  function focusGlobeOnVisible() {
    var vis = visiblePins();
    if (!vis.length || !anyFilter()) return;
    if (state.mode === 'globe') {
      var x = 0, y = 0, z = 0;
      vis.forEach(function (p) { var l = p.place.lng * Math.PI / 180, f = p.place.lat * Math.PI / 180; x += Math.cos(f) * Math.cos(l); y += Math.cos(f) * Math.sin(l); z += Math.sin(f); });
      var lng = Math.atan2(y, x) * 180 / Math.PI, lat = Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI;
      rotateTo(lng, lat, 900, null, 1);
    }
    markInteract();
  }
  function fitPatternFlat(list) {
    var xs = list.map(function (p) { return p._fx; }), ys = list.map(function (p) { return p._fy; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var k = Math.max(1, Math.min(MAX_K, 0.75 / Math.max((x1 - x0) / W, (y1 - y0) / H, 0.12)));
    svg.transition().duration(600).call(zoomer.transform, V.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
  }

  /* test & debug hooks */
  A.mapReset = function () { tween = null; svg.interrupt(); setSpinPaused(true); if (state.mode === 'globe') { rot = [-20, -18]; gk = 1; } svg.call(zoomer.transform, V.zoomIdentity); render(); };
  A.setMode = setMode;
  A.stopSpin = function () { setSpinPaused(true); };
  A.mapFocus = function (id, k) {
    var p = pinById[id]; if (!p) return null;
    tween = null;
    if (state.mode === 'globe') { rot = [-p.place.lng, -p.place.lat]; gk = k || 6; syncZoomK(); render(); var c = globeProj()([p.place.lng, p.place.lat]); var r = svg.node().getBoundingClientRect(); return [r.left + c[0] * r.width / W, r.top + c[1] * r.height / H]; }
    svg.call(zoomer.transform, V.zoomIdentity.translate(W / 2, H / 2).scale(k || MAX_K).translate(-p._fx, -p._fy));
    var rr = svg.node().getBoundingClientRect();
    return [rr.left + W / 2 * (rr.width / W), rr.top + H / 2 * (rr.height / H)];
  };

  /* ======================= Drawer ======================= */
  var lastFocus = null;
  function openPin(id, opts) {
    var p = pinById[id]; if (!p) return;
    opts = opts || {};
    if (dialogOpen()) $$('dialog[open]').forEach(function (d) { d.close(); });
    if (!drawerOpen()) lastFocus = document.activeElement;
    state.selected = id;
    $('#drawer-body').innerHTML = A.renderCard(p, { pinById: pinById, onMap: true });
    $('#drawer-body').scrollTop = 0;
    A.observeScenes($('#drawer-body'));
    $('#copied').hidden = true;
    showDrawer();
    if (!opts.noHash) setHash('pin=' + id);
    renderGrid(visiblePins());
    drawPins();
    if (passes(p)) focusOnPin(p);
    var t = $('#drawer-body .card__title'); if (t) t.focus({ preventScroll: true });
  }
  function openCluster(list) {
    if (!drawerOpen()) lastFocus = document.activeElement;
    $('#drawer-body').innerHTML = '<div class="cluster-list related"><h2 class="card__title" tabindex="-1">' + list.length + ' סיפורים באותו מקום</h2>' +
      list.map(function (p) { return '<button type="button" data-open-pin="' + p.id + '">' + A.avatar(p.persona.avatar, 32) + '<span>' + A.esc(p.title_he) + '</span><small>' + A.esc(p.persona.name) + '</small></button>'; }).join('') + '</div>';
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
    $('#scrim').hidden = true;
    state.selected = null;
    setHash('');
    renderGrid(visiblePins());
    drawPins();
    markInteract();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function setHash(h) {
    var url = location.href.split('#')[0] + (h ? '#' + h : '');
    try { history.replaceState(null, '', url); } catch (e) { /* some file:// contexts */ }
  }
  function routeFromHash() {
    var h = location.hash.replace(/^#/, '');
    var m;
    if ((m = h.match(/^pin=([\w-]+)/)) && pinById[m[1]]) { openPin(m[1], { noHash: true }); return; }
    if ((m = h.match(/^pattern=([\w-]+)/))) { setPattern(m[1], true); return; }
    if ((m = h.match(/^country=([a-z]{2})/)) && countries[m[1]]) { openCountry(m[1], true); return; }
    if (h === 'stats') openStats(true);
  }
  function share() {
    var url = location.href.split('#')[0] + '#pin=' + state.selected;
    var done = function () { $('#copied').hidden = false; setTimeout(function () { $('#copied').hidden = true; }, 2200); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); done();
    }
  }

  /* ======================= Dialogs ======================= */
  function openDialog(d) { if (!d.open) d.showModal(); }
  function openCountries() {
    var list = Object.keys(countries).map(function (k) { return countries[k]; })
      .sort(function (a, b) { return b.pins.length - a.pins.length || a.name.localeCompare(b.name, 'he'); });
    $('#dlg-country-h').innerHTML = 'בחרו מדינה';
    $('#country-back').hidden = true;
    $('#country-body').innerHTML = '<p style="margin-top:0;color:var(--ink-2)">כל מדינה, הבעיות שלה והרעיונות שלנו.</p><div class="countries">' + list.map(function (c) {
      return '<button type="button" class="country-btn" data-country="' + c.iso2 + '">' + A.flag(c.iso2, 'flag--lg', '') + '<b>' + A.esc(c.name) + '</b><small>' + (c.pins.length === 1 ? 'סיפור אחד' : c.pins.length + ' סיפורים') + '</small></button>';
    }).join('') + '</div>';
    openDialog($('#dlg-country'));
    setHash('');
  }
  function openCountry(iso2, fromHash) {
    var c = countries[iso2]; if (!c) return;
    var list = byPriority(c.pins);
    var t = A.localHour(list[0].place.tz);
    $('#dlg-country-h').innerHTML = A.flag(iso2, 'flag--md', '') + '<span>' + A.esc(c.name) + '</span>';
    $('#country-back').hidden = false;
    $('#country-body').innerHTML = '<div class="spot__hero">' + A.flag(iso2, 'flag--xl', '') + '<div><h3>' + A.esc(c.name) + '</h3><p>' +
      (list.length === 1 ? 'בעיה אחת ורעיון אחד' : list.length + ' בעיות, ' + list.length + ' רעיונות') + (t ? ' · עכשיו שם ' + t.text + ', ' + A.dayPart(t.h) : '') + '</p></div></div>' +
      '<div class="spot__list">' + list.map(function (p) {
        var fam = A.famOf(p);
        return '<button type="button" class="spot-item" data-open-pin="' + p.id + '" style="--fam:var(--fam-' + fam + ')"><span class="spot-item__scene">' + A.scene(p.scene, fam) + '</span>' +
          '<span class="spot-item__body"><h4>' + A.esc(p.title_he) + '</h4><span class="story__who">' + A.avatar(p.persona.avatar, 30) + '<span><b>' + A.esc(p.persona.name) + '</b>' + A.esc(p.persona.role) + '</span></span>' +
          '<p><b>הבעיה: </b>' + A.esc(p.problem_he) + '</p><p><b>הרעיון: </b>' + A.esc(p.teaser_he) + '</p></span></button>';
      }).join('') + '</div>';
    A.observeScenes($('#country-body'));
    openDialog($('#dlg-country'));
    if (!fromHash) setHash('country=' + iso2);
  }
  function bars(rows, max) {
    return '<ul class="bars">' + rows.map(function (r) {
      return '<li class="bar"' + (r.fam ? ' style="--fam:var(--fam-' + r.fam + ')"' : '') + '><span class="bar__label">' + r.label + '</span><span class="bar__track"><span class="bar__fill" data-w="' + (100 * r.v / max).toFixed(1) + '"></span></span><span class="bar__v">' + r.v + '</span></li>';
    }).join('') + '</ul>';
  }
  function openStats(fromHash) {
    var vis = pins.filter(function (p) { return p._issueIdx <= state.upto; });
    var nC = new Set(vis.map(function (p) { return p.place.iso2; })).size;
    var famRows = A.FAMILIES.map(function (f) { return { label: A.swatch(f.id) + A.esc(f.name), v: vis.filter(function (p) { return p._fams.indexOf(f.id) >= 0; }).length, fam: f.id }; })
      .sort(function (a, b) { return b.v - a.v; });
    var cRows = Object.keys(countries).map(function (k) { var c = countries[k]; return { label: A.flag(c.iso2, '', '') + A.esc(c.name), v: c.pins.filter(function (p) { return p._issueIdx <= state.upto; }).length }; })
      .filter(function (r) { return r.v; }).sort(function (a, b) { return b.v - a.v || 0; });
    var aRows = areas.map(function (a) { return { label: A.esc(a), v: vis.filter(function (p) { return p.place.area === a; }).length }; }).sort(function (a, b) { return b.v - a.v; });
    var iRows = issues.map(function (i) { return { label: A.esc(A.dateHe(i.issue)), v: i.count }; });
    var maxF = Math.max.apply(null, famRows.map(function (r) { return r.v; }).concat([1]));
    var maxC = Math.max.apply(null, cRows.map(function (r) { return r.v; }).concat([1]));
    var maxA = Math.max.apply(null, aRows.map(function (r) { return r.v; }).concat([1]));
    var maxI = Math.max.apply(null, iRows.map(function (r) { return r.v; }).concat([1]));
    $('#stats-body').innerHTML =
      '<div class="stats-hero">' +
      [['סיפורים', vis.length], ['מדינות', nC], ['אנשים שפגשנו', vis.length], ['רעיונות לבנות', vis.length], ['דפוסים', patterns.length]].map(function (x) { return '<div class="bignum"><b data-count="' + x[1] + '">0</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>' +
      '<div class="chart"><h3>על מה המפה מדברת</h3><p class="note">כמה סיפורים נוגעים בכל נושא. סיפור יכול לגעת ביותר מנושא אחד.</p>' + bars(famRows, maxF) + '</div>' +
      '<div class="chart-cols"><div class="chart"><h3>איפה</h3><p class="note">סיפורים לפי מדינה</p>' + bars(cRows, maxC) + '</div>' +
      '<div class="chart"><h3>אזורים בעולם</h3><p class="note">סיפורים לפי אזור</p>' + bars(aRows, maxA) + '</div></div>' +
      '<div class="chart"><h3>איך המפה גדלה</h3><p class="note">סיפורים חדשים בכל גיליון' + (issues.length < 2 ? '. כל שבוע תתווסף כאן שורה.' : '') + '</p>' + bars(iRows, maxI) + '</div>';
    openDialog($('#dlg-stats'));
    requestAnimationFrame(function () {
      $$('#stats-body .bar__fill').forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
      $$('#stats-body [data-count]').forEach(function (el) { A.countUp(el, +el.getAttribute('data-count'), 900); });
    });
    if (!fromHash) setHash('stats');
  }

  /* ======================= Patterns ======================= */
  function buildPatterns() {
    var el = $('#patterns-list');
    if (!patterns.length) { el.innerHTML = '<p>עוד אין דפוסים. דפוס נוצר כשאותה בעיה מופיעה בשלושה מקומות או יותר.</p>'; return; }
    el.innerHTML = patterns.map(function (pt) {
      var ms = pt.members.map(function (id) { return pinById[id]; }).filter(Boolean);
      var n = new Set(ms.map(function (p) { return p.place.iso2; })).size;
      return '<button type="button" class="pattern" data-pattern="' + pt.id + '" aria-pressed="false">' +
        '<span class="pattern__count">אותה בעיה ב-' + n + ' מדינות</span>' +
        '<h3>' + A.esc(pt.title) + '</h3><p>' + A.esc(pt.summary) + '</p>' +
        '<span class="pattern__members">' + ms.map(function (p) { return '<span class="chip chip--static">' + A.flag(p.place.iso2, '', '') + A.esc(p.place.country) + '</span>'; }).join('') + '</span>' +
        '<span class="faces__stack">' + ms.map(function (p) { return '<span>' + A.avatar(p.persona.avatar, 34) + '</span>'; }).join('') + '</span>' +
        '<span class="pattern__lesson"><b>מה זה מלמד: </b>' + A.esc(pt.lesson) + '</span></button>';
    }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.pattern'); if (!b) return;
      var id = b.getAttribute('data-pattern');
      setPattern(state.pattern === id ? null : id);
      if (state.pattern) $('#stage').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
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
      var ms = pt.members.map(function (m) { return pinById[m]; }).filter(function (p) { return p && passes(p); });
      if (state.mode === 'flat') fitPatternFlat(ms);
      else if (ms.length) { var p0 = ms[0]; rotateTo(p0.place.lng, p0.place.lat, 900, null, 1); }
      markInteract();
    } else {
      ban.hidden = true;
      if (!fromHash) setHash('');
    }
    update();
  }

  /* ======================= Issues ======================= */
  function buildIssues() {
    $('#issues-list').innerHTML = issues.slice().reverse().map(function (i) {
      var ps = byPriority(pins.filter(function (p) { return p.issue_date === i.issue; })).slice(0, 6);
      return '<a class="issue-card" href="issue/' + i.issue + '.html"><span>המשלוח השבועי</span><b>' + A.dateHe(i.issue) + '</b><span>' + i.count + ' סיפורים · ' + i.countries + ' מדינות</span>' +
        '<span class="faces__stack">' + ps.map(function (p) { return '<span>' + A.avatar(p.persona.avatar, 34) + '</span>'; }).join('') + '</span></a>';
    }).join('');
  }

  /* ======================= Timeline ======================= */
  var playing = null;
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
    $('#tl-label').innerHTML = i === 0 ? 'לפני הגיליון הראשון' : 'עד <b>' + A.dateShort(issues[i - 1].issue) + '</b> · <b class="num">' + count + '</b> סיפורים';
    $('#tl-range').setAttribute('aria-valuetext', i === 0 ? 'לפני הגיליון הראשון' : 'עד גיליון ' + A.dateHe(issues[i - 1].issue) + ', ' + count + ' סיפורים');
    update();
    if (animate) setTimeout(function () { newIds = {}; }, 2500);
  }
  function startPlay() {
    var step = 0, btn = $('#tl-play');
    btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', 'עצרו');
    btn.querySelector('.i-play').style.display = 'none'; btn.querySelector('.i-pause').style.display = '';
    setUpto(0, false);
    playing = setInterval(function () { step++; setUpto(step, true); if (step >= issues.length) stopPlay(); }, 1300);
  }
  function stopPlay() {
    if (playing) clearInterval(playing);
    playing = null;
    var btn = $('#tl-play');
    btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'נגנו: איך המפה גדלה');
    btn.querySelector('.i-play').style.display = ''; btn.querySelector('.i-pause').style.display = 'none';
  }

  /* ======================= Chrome ======================= */
  function bindChrome() {
    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open-pin]');
      if (o) { e.preventDefault(); openPin(o.getAttribute('data-open-pin')); return; }
      if (e.target.closest('[data-reset]')) { resetFilters(); return; }
      var c = e.target.closest('[data-country]');
      if (c) { openCountry(c.getAttribute('data-country')); return; }
      var x = e.target.closest('[data-close]');
      if (x) { x.closest('dialog').close(); }
    });
    $$('dialog.dlg').forEach(function (d) {
      d.addEventListener('close', function () { if (/^#(stats|country=)/.test(location.hash)) setHash(''); markInteract(); });
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    });
    $('#country-back').addEventListener('click', openCountries);
    $('#open-countries').addEventListener('click', openCountries);
    $('#open-stats').addEventListener('click', function () { openStats(); });
    $('#surprise').addEventListener('click', function () {
      var vis = visiblePins().filter(function (p) { return p.id !== state.selected; });
      if (!vis.length) vis = pins;
      openPin(vis[Math.floor(Math.random() * vis.length)].id);
    });
    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#share').addEventListener('click', share);
    $('#pattern-clear').addEventListener('click', function () { setPattern(null); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || dialogOpen() || A.termOpen()) return;
      if (drawerOpen()) closeDrawer();
    });
    $('#scrim').addEventListener('click', closeDrawer);
    $('#drawer').setAttribute('inert', '');
    $('#stage').setAttribute('data-mode', 'globe');
  }
})();
