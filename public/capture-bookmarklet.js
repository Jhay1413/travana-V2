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
  var VERSION = 'v11';
  var MAX_TEXT = 400000;
  var MAX_IMAGES = 300;
  var MAX_HEADINGS = 12;
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

    // A flight-details panel that IS in the DOM but is closed — the common case,
    // because agents capture without opening "Compare airport, dates & prices"
    // first and modalText() only sees what is actually rendered. deepText reads
    // hidden nodes, which is the whole reason this fallback exists, so the panel
    // is found either way. Anchored on the outbound heading and only accepted
    // when a "Depart:" follows inside the window, which is precisely the shape
    // the server's modal parser consumes — a heading alone is not enough.
    var out = /\b(?:going out|going there)\b/i.exec(all);
    if (out) {
      var region = all.slice(out.index, out.index + 6000);
      if (/Depart:/i.test(region)) return region;
    }

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

  // The page's own headings, in document order.
  //
  // The deal's headline — the hotel name, or the marketing strapline portals
  // print beside it — is always an <h1>/<h2>, but in body innerText it is just
  // another line among thousands with nothing around it to anchor a regex to.
  // A spec rule reading THIS short ordered list can pick "the first heading" or
  // "the second heading" positionally, which is stable, instead of trying to
  // pattern-match arbitrary marketing prose out of the whole page.
  //
  // Kept deliberately small and text-only: headings are for identifying the
  // deal, not for carrying content.
  function headings() {
    var out = [];
    var seen = {};
    var nodes = document.querySelectorAll('h1, h2');
    for (var i = 0; i < nodes.length && out.length < MAX_HEADINGS; i++) {
      // textContent, not innerText: a heading inside a collapsed or not-yet-
      // scrolled section still identifies the deal, and reading it costs nothing.
      var t = (nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 200 || seen[t]) continue;
      seen[t] = 1;
      out.push(t);
    }
    return out;
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

  // The widest URL an <img> offers.
  //
  // `currentSrc` is whatever the browser chose FOR THIS VIEWPORT, which on a
  // laptop is routinely a mid-size variant — easyJet's gallery advertises eight
  // widths from 640w to 3840w and hands `currentSrc` the 1920. The quote keeps
  // whichever URL we capture, so reading only currentSrc shipped a needlessly
  // small photo when a larger one was named right there in `srcset`.
  //
  // The server still picks the widest among everything it receives; this makes
  // sure the widest is actually in the set.
  // A slide that hasn't been displayed yet often has NO src at all — its real
  // URL is parked in a data attribute until the carousel reaches it. Jet2's
  // slick gallery is the clearest case: every one of its slides carries
  // data-lazy="https://media.jet2.com/…" from first render, so the whole gallery
  // is readable without displaying a single slide.
  //
  // This is worth checking before any of the load-forcing tricks: when a portal
  // parks its URLs like this there is nothing to force, and reading an attribute
  // beats making thirty-five network requests.
  var LAZY_ATTRS = ['data-lazy', 'data-src', 'data-original', 'data-lazy-src', 'data-ofi-src'];

  function widestSrc(img) {
    // 1. srcset, and its lazy twin — the widest candidate advertised.
    var best = '';
    var bestWidth = 0;
    var sets = [img.getAttribute('srcset') || '', img.getAttribute('data-srcset') || ''];
    for (var i = 0; i < sets.length; i++) {
      var parts = sets[i].split(',');
      for (var s = 0; s < parts.length; s++) {
        var bits = parts[s].trim().split(/\s+/);
        if (!bits[0]) continue;
        var m = /^(\d{2,5})w$/.exec(bits[1] || '');
        var width = m ? Number(m[1]) : 0;
        if (width > bestWidth) {
          bestWidth = width;
          best = bits[0];
        }
      }
    }
    if (bestWidth > 0) return best;

    // 2. Whatever actually loaded.
    var direct = img.currentSrc || img.src || img.getAttribute('src') || '';
    if (direct) return direct;

    // 3. Nothing loaded — take the URL the lazy loader is holding for later.
    for (var a = 0; a < LAZY_ATTRS.length; a++) {
      var parked = img.getAttribute(LAZY_ATTRS[a]);
      if (parked) return parked;
    }
    return '';
  }

  // Where an image SITS in the page, as a flat bag of the class names and
  // data-tids of its ancestors.
  //
  // A hotel page shows several galleries from the same image host: the property
  // carousel, and one per room card. Picking the gallery by URL or by host
  // therefore can't tell a room photo from a hotel photo — they differ only by
  // position in the DOM. The spec's `imageContainerIncludes` matches against
  // this string ("hotel-main-view", say) so the supplier-specific bit stays in
  // config and this stays generic.
  function imageContext(img) {
    var parts = [];
    var el = img.parentElement;
    for (var d = 0; el && d < 8 && el !== document.body; d++) {
      var tid = el.getAttribute('data-tid');
      if (tid) parts.push(tid);
      // SVG elements expose className as an object, not a string.
      var cls = el.className;
      if (typeof cls === 'string' && cls) parts.push(cls);
      el = el.parentElement;
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  }

  // ── Lazy galleries ─────────────────────────────────────────────────────────
  //
  // A property gallery is a carousel: all 35 slides exist in the DOM, but only
  // the visible one holds a real src — the rest show "image coming soon" until
  // their IntersectionObserver fires. Capturing as-is yielded ONE photo out of
  // thirty-five.
  //
  // Clicking through every slide would take 35 × ~350ms of animation, well past
  // the few seconds a browser keeps a click's "transient activation" alive — and
  // without that, writing to the clipboard at the end is refused. So instead of
  // navigating, FLATTEN the carousel: drop the translate that parks slides
  // off-screen, let the track wrap, and unclip its ancestors. Every slide then
  // occupies layout space at once, all the observers fire together, and the
  // images load in parallel — about a second, one click, no navigation.
  //
  // Measured on a TUI hotel page: 1 slide loaded before, 35 after.
  //
  // Only inline styles are touched, and the exact previous cssText is restored
  // before the user sees anything, so the page is left as it was found.
  function unfurlGalleries() {
    var undone = [];
    function force(el, css) {
      undone.push([el, el.style.cssText]);
      for (var key in css) el.style.setProperty(key, css[key], 'important');
    }
    // The moving track: whatever is translated to park slides out of view.
    var tracks = document.querySelectorAll(
      '[class*="mainView"],[class*="MainView"],[class*="image-gallery-slides"],[class*="slides"],[class*="track"],[class*="Track"]',
    );
    for (var t = 0; t < tracks.length; t++) {
      force(tracks[t], { transform: 'none', width: '100%', display: 'flex', 'flex-wrap': 'wrap' });
    }
    // The frame that clips it, plus each slide's own offset.
    var boxes = document.querySelectorAll(
      '[class*="gallery"],[class*="Gallery"],[class*="Galleries"],[class*="slider"],[class*="Slider"],[class*="carousel"],[class*="Carousel"],[class*="swipe"]',
    );
    for (var b = 0; b < boxes.length; b++) force(boxes[b], { overflow: 'visible' });
    var slides = document.querySelectorAll('[class*="image-gallery-slide"],[class*="Slide"]');
    for (var s = 0; s < slides.length; s++) force(slides[s], { transform: 'none', position: 'relative' });

    return function restore() {
      for (var i = 0; i < undone.length; i++) undone[i][0].style.cssText = undone[i][1];
    };
  }

  // Poll until the number of real image sources stops growing — the gallery has
  // finished loading — or the budget runs out. Bounded tightly on purpose: the
  // clipboard write at the end still has to happen inside the click's activation
  // window, so a slow page yields a partial gallery rather than no capture.
  function whenImagesSettle(budgetMs, done) {
    var startedAt = Date.now();
    var previous = -1;
    var stableTicks = 0;
    var timer = setInterval(function () {
      var count = 0;
      for (var i = 0; i < document.images.length; i++) {
        var s = document.images[i].currentSrc || document.images[i].src || '';
        if (s && s.indexOf('data:') !== 0) count++;
      }
      stableTicks = count === previous ? stableTicks + 1 : 0;
      previous = count;
      if (stableTicks >= 2 || Date.now() - startedAt > budgetMs) {
        clearInterval(timer);
        done();
      }
    }, 200);
  }

  function collectImages() {
    var images = [];
    var imageContexts = [];
    var seen = {};
    var imgs = document.images;
    for (var k = 0; k < imgs.length && images.length < MAX_IMAGES; k++) {
      var src = widestSrc(imgs[k]);
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
      // Index-aligned with `images` — the server ignores the whole array if the
      // lengths ever disagree, so a mismatch degrades rather than mislabels.
      imageContexts.push(imageContext(imgs[k]));
    }
    return { images: images, imageContexts: imageContexts };
  }

  var restoreGalleries = unfurlGalleries();
  whenImagesSettle(2000, function () {
    var collected = collectImages();
    // Put the page back BEFORE anything is shown, so the flattened carousel is
    // never something the user has to look at or undo themselves.
    restoreGalleries();
    finish(collected.images, collected.imageContexts);
  });

  function finish(images, imageContexts) {
  var payload = {
    url: location.href,
    title: document.title,
    text: (document.body ? document.body.innerText || '' : '').slice(0, MAX_TEXT),
    images: images,
    // Index-aligned with `images`: where each one sits in the page, so a spec
    // can keep the property gallery and drop the room-card carousels.
    imageContexts: imageContexts,
    // Ordered h1/h2 text — the deal's headline, addressable by position.
    headings: headings(),
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
        ' KB).\n\nImages: ' +
        images.length +
        '\nBooking JSON: ' +
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
  }
})();
