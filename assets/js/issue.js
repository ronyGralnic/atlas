/* Atlas — issue page ("המשלוח השבועי") */
(function () {
  'use strict';
  var A = window.Atlas;
  var issue = document.body.getAttribute('data-issue');
  var PR = { A: 0, B: 1, C: 2 };
  function run() {
    A.loadIssues('../', function () {
      var list = ((window.ATLAS_PINS && window.ATLAS_PINS[issue]) || []).slice()
        .sort(function (a, b) { return PR[a.priority] - PR[b.priority] || (a.id < b.id ? -1 : 1); });
      var pinById = {};
      A.allPins().forEach(function (p) { pinById[p.id] = p; });
      document.getElementById('faces').innerHTML = list.slice(0, 10).map(function (p) {
        return '<a href="#pin-' + p.id + '" title="' + A.esc(p.persona.name) + '">' + A.avatar(p.persona.avatar, 44) + '</a>';
      }).join('');
      document.getElementById('cards').innerHTML = '<div class="issue-cards">' +
        list.map(function (p) { return A.renderCard(p, { pinById: pinById, headingTag: 'h2' }); }).join('') + '</div>';
      document.getElementById('issue-toc').innerHTML = list.map(function (p) {
        return '<a class="chip" href="#pin-' + p.id + '">' + A.flagPlace(p) + A.esc(p.place.country) + ': ' + A.esc(p.title_he) + '</a>';
      }).join('');
      A.observeScenes(document);
      if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
      A.analytics();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
