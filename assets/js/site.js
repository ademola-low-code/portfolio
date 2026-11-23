(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- scroll reveal ---- */
  var els = document.querySelectorAll('.rv');
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(function (e) { e.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var sibs = Array.prototype.filter.call(en.target.parentNode.children, function (c) {
          return c.classList && c.classList.contains('rv');
        });
        var i = sibs.indexOf(en.target);
        en.target.style.transitionDelay = (i > 0 ? Math.min(i, 6) * 80 : 0) + 'ms';
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---- hero entrance ---- */
  if (!reduce) {
    document.querySelectorAll('.hero .rv').forEach(function (e, i) {
      setTimeout(function () { e.classList.add('in'); }, 120 + i * 110);
    });
  }

  /* ---- rotating headline ---- */
  var rot = document.getElementById('rot');
  var words = ['build AI agents', 'automate workflows', 'wire up your apps', 'ship automations', 'kill manual work'];
  var wi = 0;
  if (rot && !reduce) {
    setInterval(function () {
      rot.classList.add('out');
      setTimeout(function () {
        wi = (wi + 1) % words.length;
        rot.textContent = words[wi];
        rot.classList.remove('out');
      }, 400);
    }, 3000);
  }

  /* ---- sticky nav ---- */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('stuck', window.scrollY > 24); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- mobile menu ---- */
  var btn = document.getElementById('menubtn'), links = document.getElementById('navlinks');
  if (btn && links) {
    btn.addEventListener('click', function () {
      links.classList.toggle('show');
      btn.classList.toggle('open');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { links.classList.remove('show'); btn.classList.remove('open'); }
    });
  }
})();
