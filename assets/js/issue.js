/* Atlas — issue page ("המשלוח השבועי") */
(function () {
  'use strict';
  var A = window.Atlas;
  var issue = document.body.getAttribute('data-issue');
  function run() {
    var list = (window.ATLAS_PINS && window.ATLAS_PINS[issue]) || [];
    // related pins may live in other issues: load all, then render
    A.loadIssues('../', function () {
      var pinById = {};
      A.allPins().forEach(function (p) { pinById[p.id] = p; });
      var groups = [['A', 'עדיפות A'], ['B', 'עדיפות B'], ['C', 'עדיפות C']];
      var html = '';
      groups.forEach(function (g) {
        var ps = list.filter(function (p) { return p.priority === g[0]; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
        if (!ps.length) return;
        html += '<section class="issue-group" aria-labelledby="g-' + g[0] + '"><h2 id="g-' + g[0] + '">' + g[1] + ' <span class="badge num">' + ps.length + '</span></h2><div class="issue-cards">' +
          ps.map(function (p) { return A.renderCard(p, { pinById: pinById, base: '../', headingTag: 'h3' }); }).join('') + '</div></section>';
      });
      document.getElementById('cards').innerHTML = html || '<p>אין נעצים בגיליון הזה.</p>';
      var cc = {}; list.forEach(function (p) { cc[p.place.country] = (cc[p.place.country] || 0) + 1; });
      document.getElementById('issue-toc').innerHTML = list.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).map(function (p) {
        return '<a class="chip" href="#pin-' + p.id + '"><span class="dot' + (p.indirect ? ' dot--ring' : '') + '" style="--fam:var(--fam-' + A.famOf(p) + ')"></span>' + A.esc(p.place.country + (cc[p.place.country] > 1 && p.place.city ? ' · ' + p.place.city : '')) + '</a>';
      }).join('');
      if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
      A.analytics();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
