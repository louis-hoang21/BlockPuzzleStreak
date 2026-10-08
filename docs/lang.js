(function () {
  var html = document.documentElement;
  function pick() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'vi') return q;
    try { var s = localStorage.getItem('lang'); if (s === 'en' || s === 'vi') return s; } catch (e) {}
    return (navigator.language || '').toLowerCase().indexOf('vi') === 0 ? 'vi' : 'en';
  }
  function apply(l) {
    html.setAttribute('data-lang', l);
    html.setAttribute('lang', l);
    var t = html.getAttribute('data-title-' + l);
    if (t) document.title = t;
    document.querySelectorAll('.switch button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-set') === l ? 'true' : 'false');
    });
  }
  apply(pick());
  document.addEventListener('DOMContentLoaded', function () {
    apply(html.getAttribute('data-lang'));
    document.querySelectorAll('.switch button').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = b.getAttribute('data-set');
        try { localStorage.setItem('lang', l); } catch (e) {}
        apply(l);
      });
    });
  });
})();
