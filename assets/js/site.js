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

  /* ---- interactive hero workflow diagram ---- */
  var FLOWS = [
    { name: 'hotel_booking_agent.workflow', tab: 'Hotel booking', live: 'LIVE',
      cap: 'Guests book, pay and get confirmed inside WhatsApp — <b>delivered in under 24 hours</b>.',
      nodes: [
        ['WhatsApp', 'trigger: message in', 'Guest messages the hotel on the channel they already use.'],
        ['AI Agent', 'gpt-4o + memory', 'One multilingual agent holds the conversation and decides which tool to call.'],
        ['check_rooms', 'google sheets', 'Reads live availability before promising anything.'],
        ['book_room', 'id + receipt AI', 'Creates the booking, generates an ID, verifies the payment receipt with Vision AI.'],
        ['Reply', 'guest confirmed', 'Confirmation goes back in the same chat, in the guest\u2019s language.']
      ] },
    { name: 'elara_spa_concierge.workflow', tab: 'Spa concierge', live: 'LIVE',
      cap: 'Book, reschedule or cancel a spa session by conversation — <b>no staff back-and-forth</b>.',
      nodes: [
        ['WhatsApp', 'guest reply', 'Guest replies to the welcome message their package triggered.'],
        ['Spa Agent', 'tools + memory', 'Understands the request and checks it against the rules before acting.'],
        ['read_capacity', 'max 5 / session', 'Counts who is already booked so a session never overfills.'],
        ['book_session', 'validates stay', 'Only allows dates inside the guest\u2019s actual stay.'],
        ['Confirm', 'slot locked in', 'Guest gets the confirmed time without anyone typing it.']
      ] },
    { name: 'stayease — 6 workflows', tab: 'StayEase QR', live: 'OWN BUILD',
      cap: 'Scan the QR in your room, tap what you need — <b>no app, no calls to reception</b>.',
      nodes: [
        ['QR Scan', 'in-room code', 'Guest scans the fixed QR code in the room.'],
        ['Unlock', '4-char code', 'Validates the code emailed at check-in. Locks after three wrong tries.'],
        ['save_request', 'sheet + history', 'Every request and every change is written down, nothing deleted.'],
        ['notify_staff', 'live dashboard', 'Staff see it instantly and claim it.'],
        ['Track', 'received → done', 'Guest watches the status move in real time.']
      ] },
    { name: 'pe-ras_patient_engagement.workflow', tab: 'Clinic reminders', live: 'LIVE',
      cap: 'Reminders, no-show detection and daily reports — <b>frees 12+ staff hours a week</b>.',
      nodes: [
        ['Schedule', 'every 30 min', 'Checks which appointments are coming up.'],
        ['Reminder Engine', '24h + 2h rules', 'Works out who needs reminding and on which channel.'],
        ['send_reminder', 'email · sms · wa', 'Sends on whichever channel the patient actually uses.'],
        ['flag_noshow', 'end of day', 'Catches no-shows and re-engages them automatically.'],
        ['Report', 'daily to staff', 'The morning summary lands in the team inbox.']
      ] },
    { name: 'invoice_engine.workflow', tab: 'Invoicing', live: 'LIVE',
      cap: 'Branded invoices out, reminders chased — <b>zero late invoices in 5 months</b>.',
      nodes: [
        ['Job Done', 'form submitted', 'Triggered the moment work is marked complete.'],
        ['AI Writer', 'thank-you note', 'Writes a short personal note so the invoice is not cold.'],
        ['build_pdf', 'branded template', 'Generates a numbered, branded PDF invoice.'],
        ['due_reminder', 'before deadline', 'Chases the payment before it is late, not after.'],
        ['Send', 'emailed + logged', 'Delivered to the client and filed in the sheet.']
      ] },
    { name: 'twilio_sms_to_email.workflow', tab: 'SMS to email', live: 'LIVE',
      cap: 'Customer photos texted in, forwarded with attachments intact — <b>zero missed images</b>.',
      nodes: [
        ['SMS In', 'twilio webhook', 'Customer texts a photo to the business number.'],
        ['Check Media', 'has attachment?', 'Splits messages with media from plain text.'],
        ['forward_media', 'with attachments', 'Sends the images on so nothing is lost.'],
        ['forward_text', 'plain message', 'Plain texts take the simpler path.'],
        ['Inbox', 'team notified', 'Everything lands in the shared inbox.']
      ] }
  ];

  var flowBody = document.getElementById('flowBody');
  if (flowBody) {
    var fName = document.getElementById('flowName');
    var fLive = document.getElementById('flowLive');
    var fCap  = document.getElementById('flowCap');
    var fTabs = document.getElementById('flowTabs');
    var nodes = Array.prototype.slice.call(flowBody.querySelectorAll('.node'));
    var cur = 0, timer = null, pinned = false;

    function paint(i) {
      var f = FLOWS[i];
      fName.textContent = f.name;
      fLive.textContent = f.live;
      fCap.innerHTML = f.cap;
      f.nodes.forEach(function (n, k) {
        document.getElementById('n' + k).textContent = n[0];
        document.getElementById('n' + k + 's').textContent = n[1];
      });
      nodes.forEach(function (n) { n.classList.remove('sel'); });
      Array.prototype.forEach.call(fTabs.children, function (b, k) { b.classList.toggle('on', k === i); });
      cur = i;
    }

    function show(i) {
      if (reduce) { paint(i); return; }
      flowBody.classList.add('swap');
      setTimeout(function () { paint(i); flowBody.classList.remove('swap'); }, 330);
    }

    function startAuto() {
      if (reduce || pinned) return;
      clearInterval(timer);
      timer = setInterval(function () { show((cur + 1) % FLOWS.length); }, 6000);
    }

    FLOWS.forEach(function (f, i) {
      var b = document.createElement('button');
      b.className = 'flow-tab' + (i === 0 ? ' on' : '');
      b.type = 'button';
      b.textContent = f.tab;
      b.addEventListener('click', function () {
        pinned = true; clearInterval(timer); show(i);
      });
      fTabs.appendChild(b);
    });

    // tap or hover a node to read what it does
    nodes.forEach(function (g) {
      var idx = +g.dataset.n;
      var describe = function () {
        clearInterval(timer);
        nodes.forEach(function (n) { n.classList.remove('sel'); });
        g.classList.add('sel');
        fCap.innerHTML = '<b>' + FLOWS[cur].nodes[idx][0] + '</b> &nbsp;·&nbsp; ' + FLOWS[cur].nodes[idx][2];
      };
      var restore = function () {
        g.classList.remove('sel');
        fCap.innerHTML = FLOWS[cur].cap;
        startAuto();
      };
      g.addEventListener('mouseenter', describe);
      g.addEventListener('mouseleave', restore);
      g.addEventListener('focus', describe);
      g.addEventListener('blur', restore);
      g.addEventListener('click', function (e) { e.preventDefault(); pinned = true; describe(); });
    });

    paint(0);
    startAuto();
  }

  /* ---- floating pill nav: highlight the section in view ---- */
  var pillLinks = document.querySelectorAll('.pill a[data-sec]');
  if (pillLinks.length && 'IntersectionObserver' in window) {
    var secs = [];
    pillLinks.forEach(function (a) {
      var id = a.getAttribute('data-sec');
      var el = document.getElementById(id);
      if (el) secs.push({ el: el, link: a });
    });
    if (secs.length) {
      var pio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          pillLinks.forEach(function (a) { a.classList.remove('on'); });
          var hit = secs.find(function (s) { return s.el === en.target; });
          if (hit) hit.link.classList.add('on');
        });
      }, { rootMargin: '-45% 0px -45% 0px' });
      secs.forEach(function (s) { pio.observe(s.el); });
    }
  }
})();
