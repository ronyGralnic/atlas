/* Atlas scenes — one small animated illustration per story (inline SVG + CSS animation, no images to fetch).
   A.scene(id, famId) → SVG string. Animation runs only while the scene is on screen (.is-live), never with reduced motion. */
(function () {
  'use strict';
  var A = (window.Atlas = window.Atlas || {});
  var W = 320, H = 160;

  function sky() { return '<rect width="' + W + '" height="' + H + '" fill="var(--sc-sky)"/>'; }
  function ground(y, c) { return '<rect y="' + y + '" width="' + W + '" height="' + (H - y) + '" fill="' + (c || 'var(--sc-ground)') + '"/>'; }
  function sun(x, y, r, cls) { return '<g class="' + (cls || 'a-glow') + '"><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="var(--sc-sun)"/></g>'; }
  function building(x, y, w, h, lit) {
    var s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="var(--sc-mass)"/>';
    for (var yy = y + 8; yy < y + h - 8; yy += 12) for (var xx = x + 6; xx < x + w - 6; xx += 10) {
      var on = ((xx * 7 + yy * 3) % 5) < 2;
      s += '<rect x="' + xx + '" y="' + yy + '" width="5" height="6" fill="' + (on && lit ? 'var(--sc-light)' : 'var(--sc-window)') + '"' + (on && lit && (xx + yy) % 3 === 0 ? ' class="a-flicker"' : '') + '/>';
    }
    return s;
  }
  function wave(y, c, cls) {
    return '<path class="' + (cls || 'a-wave') + '" d="M-40 ' + y + ' q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V' + H + ' H-40Z" fill="' + c + '"/>';
  }
  function cloud(x, y, s) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + (s || 1) + ')"><g class="a-drift"><path d="M0 12a10 10 0 0 1 12-10 14 14 0 0 1 26 4 9 9 0 0 1 2 18H2A8 8 0 0 1 0 12z" fill="var(--sc-cloud)"/></g></g>'; }
  function pylon(x, y) {
    return '<g stroke="var(--sc-ink)" stroke-width="2" fill="none"><path d="M' + x + ' ' + y + 'l10 -60 10 60M' + (x + 3) + ' ' + (y - 20) + 'h14M' + (x + 6) + ' ' + (y - 40) + 'h8M' + (x - 6) + ' ' + (y - 52) + 'h32"/></g>';
  }

  var S = {};

  S.leak = function () {
    return sky() + building(14, 34, 46, 90, true) + building(66, 54, 38, 70, true) + building(230, 40, 50, 84, true) + building(284, 62, 34, 62, true) +
      ground(124) +
      '<rect x="0" y="92" width="320" height="12" fill="var(--sc-ink)" opacity=".85"/><rect x="146" y="90" width="22" height="16" rx="3" fill="var(--sc-ink)"/>' +
      '<path d="M156 104l-3 6 5 -2 -2 6" stroke="var(--fam)" stroke-width="2" fill="none"/>' +
      [0, 1, 2].map(function (i) { return '<circle class="a-drip" style="animation-delay:' + (i * 0.45) + 's" cx="' + (154 + i * 4) + '" cy="108" r="3.2" fill="var(--fam)"/>'; }).join('') +
      '<ellipse class="a-pulse" cx="158" cy="140" rx="34" ry="6" fill="var(--fam)" opacity=".45"/>' +
      '<g transform="translate(200 76)"><rect x="0" y="0" width="3" height="48" fill="var(--sc-ink)"/><rect x="-6" y="-4" width="15" height="6" rx="2" fill="var(--sc-ink)"/><circle class="a-flicker" cx="1.5" cy="5" r="5" fill="var(--sc-light)"/></g>';
  };

  S.bill = function () {
    return sky() + cloud(30, 20, .9) + ground(128) +
      '<rect x="40" y="56" width="120" height="72" fill="var(--sc-mass)"/><rect x="82" y="36" width="36" height="24" fill="var(--sc-mass)"/>' +
      '<path d="M96 40h8v6h6v8h-6v6h-8v-6h-6v-8h6z" fill="#e63946"/>' + building(40, 64, 120, 64, true).replace(/<rect x="40"[^>]*\/>/, '') +
      '<g class="a-bob"><rect x="190" y="30" width="80" height="104" rx="4" fill="var(--sc-paper)" stroke="var(--sc-ink)" stroke-width="1.5"/>' +
      [0, 1, 2, 3, 4].map(function (i) { return '<rect x="200" y="' + (44 + i * 14) + '" width="' + (44 + (i * 13) % 20) + '" height="5" rx="2" fill="var(--sc-ink)" opacity=".5"/><rect x="252" y="' + (44 + i * 14) + '" width="10" height="5" rx="2" fill="var(--sc-ink)" opacity=".7"/>'; }).join('') +
      '<rect x="198" y="116" width="64" height="10" rx="3" fill="var(--fam)"/></g>' +
      '<g class="a-rise"><path d="M282 112l14 -30 14 30h-8v18h-12v-18z" fill="#e63946"/></g>';
  };

  S.gold = function () {
    return sky() + ground(70, 'var(--sc-green)') +
      '<g class="a-fly"><rect x="40" y="14" width="18" height="10" rx="2" fill="var(--sc-ink)"/><rect x="22" y="16" width="16" height="6" fill="var(--fam)"/><rect x="60" y="16" width="16" height="6" fill="var(--fam)"/>' +
      '<path class="a-scan" d="M49 26 L20 96 H78 Z" fill="var(--fam)" opacity=".18"/></g>' +
      '<path class="a-wave" d="M-40 112 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V140 H-40Z" fill="#b08968"/>' +
      '<rect y="140" width="320" height="20" fill="#9c6644"/>' +
      [[90, 124], [130, 130], [178, 122], [230, 128]].map(function (p, i) { return '<path class="a-twinkle" style="animation-delay:' + i * .4 + 's" d="M' + p[0] + ' ' + p[1] + 'l6 -5 6 5 -6 4z" fill="#f2c14e"/>'; }).join('') +
      '<g transform="translate(232 54)"><rect x="0" y="16" width="44" height="18" rx="3" fill="#f2a541"/><circle cx="8" cy="36" r="5" fill="var(--sc-ink)"/><circle cx="36" cy="36" r="5" fill="var(--sc-ink)"/>' +
      '<g class="a-sway" style="transform-origin:6px 18px"><path d="M6 18 L-22 -4 L-40 20" stroke="#f2a541" stroke-width="5" fill="none"/><path d="M-46 18h12l-2 10h-8z" fill="#f2a541"/></g></g>';
  };

  S.sub = function () {
    return sky() + sun(270, 34, 16) + cloud(40, 18, .8) +
      '<rect x="210" y="40" width="6" height="66" fill="var(--sc-ink)"/><g class="a-sway" style="transform-origin:213px 42px"><path d="M213 42h70" stroke="var(--sc-ink)" stroke-width="5"/><path d="M276 42v26" stroke="var(--sc-ink)" stroke-width="1.5"/><rect x="270" y="66" width="12" height="9" fill="var(--fam)"/></g>' +
      '<rect x="190" y="104" width="130" height="10" fill="var(--sc-mass)"/>' +
      wave(104, 'var(--sc-sea)') +
      '<g class="a-bob"><path d="M40 112h110a16 10 0 0 1 0 20H40a16 10 0 0 1 0-20z" fill="var(--sc-ink)"/><rect x="84" y="98" width="26" height="16" rx="3" fill="var(--sc-ink)"/><path d="M98 98v-12h8" stroke="var(--sc-ink)" stroke-width="3" fill="none"/><circle cx="60" cy="122" r="2" fill="var(--fam)"/><circle cx="72" cy="122" r="2" fill="var(--fam)"/></g>' +
      wave(128, 'var(--sc-sea2)', 'a-wave a-wave--slow');
  };

  S.wiretap = function () {
    return sky() +
      '<g transform="translate(84 22)"><rect width="56" height="104" rx="9" fill="var(--sc-ink)"/><rect x="5" y="10" width="46" height="80" rx="3" fill="var(--sc-screen)"/><circle cx="28" cy="96" r="3" fill="var(--sc-window)"/>' +
      '<path d="M20 44c0-8 16-8 16 0v8c0 6-16 6-16 0z" fill="var(--fam)"/><path d="M16 52c0 10 24 10 24 0M28 62v8" stroke="var(--fam)" stroke-width="2" fill="none"/></g>' +
      [0, 1, 2].map(function (i) { return '<path class="a-pulse" style="animation-delay:' + i * .5 + 's" d="M' + (150 + i * 14) + ' 54 q' + (12 + i * 4) + ' 20 0 40" stroke="var(--fam)" stroke-width="3" fill="none"/>'; }).join('') +
      '<g transform="translate(212 34)"><rect width="88" height="92" rx="4" fill="var(--sc-paper)" stroke="var(--sc-ink)" stroke-width="1.5"/>' +
      [0, 1, 2, 3, 4].map(function (i) { return '<g class="a-type" style="animation-delay:' + i * .6 + 's"><circle cx="12" cy="' + (16 + i * 16) + '" r="3" fill="' + (i === 3 ? '#e63946' : 'var(--fam)') + '"/><rect x="20" y="' + (13 + i * 16) + '" width="' + (40 + (i * 11) % 22) + '" height="6" rx="3" fill="var(--sc-ink)" opacity=".55"/></g>'; }).join('') + '</g>';
  };

  S.clock = function () {
    return sky() + ground(130) +
      '<path d="M30 130V74l60 -40 60 40v56z" fill="var(--sc-mass)"/><rect x="76" y="98" width="28" height="32" fill="var(--sc-window)"/>' +
      '<g transform="translate(230 70)"><circle r="44" fill="var(--sc-paper)" stroke="var(--sc-ink)" stroke-width="3"/>' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { var a = i * Math.PI / 6; return '<circle cx="' + (36 * Math.sin(a)).toFixed(1) + '" cy="' + (-36 * Math.cos(a)).toFixed(1) + '" r="2" fill="var(--sc-ink)"/>'; }).join('') +
      '<g class="a-spin a-spin--fast"><rect x="-1.5" y="-34" width="3" height="34" rx="1.5" fill="var(--fam)"/></g><g class="a-spin a-spin--slow"><rect x="-2.5" y="-22" width="5" height="22" rx="2.5" fill="var(--sc-ink)"/></g><circle r="4" fill="var(--sc-ink)"/></g>' +
      '<g transform="translate(160 110)"><path d="M0 0h40v14a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z" fill="var(--sc-ink)"/><rect x="-4" y="-4" width="48" height="5" rx="2" fill="var(--sc-ink)"/>' +
      [0, 1, 2].map(function (i) { return '<path class="a-steam" style="animation-delay:' + i * .5 + 's" d="M' + (10 + i * 10) + ' -8 q-5 -8 0 -16 t0 -16" stroke="var(--sc-steam)" stroke-width="2.5" fill="none" stroke-linecap="round"/>'; }).join('') + '</g>';
  };

  S.hourglass = function () {
    return sky() +
      '<g transform="translate(70 18)"><rect x="-6" y="0" width="72" height="8" rx="3" fill="var(--sc-ink)"/><rect x="-6" y="116" width="72" height="8" rx="3" fill="var(--sc-ink)"/>' +
      '<path d="M2 8h56c0 30-22 40-22 54s22 24 22 54H2c0-30 22-40 22-54S2 38 2 8z" fill="var(--sc-glass)" stroke="var(--sc-ink)" stroke-width="2"/>' +
      '<path class="a-drain" d="M10 18h40c-2 14-12 22-20 34-8-12-18-20-20-34z" fill="var(--fam)"/>' +
      '<rect class="a-drip a-drip--line" x="28.5" y="62" width="3" height="44" fill="var(--fam)"/>' +
      '<path class="a-heap" d="M8 116c6-14 14-20 22-20s16 6 22 20z" fill="var(--fam)"/></g>' +
      '<g transform="translate(190 46)"><rect width="76" height="76" rx="8" fill="var(--sc-ink)"/><rect x="16" y="16" width="44" height="44" rx="4" fill="var(--sc-mass)"/>' +
      [0, 1, 2, 3, 4].map(function (i) { return '<rect x="' + (8 + i * 14) + '" y="-10" width="4" height="10" fill="var(--sc-ink)"/><rect x="' + (8 + i * 14) + '" y="76" width="4" height="10" fill="var(--sc-ink)"/>'; }).join('') +
      '<circle class="a-blink" cx="38" cy="38" r="8" fill="#e63946"/></g>';
  };

  S.kitchen = function () {
    return sky() + ground(126) +
      '<rect x="30" y="86" width="120" height="40" rx="4" fill="var(--sc-mass)"/><rect x="40" y="80" width="100" height="6" fill="var(--sc-ink)"/>' +
      '<g transform="translate(60 54)"><path d="M0 0h52v22a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8z" fill="var(--sc-ink)"/>' +
      [0, 1, 2].map(function (i) { return '<path class="a-steam" style="animation-delay:' + i * .45 + 's" d="M' + (12 + i * 14) + ' -4 q-6 -9 0 -18 t0 -18" stroke="var(--sc-steam)" stroke-width="3" fill="none" stroke-linecap="round"/>'; }).join('') + '</g>' +
      '<g transform="translate(186 24)"><rect width="100" height="112" rx="8" fill="var(--sc-paper)" stroke="var(--sc-ink)" stroke-width="2"/>' +
      [0, 1, 2, 3].map(function (i) { return '<path class="a-twinkle" style="animation-delay:' + i * .25 + 's" d="M' + (20 + i * 20) + ' 12l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L11 19l6-1z" fill="' + (i < 3 ? '#f2c14e' : 'var(--sc-window)') + '"/>'; }).join('') +
      '<g transform="translate(26 44)">' + qr() + '</g></g>';
    function qr() {
      var s = '<rect width="48" height="48" fill="#fff"/>';
      for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) if (((x * 3 + y * 5 + x * y) % 3 === 0) || (x < 2 && y < 2) || (x > 5 && y < 2) || (x < 2 && y > 5)) s += '<rect x="' + (x * 6) + '" y="' + (y * 6) + '" width="6" height="6" fill="#111"/>';
      return s;
    }
  };

  S.scooter = function () {
    return sky() + building(10, 40, 50, 80, true) + building(250, 30, 60, 90, true) + ground(120, 'var(--sc-road)') +
      '<g class="a-road">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<rect x="' + (i * 50 - 40) + '" y="138" width="26" height="4" fill="var(--sc-paper)"/>'; }).join('') + '</g>' +
      '<g transform="translate(120 70)"><g class="a-bob"><circle cx="10" cy="56" r="12" fill="var(--sc-ink)"/><circle cx="74" cy="56" r="12" fill="var(--sc-ink)"/><circle cx="10" cy="56" r="4" fill="var(--sc-window)"/><circle cx="74" cy="56" r="4" fill="var(--sc-window)"/>' +
      '<path d="M10 56h40l14-30h10" stroke="var(--sc-ink)" stroke-width="5" fill="none" stroke-linejoin="round"/><rect x="16" y="14" width="32" height="28" rx="3" fill="var(--fam)"/><path d="M26 22h12" stroke="#fff" stroke-width="3"/></g></g>';
  };

  S.radar = function () {
    return sky() + ground(128) +
      '<g transform="translate(110 72)">' + [56, 40, 24].map(function (r) { return '<circle r="' + r + '" fill="none" stroke="var(--fam)" stroke-width="1.5" opacity=".5"/>'; }).join('') +
      '<g class="a-spin a-spin--radar"><path d="M0 0L0 -56A56 56 0 0 1 40 -39Z" fill="var(--fam)" opacity=".35"/><path d="M0 0V-56" stroke="var(--fam)" stroke-width="2"/></g>' +
      '<circle class="a-blink" cx="26" cy="-30" r="4" fill="#e63946"/><circle r="5" fill="var(--sc-ink)"/></g>' +
      '<path d="M110 128v-20" stroke="var(--sc-ink)" stroke-width="6"/>' +
      '<path class="a-dash" d="M170 70 C210 30 250 30 292 60" stroke="var(--sc-ink)" stroke-width="2" stroke-dasharray="6 6" fill="none"/>' +
      '<g transform="translate(278 56)"><rect width="30" height="22" rx="3" fill="var(--sc-mass)" stroke="var(--sc-ink)"/><path d="M6 8h18M6 14h12" stroke="var(--sc-ink)" stroke-width="2"/></g>';
  };

  S.port = function () {
    var cont = ['#e76f51', '#2a9d8f', '#e9c46a', '#457b9d', '#f4a261', '#8ab17d'];
    return sky() + sun(46, 34, 14) +
      '<rect x="200" y="96" width="120" height="16" fill="var(--sc-mass)"/>' +
      '<g transform="translate(236 20)"><rect x="0" y="0" width="5" height="78" fill="var(--sc-ink)"/><rect x="34" y="0" width="5" height="78" fill="var(--sc-ink)"/><g class="a-sway" style="transform-origin:20px 4px"><rect x="-70" y="0" width="114" height="6" fill="var(--fam)"/><path d="M-50 6v26" stroke="var(--sc-ink)" stroke-width="1.5"/><rect x="-58" y="32" width="16" height="10" fill="#e9c46a"/></g></g>' +
      wave(110, 'var(--sc-sea)') +
      '<g class="a-bob"><path d="M20 108h160l-14 22H34z" fill="var(--sc-ink)"/>' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (i) { return '<rect x="' + (34 + (i % 6) * 22) + '" y="' + (i < 6 ? 94 : 80) + '" width="20" height="13" fill="' + cont[i % 6] + '"/>'; }).join('') + '</g>' +
      '<g class="a-drive">' + [0, 1, 2].map(function (i) { return '<g transform="translate(' + (210 + i * 38) + ' 82)"><rect width="22" height="12" fill="' + cont[i + 1] + '"/><rect x="22" y="3" width="8" height="9" fill="var(--sc-ink)"/></g>'; }).join('') + '</g>';
  };

  S.rec = function () {
    return sky() + ground(132) +
      '<g transform="translate(20 34)" fill="var(--sc-mass)"><path d="M0 26L70 0l70 26z"/>' + [0, 1, 2, 3].map(function (i) { return '<rect x="' + (12 + i * 34) + '" y="32" width="12" height="62"/>'; }).join('') + '<rect y="94" width="140" height="6"/></g>' +
      '<g transform="translate(196 22)"><rect width="88" height="120" rx="10" fill="var(--sc-ink)"/><rect x="6" y="10" width="76" height="96" rx="3" fill="var(--sc-screen)"/>' +
      '<path d="M14 18h12M14 18v12M74 18h-12M74 18v12M14 98h12M14 98v-12M74 98h-12M74 98v-12" stroke="#fff" stroke-width="2.5"/>' +
      '<circle class="a-blink" cx="22" cy="40" r="5" fill="#e63946"/><text x="30" y="44" font-size="10" font-weight="700" fill="#fff" font-family="sans-serif">REC</text>' +
      '<g class="a-pop"><path d="M44 62l14 -6 14 6v10c0 8-6 12-14 16-8-4-14-8-14-16z" fill="var(--fam)"/><path d="M51 70l5 5 9-9" stroke="#fff" stroke-width="2.5" fill="none"/></g></g>';
  };

  S.solar = function () {
    var panel = function (x, y) { return '<g transform="translate(' + x + ' ' + y + ') skewX(-20)"><rect width="46" height="16" fill="#1d3557"/><path d="M11.5 0v16M23 0v16M34.5 0v16M0 8h46" stroke="#a8dadc" stroke-width="1"/></g>'; };
    return sky() + '<g class="a-sunarc">' + sun(60, 30, 16, '') + '</g>' + ground(124) +
      '<path d="M20 124V86l40-26 40 26v38z" fill="var(--sc-mass)"/>' + panel(38, 68) +
      '<path d="M120 124V80h80v44z" fill="var(--sc-mass)"/><path d="M114 82l46-24 46 24z" fill="var(--sc-ink)"/>' + panel(134, 64) +
      pylon(250, 124) + '<path d="M200 96 C220 90 240 80 256 72 M276 72 C292 76 306 82 330 86" stroke="var(--sc-ink)" stroke-width="1.5" fill="none"/>' +
      '<g class="a-flow">' + [0, 1, 2, 3].map(function (i) { return '<circle cx="' + (204 + i * 14) + '" cy="' + (94 - i * 6) + '" r="3" fill="var(--fam)"/>'; }).join('') + '</g>' +
      '<g transform="translate(206 104)"><rect width="26" height="20" rx="3" fill="var(--sc-paper)" stroke="var(--sc-ink)"/><path class="a-swap" d="M6 7h14l-4-3M20 13H6l4 3" stroke="var(--fam)" stroke-width="2" fill="none"/></g>';
  };

  S.balance = function () {
    return sky() + ground(136) +
      '<path d="M150 136l10-90 10 90z" fill="var(--sc-ink)"/><circle cx="160" cy="44" r="6" fill="var(--sc-ink)"/>' +
      '<g class="a-tilt" style="transform-origin:160px 46px"><rect x="66" y="43" width="188" height="6" rx="3" fill="var(--sc-ink)"/>' +
      '<path d="M76 49l-16 34h44z" stroke="var(--sc-ink)" stroke-width="1.5" fill="none"/><path d="M58 83h48a24 8 0 0 1-48 0z" fill="var(--fam)"/>' +
      '<path d="M244 49l-16 34h44z" stroke="var(--sc-ink)" stroke-width="1.5" fill="none"/><path d="M226 83h48a24 8 0 0 1-48 0z" fill="var(--sc-mass)"/>' +
      [0, 1, 2].map(function (i) { return '<ellipse cx="82" cy="' + (78 - i * 6) + '" rx="12" ry="4" fill="#f2c14e" stroke="#c99a2e"/>'; }).join('') +
      '<rect x="238" y="62" width="24" height="18" rx="2" fill="var(--sc-paper)" stroke="var(--sc-ink)"/><path d="M243 68h14M243 73h10" stroke="var(--sc-ink)"/></g>';
  };

  S.winter = function () {
    var flakes = '';
    for (var i = 0; i < 26; i++) flakes += '<circle class="a-fall" style="animation-delay:' + ((i * 0.37) % 4).toFixed(2) + 's;animation-duration:' + (3 + (i % 4)).toFixed(1) + 's" cx="' + ((i * 47) % 320) + '" cy="-6" r="' + (1.5 + (i % 3)) + '" fill="#fff"/>';
    return '<rect width="320" height="160" fill="var(--sc-night)"/>' + building(40, 24, 70, 112, true) + building(116, 50, 46, 86, false) + ground(136, '#e8eef2') +
      pylon(230, 136) + '<path d="M196 84l-10 6" stroke="#e63946" stroke-width="2"/>' +
      '<g transform="translate(266 78)"><rect width="30" height="54" rx="4" fill="var(--sc-ink)"/><rect x="10" y="-5" width="10" height="6" rx="1" fill="var(--sc-ink)"/>' +
      [0, 1, 2, 3].map(function (j) { return '<rect class="a-charge" style="animation-delay:' + (j * 0.4) + 's" x="5" y="' + (42 - j * 12) + '" width="20" height="9" rx="1.5" fill="var(--fam)"/>'; }).join('') + '</g>' + flakes;
  };

  S.fax = function () {
    return sky() + ground(132) +
      '<g transform="translate(40 66)"><rect width="110" height="56" rx="6" fill="var(--sc-mass)"/><rect x="10" y="10" width="50" height="14" rx="2" fill="var(--sc-screen)"/>' +
      [0, 1, 2].map(function (i) { return '<rect x="' + (70 + i * 12) + '" y="12" width="8" height="8" rx="2" fill="var(--sc-ink)"/>'; }).join('') +
      '<rect x="20" y="-6" width="70" height="8" fill="var(--sc-ink)"/><g class="a-print"><rect x="26" y="-38" width="58" height="40" fill="var(--sc-paper)" stroke="var(--sc-ink)"/><path d="M34 -28h40M34 -20h30M34 -12h36" stroke="var(--sc-ink)" opacity=".5"/></g></g>' +
      '<g transform="translate(190 24)">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return '<rect class="a-stack" style="animation-delay:' + (i * 0.2) + 's" x="' + (i % 2 * 3) + '" y="' + (98 - i * 10) + '" width="72" height="9" fill="var(--sc-paper)" stroke="var(--sc-ink)" stroke-width="1"/>'; }).join('') + '</g>' +
      '<g transform="translate(276 64)"><g class="a-stamp"><rect x="-8" y="0" width="16" height="22" rx="3" fill="var(--sc-ink)"/><rect x="-16" y="22" width="32" height="10" rx="2" fill="var(--fam)"/></g></g>';
  };

  S.plane = function () {
    return sky() + cloud(200, 24, .9) + cloud(40, 50, .7) + ground(132) +
      '<g class="a-flyacross"><path d="M0 0l38 -4 16 -14h8l-8 16 22 -2 8 -8h6l-4 12 4 12h-6l-8-8-22-2 8 16h-8L38 4z" fill="var(--sc-ink)"/></g>' +
      '<g transform="translate(40 76)"><rect width="110" height="44" rx="22" fill="var(--sc-ink)"/><rect x="6" y="6" width="98" height="32" rx="16" fill="var(--sc-glass)"/>' +
      '<path d="M16 30l16-8 16 4 16-12 16 6 16-10" stroke="var(--fam)" stroke-width="2.5" fill="none"/><rect x="50" y="44" width="10" height="12" fill="var(--sc-ink)"/></g>' +
      '<g transform="translate(220 74)"><rect width="64" height="58" rx="4" fill="var(--sc-paper)" stroke="var(--sc-ink)" stroke-width="1.5"/><rect width="64" height="14" rx="4" fill="var(--fam)"/>' +
      '<g class="a-flip" style="transform-origin:32px 14px"><rect y="14" width="64" height="44" fill="var(--sc-paper)" stroke="var(--sc-ink)" stroke-width="1"/><text x="32" y="44" text-anchor="middle" font-size="18" font-weight="700" fill="var(--sc-ink)" font-family="sans-serif">?</text></g></g>';
  };

  S.fridge = function () {
    return sky() + ground(136) +
      '<g transform="translate(40 18)"><rect width="96" height="118" rx="8" fill="var(--sc-paper)" stroke="var(--sc-ink)" stroke-width="2"/><path d="M0 44h96" stroke="var(--sc-ink)" stroke-width="2"/><rect x="80" y="14" width="5" height="20" rx="2" fill="var(--sc-ink)"/><rect x="80" y="54" width="5" height="30" rx="2" fill="var(--sc-ink)"/>' +
      '<g class="a-swapA"><path d="M30 80l14-8v16zM30 80l-14-8v16zM30 80v-16M30 80v16" stroke="#4ea8de" stroke-width="3" fill="none"/></g>' +
      '<g class="a-swapB"><path d="M30 98c-10 0-14-8-10-16 2 4 6 4 6 0 0-6 4-10 8-12-2 6 6 8 6 16 0 8-4 12-10 12z" fill="#e63946"/></g></g>' +
      '<g transform="translate(154 36)"><rect x="-4" width="10" height="70" rx="5" fill="var(--sc-paper)" stroke="var(--sc-ink)" stroke-width="1.5"/><circle cx="1" cy="76" r="9" fill="#e63946"/><rect class="a-thermo" x="-1" y="10" width="4" height="62" fill="#e63946"/></g>' +
      cloud(232, 14, 1) + '<path class="a-dash" d="M252 46 C240 70 236 80 220 92" stroke="#e63946" stroke-width="2.5" stroke-dasharray="6 5" fill="none"/>' +
      '<g transform="translate(200 84)"><g class="a-pop"><path d="M0 6l16 -7 16 7v12c0 10-7 15-16 19-9-4-16-9-16-19z" fill="var(--fam)"/><path d="M9 18h14" stroke="#fff" stroke-width="3"/></g></g>';
  };

  S.suitcase = function () {
    return sky() + ground(132) +
      '<g transform="translate(240 30)"><rect width="56" height="102" fill="var(--sc-mass)"/><rect x="6" y="6" width="44" height="96" fill="var(--sc-sky)"/><path d="M50 6 L70 14 V108 L50 102z" fill="var(--sc-ink)"/></g>' +
      '<g class="a-walk"><g transform="translate(60 72)"><rect width="74" height="54" rx="8" fill="var(--fam)"/><rect x="24" y="-12" width="26" height="14" rx="5" fill="none" stroke="var(--sc-ink)" stroke-width="4"/><path d="M14 0v54M60 0v54" stroke="var(--sc-ink)" stroke-width="3" opacity=".35"/><circle cx="14" cy="58" r="5" fill="var(--sc-ink)"/><circle cx="60" cy="58" r="5" fill="var(--sc-ink)"/></g></g>' +
      [0, 1, 2].map(function (i) { return '<ellipse class="a-coin" style="animation-delay:' + i * .5 + 's" cx="' + (100 + i * 22) + '" cy="40" rx="8" ry="8" fill="#f2c14e" stroke="#c99a2e" stroke-width="2"/>'; }).join('') +
      '<g transform="translate(160 16)"><path d="M0 0h46l8 12-8 12H0z" fill="var(--sc-paper)" stroke="var(--sc-ink)"/><text x="22" y="17" text-anchor="middle" font-size="12" font-weight="700" fill="var(--sc-ink)" font-family="sans-serif">26%</text></g>';
  };

  S.datacenter = function () {
    var racks = '';
    for (var r = 0; r < 3; r++) {
      racks += '<g transform="translate(' + (24 + r * 52) + ' 34)"><rect width="44" height="98" rx="3" fill="var(--sc-ink)"/>';
      for (var i = 0; i < 8; i++) racks += '<rect x="5" y="' + (6 + i * 11.5) + '" width="34" height="8" rx="1.5" fill="var(--sc-mass)"/><circle class="a-led" style="animation-delay:' + (((r * 8 + i) * 0.23) % 1.6).toFixed(2) + 's" cx="33" cy="' + (10 + i * 11.5) + '" r="1.8" fill="' + ((r + i) % 3 ? '#52b788' : 'var(--fam)') + '"/>';
      racks += '</g>';
    }
    return sky() + ground(132) + racks + pylon(206, 132) + pylon(262, 132) +
      '<path d="M196 82 C220 76 236 76 262 80 M282 80 C296 82 306 86 330 90" stroke="var(--sc-ink)" stroke-width="1.5" fill="none"/>' +
      '<g class="a-flow">' + [0, 1, 2].map(function (i) { return '<path d="M' + (214 + i * 22) + ' 70l-5 8h5l-3 8 8-10h-5l3-6z" fill="var(--fam)"/>'; }).join('') + '</g>' +
      '<g transform="translate(286 104)"><path d="M0 28V12L14 2l14 10v16z" fill="var(--sc-mass)"/><rect x="10" y="16" width="8" height="12" fill="var(--sc-light)"/></g>';
  };

  A.SCENES = Object.keys(S);
  A.scene = function (id, famId) {
    var f = S[id];
    if (!f) return '';
    return '<svg class="scene" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" style="--fam:var(--fam-' + (famId || 1) + ')">' + f() + '</svg>';
  };

  /* Play only what's on screen */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.target.classList.toggle('is-live', e.isIntersecting); });
  }, { rootMargin: '40px' }) : null;
  A.observeScenes = function (root) {
    (root || document).querySelectorAll('.scene').forEach(function (s) {
      if (io) io.observe(s); else s.classList.add('is-live');
    });
  };
})();
