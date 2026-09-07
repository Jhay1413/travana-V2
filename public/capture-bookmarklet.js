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
 * Two modes, chosen from a small on-page prompt when the bookmarklet is run:
 *   - Instant capture: the original one-click flow, unchanged.
 *   - Field picker: first asks which package type this supplier's pages are
 *     (Cruise / Package Holiday / Hot Tub Break) — a DECLARATION the server's
 *     interpreter trusts over its own field-based inference, which is what
 *     stopped Virgin Voyages' broken ship_name rule from silently importing a
 *     cruise as a package holiday. Then the agent arms a field ("sales_price"),
 *     then clicks the matching element on the page instead of the page's own
 *     link/button behaviour firing. Used when the page text alone is too
 *     ambiguous for the server to find a field reliably (e.g. three prices on
 *     the page and no way to tell which is the one that matters) — the agent
 *     points at the right one directly, and the server gets ground truth plus
 *     its context.
 *
 * To rebuild the installable one-liner: npx tsx scripts/build-bookmarklet.ts
 */
(function () {
  // Bump on every change. Shown in the capture alert so it's obvious which
  // version is actually installed in the bookmarks bar — an old bookmarklet
  // silently producing old-shaped captures is otherwise impossible to spot.
  var VERSION = 'v15';
  var MAX_TEXT = 400000;
  // deepText() walks hidden nodes and pierces shadow roots, so on a large page
  // it can be far bigger than `text` once every collapsed panel, inactive tab
  // and pre-rendered alternative is included. Capped the same way `text` is,
  // for the same reason: a huge page can't be allowed to blow the payload up.
  var MAX_DEEP_TEXT = 400000;
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
  //
  // Sent directly on the payload as its own `deepText` field (see
  // corePayload) as well as being used below by hiddenFlightsText().
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
  function hiddenFlightsText(all) {
    // corePayload() already walks the whole body once for the `deepText`
    // payload field and passes that result straight in here, so this only
    // re-walks when called on its own.
    if (typeof all !== 'string') all = deepText(document.body);

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

  // ── Collapsed disclosure UI ──────────────────────────────────────────────
  //
  // Real evidence: a Royal Caribbean checkout page was captured WITHOUT
  // opening its "View Ports" itinerary drawer. The entire day-by-day
  // Day/Port table was absent from `text` and the cruise imported with no
  // itinerary — silently. An earlier capture of the SAME page with the
  // drawer open had the full 8-day table. The content was in the DOM the
  // whole time: that capture's own `imageContexts` contained
  // "ItineraryImage_container__161xda70 RcgDrawer_content__8voltb4
  // RcgDrawer_container__8voltb1 Drawer_container__15el04i3
  // RcgDrawer_drawer__8voltb0" (an <img> inside the collapsed drawer was
  // captured, because querySelectorAll ignores visibility) and `headings`
  // contained "Itinerary" — but document.body.innerText excludes anything
  // not actually rendered, which is exactly what a collapsed drawer is.
  //
  // Follows unfurlGalleries()'s exact pattern: force inline styles with
  // setProperty(..., 'important'), record enough to undo it, return a
  // restore() closure. Styles alone aren't enough here though — <details>
  // and [hidden] are controlled by ATTRIBUTES, not CSS — so this also keeps
  // a parallel undo stack for attributes and restores both. Nothing is
  // clicked: clicking can navigate, submit or mutate a live booking, so this
  // only forces style/attribute state directly.
  function unfurlPanels() {
    var undoStyles = []; // [el, previous cssText] — same shape as unfurlGalleries' force()
    var undoAttrs = []; // [el, attrName, hadAttr, previousValue]

    function force(el, css) {
      undoStyles.push([el, el.style.cssText]);
      for (var key in css) el.style.setProperty(key, css[key], 'important');
    }
    function setAttr(el, name, value) {
      undoAttrs.push([el, name, el.hasAttribute(name), el.getAttribute(name)]);
      el.setAttribute(name, value);
    }
    function removeAttr(el, name) {
      undoAttrs.push([el, name, el.hasAttribute(name), el.getAttribute(name)]);
      el.removeAttribute(name);
    }

    // A whole unfurl failing must never block the capture, and must never
    // leave the page half-restored — so everything that MUTATES the page
    // lives inside this try, while restore() (built from whatever made it
    // into the undo stacks before the throw) is always returned and always
    // runs.
    try {
      // <details> — the platform's own disclosure widget. `open` is the one
      // attribute that actually controls rendering; no style forcing needed.
      var detailsNodes = document.querySelectorAll('details:not([open])');
      for (var d = 0; d < detailsNodes.length; d++) setAttr(detailsNodes[d], 'open', '');

      // [hidden] containers — but not native form controls, where `hidden`
      // is part of the element's own type/semantics rather than a
      // disclosure state some other control toggles.
      var SKIP_HIDDEN_TAGS = { INPUT: 1, SELECT: 1, TEXTAREA: 1, OPTION: 1, OPTGROUP: 1, TEMPLATE: 1, SCRIPT: 1, STYLE: 1, LINK: 1, META: 1 };
      var hiddenNodes = document.querySelectorAll('[hidden]');
      for (var h = 0; h < hiddenNodes.length; h++) {
        if (SKIP_HIDDEN_TAGS[hiddenNodes[h].tagName]) continue;
        removeAttr(hiddenNodes[h], 'hidden');
      }

      // aria-expanded="false" describes the TOGGLE, not itself — it's the
      // element named in aria-controls that's actually collapsed (this is
      // the shape RC's own "View Ports" button would take if it exposed
      // aria-controls). Force that target open; the button's own
      // aria-expanded is left alone since nothing reads text off the button.
      var expandable = document.querySelectorAll('[aria-expanded="false"]');
      for (var e = 0; e < expandable.length; e++) {
        var controlsAttr = expandable[e].getAttribute('aria-controls');
        if (!controlsAttr) continue;
        var ids = controlsAttr.split(/\s+/);
        for (var ci = 0; ci < ids.length; ci++) {
          var target = document.getElementById(ids[ci]);
          if (target) {
            force(target, { display: 'block', visibility: 'visible', height: 'auto', 'max-height': 'none', overflow: 'visible', opacity: '1' });
          }
        }
      }

      // Class-named drawers/accordions/collapses/expandables — the actual RC
      // itinerary panel matched THIS way: its class list ("RcgDrawer_content
      // …RcgDrawer_drawer…") carried no aria-expanded anywhere on its
      // ancestor chain, only a class name.
      var panelNodes = document.querySelectorAll(
        '[class*="Drawer"],[class*="drawer"],[class*="Accordion"],[class*="accordion"],[class*="Collapse"],[class*="collapse"],[class*="Expandable"],[class*="expandable"]',
      );
      for (var p = 0; p < panelNodes.length; p++) {
        force(panelNodes[p], { display: 'block', visibility: 'visible', height: 'auto', 'max-height': 'none', overflow: 'visible', opacity: '1' });
      }
    } catch (err) {
      /* an unfurl failure must never block the capture */
    }

    return function restore() {
      for (var i = 0; i < undoStyles.length; i++) undoStyles[i][0].style.cssText = undoStyles[i][1];
      for (var j = 0; j < undoAttrs.length; j++) {
        var rec = undoAttrs[j];
        if (rec[2]) rec[0].setAttribute(rec[1], rec[3]);
        else rec[0].removeAttribute(rec[1]);
      }
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

  // The fields the server side already knows how to file: quote-level always,
  // plus ONE family-specific group. v12 showed Cruise and Hotel/Package
  // together, unconditionally — harmless clutter for a field list, but it's
  // also what let package-type detection stay an INFERENCE on the server side
  // (extraction.interpreter.ts): nothing here ever said which one the page
  // actually was. Virgin Voyages' AI-written ship_name regex was pinned to one
  // voyage's wording, matched nothing, and inference then read the missing
  // ship as "not a cruise" — silently dropping the sailing, the cabin and the
  // itinerary and importing the deal as a package holiday. Asking the agent to
  // DECLARE the type up front (showChoosePackageType below) and sending it as
  // `packageType` on the payload ends that: the interpreter treats a declared
  // type as authoritative over anything it can infer from which fields ended
  // up filled in.
  var COMMON_FIELD_GROUP = {
    name: 'Always',
    fields: ['sales_price', 'price_per_person', 'travel_date', 'no_of_nights', 'adults', 'quote_title', 'tour_operator', 'currency'],
  };
  // Keyed by the exact `packageType` value the server's ExtractionSpec expects
  // (extraction.types.ts) — 'cruise' | 'package-holiday' | 'lodge' — so the
  // chooser button, the field group and the payload value never drift apart.
  var PACKAGE_TYPE_GROUPS = {
    cruise: {
      buttonLabel: 'Cruise',
      groupName: 'Cruise',
      // cruise_title leads the group because on a sailing the voyage name IS
      // the quote's headline — pick it and the server fills quote_title from it
      // too (see extraction.interpreter.ts), so an agent never has to point at
      // the same words twice.
      fields: ['cruise_title', 'cruise_line', 'ship_name', 'cruise_date', 'cabin_type', 'cabin_number', 'embarkation', 'debarkation'],
    },
    'package-holiday': {
      buttonLabel: 'Package Holiday',
      groupName: 'Package Holiday',
      fields: ['accommodation', 'board_basis', 'room_type', 'departure_airport_name', 'arrival_airport_name'],
    },
    lodge: {
      buttonLabel: 'Hot Tub Break',
      groupName: 'Hot Tub Break (Lodge)',
      fields: ['lodge_type', 'lodge_park_name', 'cottage_id', 'hot_tub', 'pets'],
    },
  };

  // Every element the picker itself puts on the page carries this attribute on
  // its ROOT node (the panel, the mode-chooser). isOwnUI() walks up from an
  // event target looking for it, so a click or hover anywhere inside our own
  // UI is never mistaken for a pick or a page click to suppress.
  var UI_ATTR = 'data-travana-picker-ui';

  function isOwnUI(node) {
    while (node) {
      if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute(UI_ATTR)) return true;
      node = node.parentNode;
    }
    return false;
  }

  function prettyLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  // Visible text of a picked element, trimmed — this is the ground truth the
  // server matches back against `text`. innerText (not textContent) so it
  // reflects what the agent actually saw and clicked, not hidden siblings.
  function textOf(el) {
    var t = el.innerText;
    if (!t) t = el.textContent || '';
    return t.trim();
  }

  function ancestorTags(el) {
    var tags = [];
    var p = el.parentElement;
    while (p && tags.length < 6) {
      tags.push(p.tagName);
      p = p.parentElement;
    }
    return tags;
  }

  function siblingIndex(el) {
    var parent = el.parentElement;
    if (!parent) return -1;
    for (var i = 0; i < parent.children.length; i++) {
      if (parent.children[i] === el) return i;
    }
    return -1;
  }

  // Locates a picked value inside the payload's `text`, plus the surrounding
  // lines a spec rule anchors on. Must run against the EXACT string the
  // payload sends — the server resolves textIndex/lineIndex against that
  // string, not against a re-read of the live page.
  function locateInText(value, el, text) {
    var empty = { textIndex: -1, occurrenceIndex: -1, occurrenceCount: 0, lineIndex: -1, linesBefore: [], linesAfter: [] };
    if (!value) return empty;

    var positions = [];
    var from = 0;
    while (true) {
      var at = text.indexOf(value, from);
      if (at < 0) break;
      positions.push(at);
      from = at + Math.max(value.length, 1);
    }
    if (!positions.length) return empty;

    // A nightly rate repeated per day, or the same total shown in a summary
    // AND a modal, means `value` is rarely unique on the page — a bare
    // text.indexOf would always lock onto the first hit even when the agent
    // clicked the second one. Disambiguate using document order: count how
    // many OTHER leaf elements with this exact text sit before the one the
    // agent actually clicked.
    var ordinal = 0;
    if (positions.length > 1 && el) {
      var all = document.querySelectorAll('body *');
      for (var i = 0; i < all.length; i++) {
        var node = all[i];
        if (node === el) break;
        if (isOwnUI(node)) continue;
        if (node.children.length === 0 && textOf(node) === value) ordinal++;
      }
    }
    var occurrenceIndex = Math.min(ordinal, positions.length - 1);
    var textIndex = positions[occurrenceIndex];

    var lines = text.split('\n');
    var lineIndex = -1;
    var running = 0;
    for (var li = 0; li < lines.length; li++) {
      var lineLen = lines[li].length;
      if (textIndex >= running && textIndex <= running + lineLen) {
        lineIndex = li;
        break;
      }
      running += lineLen + 1; // +1 for the '\n' split() consumed
    }

    var linesBefore = [];
    for (var b = lineIndex - 1; b >= 0 && linesBefore.length < 3; b--) {
      if (lines[b].trim()) linesBefore.unshift(lines[b].trim());
    }
    var linesAfter = [];
    for (var af = lineIndex + 1; af < lines.length && linesAfter.length < 2; af++) {
      if (lines[af].trim()) linesAfter.push(lines[af].trim());
    }

    return {
      textIndex: textIndex,
      occurrenceIndex: occurrenceIndex,
      occurrenceCount: positions.length,
      lineIndex: lineIndex,
      linesBefore: linesBefore,
      linesAfter: linesAfter,
    };
  }

  // The payload fields shared by both modes, read fresh at call time. Picker
  // mode hides its own panel first (see startPicker's onDone) so none of this
  // — text, headings, apiJson — can ever pick up our own UI as page content.
  function corePayload(images, imageContexts) {
    // Walked once here and handed to hiddenFlightsText() below, rather than
    // each calling deepText(document.body) separately — a second full-body
    // walk is wasted work now that unfurlPanels() (see runInstantCapture /
    // startPicker's onDone) means there is more DOM under `text` than before.
    var deep = deepText(document.body);
    return {
      url: location.href,
      title: document.title,
      text: (document.body ? document.body.innerText || '' : '').slice(0, MAX_TEXT),
      // A SEPARATE field, deliberately never merged into `text`. deepText
      // also surfaces inactive tab panels, other cabin grades and
      // pre-rendered alternatives a supplier's page never shows all at
      // once — silently widening what every existing regex sees would
      // create new WRONG-match bugs (the "Thrilling onboard activities"
      // class), not just fix missing-match ones. Rules opt into reading
      // this field explicitly instead. Capped like `text`, with a head
      // slice: deepText walks in document order, so the head is whatever
      // sits nearest the top of the page rather than an arbitrary cut —
      // finding "the main content region" generically, across arbitrary
      // supplier markup, isn't cheap enough to be worth doing here.
      deepText: deep.slice(0, MAX_DEEP_TEXT),
      images: images,
      // Index-aligned with `images`: where each one sits in the page, so a spec
      // can keep the property gallery and drop the room-card carousels.
      imageContexts: imageContexts,
      // Ordered h1/h2 text — the deal's headline, addressable by position.
      headings: headings(),
      // An open modal wins; otherwise fall back to the itinerary hidden inside a
      // collapsed panel.
      flightsText: modalText() || hiddenFlightsText(deep),
      // The operator's own booking JSON, when the page embeds one.
      apiJson: bestScriptJson(),
    };
  }

  function copyPayload(payload, onDone) {
    var json = JSON.stringify(payload);

    function done() {
      var msg =
        'Travana ' +
        VERSION +
        ': deal page captured (' +
        Math.round(json.length / 1024) +
        ' KB).\n\nImages: ' +
        payload.images.length +
        '\nBooking JSON: ' +
        (payload.apiJson ? 'found' : 'none on this page') +
        '\nFlight text: ' +
        (payload.flightsText ? 'found' : 'not found');
      if (payload.picked) msg += '\nFields mapped: ' + payload.picked.length;
      msg += '\n\nGo to the quote form → Capture from supplier page → paste.';
      alert(msg);
      if (onDone) onDone();
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
      else {
        alert('Travana: could not copy automatically.\n\nCheck the browser console — the capture has been logged there for manual copying.');
        console.log(json);
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(done, fallback);
    } else {
      fallback();
    }
  }

  // ── Instant capture (the original one-click flow) ───────────────────────────
  function runInstantCapture() {
    var restoreGalleries = unfurlGalleries();
    whenImagesSettle(2000, function () {
      var collected = collectImages();
      restoreGalleries();
      // Open collapsed drawers/accordions/details right before text is read,
      // and close them again immediately after — never leave the agent's
      // real booking page sitting open in a mangled state.
      var restorePanels = unfurlPanels();
      var payload = corePayload(collected.images, collected.imageContexts);
      restorePanels();
      if (payload.text.trim().length < 200) {
        alert('Travana: this page has almost no text.\n\nOpen the DEAL page and let the price finish loading, then capture again.');
        return;
      }
      copyPayload(payload);
    });
  }

  // ── Field picker mode ────────────────────────────────────────────────────────
  //
  // The agent arms a field, then clicks the matching element on the page. Deal
  // pages are wall-to-wall links and buttons, so that click has to be caught
  // and stopped BEFORE the page's own handler runs — hence the capture-phase
  // listener with preventDefault/stopPropagation, not a normal bubble listener.
  var PANEL_CSS =
    'position:fixed;top:16px;right:16px;width:280px;max-height:80vh;overflow:auto;' +
    'background:#ffffff;color:#111;border:1px solid #ccc;border-radius:8px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.3);z-index:2147483647;' +
    'font:12px/1.4 -apple-system,Segoe UI,Arial,sans-serif;';
  var HEADER_CSS = 'cursor:move;padding:8px 10px;background:#0b5fff;color:#fff;border-radius:8px 8px 0 0;font-weight:700;font-size:13px;';
  var STATUS_CSS = 'padding:8px 10px;border-bottom:1px solid #eee;color:#555;';
  var FOOTER_CSS = 'display:flex;gap:6px;padding:8px 10px;border-top:1px solid #eee;';
  var BTN_CSS =
    'flex:1;padding:8px 6px;border:1px solid #0b5fff;background:#0b5fff;color:#fff;border-radius:6px;' +
    'font:600 12px/1 -apple-system,Segoe UI,Arial,sans-serif;cursor:pointer;';
  var BTN_SECONDARY_CSS =
    'flex:0 0 auto;padding:8px 10px;border:1px solid #ccc;background:#f5f5f5;color:#333;border-radius:6px;' +
    'font:600 12px/1 -apple-system,Segoe UI,Arial,sans-serif;cursor:pointer;';

  // Cheap drag: no library, just track the pointer offset from mousedown and
  // reposition with left/top (dropping the initial right:16px anchor so the
  // panel doesn't fight the drag). Returns a cleanup fn so exitPicker leaves no
  // listeners behind on the page.
  function makeDraggable(handle, panel) {
    var dragging = false;
    var startX = 0, startY = 0, startLeft = 0, startTop = 0;
    function onDown(e) {
      dragging = true;
      var rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      panel.style.right = 'auto';
      panel.style.left = startLeft + 'px';
      panel.style.top = startTop + 'px';
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      panel.style.left = startLeft + e.clientX - startX + 'px';
      panel.style.top = startTop + e.clientY - startY + 'px';
    }
    function onUp() {
      dragging = false;
    }
    handle.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return function cleanup() {
      handle.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }

  function startPicker(images, imageContexts, packageType) {
    var picks = {}; // field -> { value, el, tag, ancestorTags, siblingIndex }
    var armedField = null;
    // The declared type, chosen before this function was even called (see
    // showChoosePackageType). Changeable mid-session via the panel's "Change
    // type" control, which only swaps which group is SHOWN — see
    // currentGroups()/onDone below, neither of which ever touches `picks`, so
    // switching type can never discard an already-picked "Always" field.
    var currentType = packageType;
    // [el, previous cssText] — same undo-stack shape as unfurlGalleries' force(),
    // so leaving picker mode (Esc, Cancel, or a successful Done) always restores
    // every inline style this mode ever touched.
    var highlighted = [];

    // The groups currently offered: the common fields plus ONLY the one
    // package type the agent declared — not all three at once (v12's
    // behaviour). Recomputed on demand rather than cached once, so changing
    // the type mid-session (see the "Change type" button) is just a re-render.
    function currentGroups() {
      var typeGroup = PACKAGE_TYPE_GROUPS[currentType];
      return [
        COMMON_FIELD_GROUP,
        { name: typeGroup.groupName, fields: typeGroup.fields },
      ];
    }

    // Field keys visible right now, in display order. picked fields for a
    // package type the agent has since switched AWAY from are simply not in
    // this list — they're skipped on render and skipped when the payload is
    // assembled in onDone, without ever being deleted from `picks` (switching
    // back to that type would show them again, still checked off).
    function currentFieldOrder() {
      var groups = currentGroups();
      var order = [];
      for (var g = 0; g < groups.length; g++) {
        for (var fi = 0; fi < groups[g].fields.length; fi++) order.push(groups[g].fields[fi]);
      }
      return order;
    }

    function clearHighlight() {
      for (var i = highlighted.length - 1; i >= 0; i--) highlighted[i][0].style.cssText = highlighted[i][1];
      highlighted.length = 0;
    }

    function highlightEl(el) {
      clearHighlight();
      highlighted.push([el, el.style.cssText]);
      el.style.setProperty('outline', '2px solid #ff5722', 'important');
      el.style.setProperty('outline-offset', '1px', 'important');
      el.style.setProperty('background-color', 'rgba(255,87,34,0.15)', 'important');
      el.style.setProperty('cursor', 'crosshair', 'important');
    }

    function onMouseMove(e) {
      if (!armedField) return;
      var el = e.target;
      if (!el || el.nodeType !== 1 || isOwnUI(el)) {
        clearHighlight();
        return;
      }
      if (highlighted.length && highlighted[0][0] === el) return;
      highlightEl(el);
    }

    // capture: true is essential — without it the target's own click handler
    // (an <a> navigating, an accordion toggling) runs FIRST and the pick never
    // happens because the page has already moved on.
    function onClickCapture(e) {
      if (!armedField) return;
      if (isOwnUI(e.target)) return; // clicks on our own panel behave normally
      e.preventDefault();
      e.stopPropagation();
      var el = e.target;
      picks[armedField] = {
        value: textOf(el),
        el: el,
        tag: el.tagName,
        ancestorTags: ancestorTags(el),
        siblingIndex: siblingIndex(el),
      };
      armedField = null;
      clearHighlight();
      renderList();
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' || e.keyCode === 27) exitPicker();
    }

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('keydown', onKeyDown, true);

    var panel = document.createElement('div');
    panel.setAttribute(UI_ATTR, '1');
    panel.style.cssText = PANEL_CSS;

    var header = document.createElement('div');
    header.style.cssText = HEADER_CSS;
    header.textContent = 'Travana field picker';
    panel.appendChild(header);

    var status = document.createElement('div');
    status.style.cssText = STATUS_CSS;
    status.textContent = 'Click a field below, then click the matching element on the page. Esc cancels.';
    panel.appendChild(status);

    var typeRow = document.createElement('div');
    typeRow.style.cssText = STATUS_CSS + 'display:flex;align-items:center;justify-content:space-between;gap:6px;';
    var typeLabel = document.createElement('div');
    typeLabel.style.cssText = 'font-weight:700;';
    panel.appendChild(typeRow);
    typeRow.appendChild(typeLabel);
    var changeTypeBtn = document.createElement('button');
    changeTypeBtn.textContent = 'Change';
    changeTypeBtn.style.cssText = BTN_SECONDARY_CSS + 'flex:0 0 auto;padding:4px 8px;font-size:11px;';
    changeTypeBtn.addEventListener('click', function () {
      // Re-asks the type question on top of the still-open panel. Only the
      // GROUP shown changes on an answer — `picks` is untouched, so any
      // "Always" field already clicked (and any type-specific field that
      // still applies if the agent picks the SAME type back) survives.
      showChoosePackageType(function (chosen) {
        currentType = chosen;
        armedField = null;
        clearHighlight();
        renderList();
      });
    });
    typeRow.appendChild(changeTypeBtn);

    var list = document.createElement('div');
    list.style.cssText = 'padding:4px 6px;';
    panel.appendChild(list);

    var footer = document.createElement('div');
    footer.style.cssText = FOOTER_CSS;
    var doneBtn = document.createElement('button');
    doneBtn.textContent = 'Done — copy';
    doneBtn.style.cssText = BTN_CSS;
    doneBtn.addEventListener('click', onDone);
    footer.appendChild(doneBtn);
    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = BTN_SECONDARY_CSS;
    cancelBtn.addEventListener('click', function () {
      exitPicker();
    });
    footer.appendChild(cancelBtn);
    panel.appendChild(footer);

    document.body.appendChild(panel);
    var cleanupDrag = makeDraggable(header, panel);
    renderList();

    function renderList() {
      typeLabel.textContent = 'Type: ' + PACKAGE_TYPE_GROUPS[currentType].groupName;
      var groups = currentGroups();
      while (list.firstChild) list.removeChild(list.firstChild);
      for (var gi = 0; gi < groups.length; gi++) {
        var group = groups[gi];
        var groupLabel = document.createElement('div');
        groupLabel.style.cssText = 'font-weight:700;color:#888;text-transform:uppercase;font-size:10px;margin:8px 4px 2px;';
        groupLabel.textContent = group.name;
        list.appendChild(groupLabel);
        for (var fj = 0; fj < group.fields.length; fj++) list.appendChild(buildRow(group.fields[fj]));
      }
    }

    function buildRow(field) {
      var picked = picks[field];
      var armed = armedField === field;
      var row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 4px;margin:2px 0;' +
        'border-radius:5px;cursor:pointer;' +
        (armed ? 'background:#fff3e0;border:1px solid #ff5722;' : picked ? 'background:#e8f5e9;border:1px solid #c8e6c9;' : 'border:1px solid transparent;');

      var text = document.createElement('div');
      text.style.cssText = 'overflow:hidden;flex:1;';
      var name = document.createElement('div');
      name.style.cssText = 'font-weight:600;';
      name.textContent = prettyLabel(field);
      text.appendChild(name);
      var val = document.createElement('div');
      val.style.cssText = 'color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      val.textContent = armed ? 'Click an element on the page…' : picked ? picked.value.slice(0, 60) : 'Not set';
      text.appendChild(val);
      row.appendChild(text);

      if (picked) {
        var removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove pick';
        removeBtn.style.cssText = 'flex:0 0 auto;border:none;background:transparent;color:#c00;font-size:16px;cursor:pointer;line-height:1;';
        removeBtn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          delete picks[field];
          if (armedField === field) armedField = null;
          renderList();
        });
        row.appendChild(removeBtn);
      }

      row.addEventListener('click', function () {
        armedField = armedField === field ? null : field; // click again to disarm
        clearHighlight();
        renderList();
      });

      return row;
    }

    function onDone() {
      // Hide our own panel before reading the page's text — otherwise the
      // panel's own labels and captured-value previews would be sitting right
      // there in document.body.innerText, poisoning `text` (and every future
      // spec built from this capture) with UI chrome that was never on the
      // supplier's page.
      panel.style.display = 'none';
      clearHighlight();
      // Same open-then-restore as instant capture — this only touches the
      // final text-read step, never the live click-to-pick phase above, so
      // picker mode's own mechanics are undisturbed.
      var restorePanels = unfurlPanels();
      var payload = corePayload(images, imageContexts);
      restorePanels();
      panel.style.display = '';

      if (payload.text.trim().length < 200) {
        alert('Travana: this page has almost no text.\n\nOpen the DEAL page and let the price finish loading, then capture again.');
        return;
      }

      // Only fields belonging to the group shown NOW — a pick made under a
      // package type the agent has since changed away from (via "Change" in
      // typeRow) is dropped here rather than sent under a type it no longer
      // matches. Recomputed fresh, not read from a cached FIELD_ORDER, since
      // currentType can change without leaving this function's closure.
      var fieldOrder = currentFieldOrder();
      var pickedArr = [];
      for (var i = 0; i < fieldOrder.length; i++) {
        var field = fieldOrder[i];
        var p = picks[field];
        if (!p) continue;
        // Locate against the SAME `text` string the payload sends, computed
        // above — not a fresh read of the live page, which could have moved on.
        var loc = locateInText(p.value, p.el, payload.text);
        pickedArr.push({
          field: field,
          value: p.value,
          textIndex: loc.textIndex,
          lineIndex: loc.lineIndex,
          linesBefore: loc.linesBefore,
          linesAfter: loc.linesAfter,
          occurrenceIndex: loc.occurrenceIndex,
          occurrenceCount: loc.occurrenceCount,
          tag: p.tag,
          ancestorTags: p.ancestorTags,
          siblingIndex: p.siblingIndex,
        });
      }
      payload.pickerVersion = 1;
      payload.picked = pickedArr;
      // The declared type itself — see picker-spec.ts's PickerCaptureContext,
      // which carries this straight onto ExtractionSpec.packageType and makes
      // it authoritative over the interpreter's own inference.
      payload.packageType = currentType;

      copyPayload(payload, function () {
        exitPicker();
      });
    }

    function exitPicker() {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClickCapture, true);
      document.removeEventListener('keydown', onKeyDown, true);
      cleanupDrag();
      clearHighlight();
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    }
  }

  // Asks which of the three package types this supplier's pages are, BEFORE
  // any field is shown. This is the declaration the interpreter now trusts
  // over its own inference (extraction.types.ts / extraction.interpreter.ts)
  // — the whole point being that the agent, who can SEE the page, states the
  // type once rather than the server guessing it after the fact from which
  // fields happened to resolve. `onChosen` is called with the packageType key
  // ('cruise' | 'package-holiday' | 'lodge'); this same dialog is reused by
  // the panel's "Change" button, so there is exactly one place this question
  // is asked.
  function showChoosePackageType(onChosen) {
    var chooser = document.createElement('div');
    chooser.setAttribute(UI_ATTR, '1');
    chooser.style.cssText = 'position:fixed;top:16px;right:16px;width:220px;z-index:2147483647;' +
      'background:#ffffff;color:#111;border:1px solid #ccc;border-radius:8px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.3);padding:10px;' +
      'font:12px/1.4 -apple-system,Segoe UI,Arial,sans-serif;';

    var label = document.createElement('div');
    label.style.cssText = 'font-weight:700;margin-bottom:8px;';
    label.textContent = 'What kind of deal is this?';
    chooser.appendChild(label);

    var order = ['cruise', 'package-holiday', 'lodge'];
    for (var i = 0; i < order.length; i++) {
      (function (typeKey) {
        var btn = document.createElement('button');
        btn.textContent = PACKAGE_TYPE_GROUPS[typeKey].buttonLabel;
        btn.style.cssText = BTN_CSS + 'display:block;width:100%;margin-bottom:6px;';
        btn.addEventListener('click', function () {
          document.body.removeChild(chooser);
          onChosen(typeKey);
        });
        chooser.appendChild(btn);
      })(order[i]);
    }

    document.body.appendChild(chooser);
  }

  function runPickerMode() {
    showChoosePackageType(function (packageType) {
      var restoreGalleries = unfurlGalleries();
      whenImagesSettle(2000, function () {
        var collected = collectImages();
        restoreGalleries();
        startPicker(collected.images, collected.imageContexts, packageType);
      });
    });
  }

  // ── Mode chooser ─────────────────────────────────────────────────────────
  //
  // Asking up front, in a tiny on-page prompt, beats a modifier key or a
  // native confirm(): it needs no explanation in the install docs, and it
  // reuses the exact same UI_ATTR exclusion the field picker relies on rather
  // than adding a second, different mechanism for one dialog.
  function showChooser() {
    var chooser = document.createElement('div');
    chooser.setAttribute(UI_ATTR, '1');
    chooser.style.cssText = 'position:fixed;top:16px;right:16px;width:220px;z-index:2147483647;' +
      'background:#ffffff;color:#111;border:1px solid #ccc;border-radius:8px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.3);padding:10px;' +
      'font:12px/1.4 -apple-system,Segoe UI,Arial,sans-serif;';

    var label = document.createElement('div');
    label.style.cssText = 'font-weight:700;margin-bottom:8px;';
    label.textContent = 'Travana ' + VERSION;
    chooser.appendChild(label);

    var instantBtn = document.createElement('button');
    instantBtn.textContent = 'Instant capture';
    instantBtn.style.cssText = BTN_CSS + 'display:block;width:100%;margin-bottom:6px;';
    chooser.appendChild(instantBtn);

    var pickerBtn = document.createElement('button');
    pickerBtn.textContent = 'Field picker mode';
    pickerBtn.style.cssText = BTN_SECONDARY_CSS + 'display:block;width:100%;';
    chooser.appendChild(pickerBtn);

    document.body.appendChild(chooser);

    instantBtn.addEventListener('click', function () {
      document.body.removeChild(chooser);
      runInstantCapture();
    });
    pickerBtn.addEventListener('click', function () {
      document.body.removeChild(chooser);
      runPickerMode();
    });
  }

  showChooser();
})();
