/*
 * Travana "Capture deal page" bookmarklet — source.
 *
 * The user is already logged into the supplier in their OWN browser, so this
 * runs with a real session in a real browser: no credentials on our servers, no
 * proxy, no bot protection to defeat. It copies the rendered page to the
 * clipboard; the user pastes it into Travana's "Capture from supplier page"
 * dialog, which posts it to POST /api/v2/scrapers/import-page.
 *
 * Clipboard (rather than a direct cross-origin POST) keeps this dependency-free:
 * no CORS config, no SameSite=None cookies, no extension to install or review.
 *
 * To rebuild the installable one-liner: npx tsx scripts/build-bookmarklet.ts
 */
(function () {
  // Bump on every change. Shown in the capture alert so it's obvious which
  // version is actually installed in the bookmarks bar — an old bookmarklet
  // silently producing old-shaped captures is otherwise impossible to spot.
  var VERSION = 'v5';
  var MAX_TEXT = 400000;
  var MAX_IMAGES = 300;
  // Booking records are big. Scan generously and only cap what we actually send.
  var MAX_JSON = 2000000;

  function visible(el) {
    return !!el && el.offsetParent !== null;
  }

  // Every text node under `root`, one per line, reaching places
  // document.body.innerText cannot:
  //
  //   • HIDDEN nodes — innerText skips anything not rendered, so a collapsed
  //     accordion reads as empty.
  //   • SHADOW DOM — portals increasingly render sections as web components
  //     (TUI's flights are a <tui-alternative-transport-mfe> micro-frontend).
  //     Their content lives in a separate tree that innerText and a plain
  //     TreeWalker both stop at, so the section looks entirely absent.
  //
  // One line per text node reproduces the stacked shape the server's parsers
  // expect. Shadow roots opened with mode:"closed" are unreachable by any
  // script — nothing can be done about those from here.
  function deepText(root) {
    var out = [];
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        var t = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (t) out.push(t);
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return; // element / fragment
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(node.nodeName)) return;
      if (node.shadowRoot) walk(node.shadowRoot); // pierce open shadow roots
      for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
    }
    walk(root);
    return out.join('\n');
  }

  // Flight itinerary that innerText couldn't see. Locates the flights region in
  // the deep text and returns a bounded slice of it.
  function hiddenFlightsText() {
    var all = deepText(document.body);
    var i = all.search(/\byour flights\b|\bflights?\s+(?:details|available)\b/i);
    if (i < 0) {
      var m = /\b(?:OUT|RTN|OUTBOUND|INBOUND)\b[\s\S]{0,120}?\d{1,2}:\d{2}/.exec(all);
      i = m ? m.index : -1;
    }
    return i < 0 ? '' : all.slice(i, i + 6000);
  }

  // Operators embed the whole booking record as JSON in a <script> tag — flight
  // numbers, airports, dates and times in machine-readable form. That beats
  // reading the rendered page: no shadow DOM, no collapsed panels, no regexes
  // over prose. Scripts are ranked and the best parseable blob is sent as
  // apiJson, which the extraction spec can address with jsonPath.
  function bestScriptJson() {
    var scored = [];
    var scripts = document.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      var el = scripts[i];
      var body = el.textContent || '';
      if (body.length < 40 || body.length > MAX_JSON) continue;
      var type = (el.getAttribute('type') || '').toLowerCase();
      // The well-known names appear EITHER as the element's id/name OR as the
      // variable being assigned inside the script ("var jsonData = {…}"), so
      // both have to be searched — checking only the attribute misses the
      // common case entirely.
      var head = ((el.id || '') + ' ' + (el.getAttribute('name') || '') + ' ' + body.slice(0, 400)).toLowerCase();

      var score = 0;
      if (head.indexOf('jsondata') >= 0) score = 100;
      else if (head.indexOf('__next_data__') >= 0) score = 90;
      else if (head.indexOf('__initial_state__') >= 0 || head.indexOf('__preloaded_state__') >= 0) score = 85;
      else if (head.indexOf('datalayer') >= 0) score = 80;
      else if (type.indexOf('json') >= 0) score = 70;
      else if (/^\s*[[{]/.test(body)) score = 40; // bare JSON literal
      else if (/[[{]/.test(body)) score = 10; // some other assignment — last resort
      else continue;

      // Prefer blobs that actually look like a booking record.
      if (/"?flights?"?\s*[:=]|departureairport|arrivalairport|itinerary/i.test(body)) score += 30;
      scored.push({ score: score, body: body });
    }
    scored.sort(function (a, b) {
      return b.score - a.score || b.body.length - a.body.length;
    });

    for (var j = 0; j < scored.length && j < 12; j++) {
      var raw = scored[j].body.trim();
      // Tolerate "var x = {...};" / "window.__DATA__ = {...}" wrappers.
      var start = raw.search(/[[{]/);
      if (start < 0) continue;
      var end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
      if (end <= start) continue;
      try {
        var parsed = JSON.parse(raw.slice(start, end + 1));
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {
        /* not JSON after all — try the next candidate */
      }
    }
    return null;
  }

  // Text of an open flight-details / itinerary modal, if the user opened one —
  // real flight times usually live there rather than in the page's own text.
  function modalText() {
    var sels = ['[role="dialog"]', '[aria-modal="true"]', '[class*="modal"]', '[class*="Modal"]', '[class*="drawer"]'];
    var best = '';
    for (var i = 0; i < sels.length; i++) {
      var nodes = document.querySelectorAll(sels[i]);
      for (var j = 0; j < nodes.length; j++) {
        var m = nodes[j];
        if (!visible(m)) continue;
        var t = m.innerText || '';
        if (/Depart:|Going Out|Coming Back/i.test(t) && t.length > best.length) best = t;
      }
    }
    return best;
  }

  var images = [];
  var seen = {};
  var imgs = document.images;
  for (var k = 0; k < imgs.length && images.length < MAX_IMAGES; k++) {
    var src = imgs[k].currentSrc || imgs[k].src || imgs[k].getAttribute('src') || '';
    if (!src || src.indexOf('data:') === 0) continue;
    // Some galleries yield root-relative srcs; send absolute URLs so the server
    // never has to guess what they were relative to.
    try {
      src = new URL(src, location.href).href;
    } catch (e) {
      continue;
    }
    if (seen[src]) continue;
    seen[src] = 1;
    images.push(src);
  }

  var payload = {
    url: location.href,
    title: document.title,
    text: (document.body ? document.body.innerText || '' : '').slice(0, MAX_TEXT),
    images: images,
    // An open modal wins; otherwise fall back to the itinerary hidden inside a
    // collapsed panel.
    flightsText: modalText() || hiddenFlightsText(),
    // The operator's own booking JSON, when the page embeds one.
    apiJson: bestScriptJson(),
  };

  if (payload.text.trim().length < 200) {
    alert('Travana: this page has almost no text.\n\nOpen the DEAL page and let the price finish loading, then capture again.');
    return;
  }

  var json = JSON.stringify(payload);

  function done() {
    alert(
      'Travana ' +
        VERSION +
        ': deal page captured (' +
        Math.round(json.length / 1024) +
        ' KB).\n\nBooking JSON: ' +
        (payload.apiJson ? 'found' : 'none on this page') +
        '\nFlight text: ' +
        (payload.flightsText ? 'found' : 'not found') +
        '\n\nGo to the quote form → Capture from supplier page → paste.',
    );
  }
  function fallback() {
    // execCommand path for pages where the async clipboard API is blocked.
    var ta = document.createElement('textarea');
    ta.value = json;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    if (ok) done();
    else alert('Travana: could not copy automatically.\n\nCheck the browser console — the capture has been logged there for manual copying.') || console.log(json);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(json).then(done, fallback);
  } else {
    fallback();
  }
})();
