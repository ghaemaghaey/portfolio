/* ============================================================
   Ghaem Aghaei Aghdam — portfolio interactions
   1. blueprint crawl-graph (hero canvas, one orchestrated run)
   2. project index filtering
   3. section-aware nav
   4. clock + year
   ============================================================ */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 4. clock + year ─────────────────────────────────── */

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var clockEl = document.getElementById('clock');
  function tick() {
    if (!clockEl) return;
    clockEl.textContent = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit'
    });
  }
  tick();
  setInterval(tick, 30000);

  /* ── 2. project index filtering ──────────────────────── */

  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var rows = Array.prototype.slice.call(document.querySelectorAll('.row'));
  var countEl = document.getElementById('filter-count');

  function applyFilter(key) {
    var shown = 0;
    rows.forEach(function (row) {
      var match = key === 'all' || row.getAttribute('data-lang') === key;
      row.hidden = !match;
      if (match) shown++;
    });
    if (countEl) {
      countEl.textContent = shown + ' of ' + rows.length + ' shown';
    }
    chips.forEach(function (chip) {
      var on = chip.getAttribute('data-filter') === key;
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      applyFilter(chip.getAttribute('data-filter'));
    });
  });
  applyFilter('all');

  /* ── 3. section-aware nav ────────────────────────────── */

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.topnav a'));
  var targets = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && targets.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle(
            'is-active',
            a.getAttribute('href') === '#' + entry.target.id
          );
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* ── 1. crawl graph ──────────────────────────────────── */

  var canvas = document.getElementById('crawl');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var LINE  = 'rgba(246, 236, 227, ';   // untraversed structure (warm off-white)
  var EMBER = 'rgba(255, 106, 43, ';    // walked edges (ember orange)
  var LIGHT = 'rgba(255, 148, 85, ';    // reached nodes
  var GOLD  = 'rgba(232, 163, 61, ';    // the crawler itself

  var nodes = [];
  var edges = [];
  var order = [];      // edge indices in traversal order
  var visited = null;  // Uint8Array
  var dpr = 1, w = 0, h = 0;
  var startTime = 0;
  var rafId = null;
  var running = false;

  // deterministic pseudo-random so the drawing is stable per load
  var seed = 20260930;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  function build() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(rect.width, 1);
    h = Math.max(rect.height, 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    seed = 20260930;
    nodes = [];
    edges = [];

    var count = w < 700 ? 18 : w < 1200 ? 26 : 34;
    var minDist = Math.max(70, Math.min(w, h) / 9);

    var guard = 0;
    while (nodes.length < count && guard < 6000) {
      guard++;
      var x = 20 + rnd() * (w - 40);
      var y = 20 + rnd() * (h - 40);
      var ok = true;
      for (var i = 0; i < nodes.length; i++) {
        var dx = nodes[i].x - x, dy = nodes[i].y - y;
        if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
      }
      if (ok) nodes.push({ x: x, y: y });
    }

    // connect each node to its two nearest neighbours (undirected, deduped)
    var seen = {};
    for (var a = 0; a < nodes.length; a++) {
      var dists = [];
      for (var b = 0; b < nodes.length; b++) {
        if (a === b) continue;
        var ddx = nodes[a].x - nodes[b].x, ddy = nodes[a].y - nodes[b].y;
        dists.push({ i: b, d: ddx * ddx + ddy * ddy });
      }
      dists.sort(function (p, q) { return p.d - q.d; });
      for (var k = 0; k < Math.min(2, dists.length); k++) {
        var from = Math.min(a, dists[k].i), to = Math.max(a, dists[k].i);
        var key = from + '-' + to;
        if (!seen[key]) { seen[key] = true; edges.push({ a: from, b: to }); }
      }
    }

    // BFS from node 0 => edges in the order a crawler would walk them
    visited = new Uint8Array(nodes.length);
    var queue = [0];
    visited[0] = 1;
    order = [];
    var queued = {};
    queued[0] = 1;

    while (queue.length) {
      var cur = queue.shift();
      for (var e = 0; e < edges.length; e++) {
        var ed = edges[e];
        var other = -1;
        if (ed.a === cur && !visited[ed.b]) other = ed.b;
        if (ed.b === cur && !visited[ed.a]) other = ed.a;
        if (other === -1) continue;
        visited[other] = 1;
        if (!queued[other]) { queued[other] = 1; queue.push(other); }
        order.push(e);
      }
    }
    // any edge left over (disconnected pieces) goes at the end
    var inOrder = {};
    order.forEach(function (i) { inOrder[i] = true; });
    for (var rest = 0; rest < edges.length; rest++) {
      if (!inOrder[rest]) order.push(rest);
    }
  }

  function draw(progress) {
    ctx.clearRect(0, 0, w, h);

    var total = order.length || 1;
    var head = progress * total;          // fractional edge position
    var headIndex = Math.min(Math.floor(head), total - 1);
    var headT = head - Math.floor(head);

    // edges: dashed while untraversed, solid once walked
    for (var i = 0; i < edges.length; i++) {
      var e = edges[order[i]] || edges[i];
      var A = nodes[e.a], B = nodes[e.b];
      if (!A || !B) continue;

      var walked = i < headIndex;
      var current = i === headIndex;

      ctx.setLineDash(walked || current ? [] : [3, 5]);
      ctx.lineWidth = walked ? 1.25 : 1;
      ctx.strokeStyle = (walked || current ? EMBER : LINE) + (walked ? '0.8' : '0.16') + ')';

      if (current) {
        var hx = A.x + (B.x - A.x) * headT;
        var hy = A.y + (B.y - A.y) * headT;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = LINE + '0.14)';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();

        // the crawler itself
        ctx.setLineDash([]);
        ctx.fillStyle = GOLD + '1)';
        ctx.beginPath();
        ctx.arc(hx, hy, 3.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // nodes
    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n];
      // node is reached when at least one of its edges has been walked
      var reached = false;
      for (var j = 0; j < Math.min(headIndex + 1, order.length); j++) {
        var edj = edges[order[j]];
        if (edj.a === n || edj.b === n) { reached = true; break; }
      }
      if (n === 0) reached = true;

      ctx.beginPath();
      ctx.arc(nd.x, nd.y, reached ? 3.6 : 2.4, 0, Math.PI * 2);
      if (reached) {
        ctx.shadowColor = EMBER + '0.9)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = LIGHT + '0.95)';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = LINE + '0.25)';
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      if (n === 0) {
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, 8 + Math.sin(progress * Math.PI * 6) * 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = GOLD + '0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // seed label: the crawl start point
    if (nodes[0]) {
      ctx.font = '600 10px Vazirmatn, sans-serif';
      ctx.fillStyle = LINE + '0.5)';
      ctx.fillText('seed', nodes[0].x + 12, nodes[0].y + 3);
    }
  }

  var DURATION = 5200;

  function frame(now) {
    if (!startTime) startTime = now;
    var p = Math.min((now - startTime) / DURATION, 1);
    // ease-out so the walk decelerates as the graph fills
    draw(1 - Math.pow(1 - p, 2));
    if (p < 1) {
      rafId = requestAnimationFrame(frame);
    } else {
      running = false;
      draw(1);
    }
  }

  function run() {
    if (reduceMotion) { draw(1); return; }
    if (rafId) cancelAnimationFrame(rafId);
    startTime = 0;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  function rebuild() {
    build();
    if (reduceMotion || !running) draw(1);
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuild, 180);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && rafId) { cancelAnimationFrame(rafId); rafId = null; running = false; }
    else if (!document.hidden && !rafId) { rebuild(); }
  });

  build();
  run();
})();
