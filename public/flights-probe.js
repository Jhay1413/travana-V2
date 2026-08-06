/*
 * Diagnostic: WHERE does the flight itinerary live in this page?
 *
 * Paste into the browser console on a supplier deal page (after the flights are
 * visible on screen). The capture bookmarklet reads the light DOM plus every
 * OPEN shadow root; this reports whether the itinerary is reachable that way,
 * and if not, which of the unreachable places it must be in.
 *
 * Build the one-liner with the snippet in scripts/build-bookmarklet.ts.
 */
(function () {
  var lines = [];
  var customEls = [];
  var openRoots = 0;

  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      var t = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (t) lines.push(t);
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(node.nodeName)) return;
    if (node.nodeName.indexOf('-') > 0) {
      customEls.push({ tag: node.nodeName.toLowerCase(), open: !!node.shadowRoot });
    }
    if (node.shadowRoot) {
      openRoots++;
      walk(node.shadowRoot);
    }
    for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
  }
  walk(document.body);
  var deep = lines.join('\n');

  // The itinerary's signature: a time, and an airport code, close together.
  var TIME = /\b\d{1,2}:\d{2}\b/;
  var LEG = /\b(OUT|RTN|OUTBOUND|INBOUND)\b/;
  var hasTime = TIME.test(deep);
  var hasLeg = LEG.test(deep);
  var reachable = hasTime && hasLeg;

  console.log('%cFlights probe', 'font-weight:bold;font-size:13px');
  console.log('  reachable by the capture   :', reachable);
  console.log('  has a HH:MM time           :', hasTime);
  console.log('  has an OUT/RTN leg marker  :', hasLeg);
  console.log('  open shadow roots          :', openRoots);

  var closedish = customEls.filter(function (c) {
    return !c.open;
  });
  console.log('  custom elements            :', customEls.length, '(' + closedish.length + ' expose no shadowRoot)');
  if (closedish.length) {
    console.log(
      '    no shadowRoot:',
      closedish
        .map(function (c) {
          return c.tag;
        })
        .join(', '),
    );
  }

  var frames = document.querySelectorAll('iframe');
  var blocked = 0;
  for (var i = 0; i < frames.length; i++) {
    try {
      if (!frames[i].contentDocument) blocked++;
    } catch (e) {
      blocked++;
    }
  }
  console.log('  iframes                    :', frames.length, '(' + blocked + ' cross-origin / unreadable)');

  // Inventory of inline scripts — the booking record usually lives in one of
  // these, and knowing its NAME and SHAPE is what makes it targetable.
  var scripts = document.querySelectorAll('script');
  var inline = [];
  for (var s = 0; s < scripts.length; s++) {
    var body = scripts[s].textContent || '';
    if (body.length < 40) continue;
    inline.push({
      id: scripts[s].id || '(none)',
      type: scripts[s].getAttribute('type') || '(none)',
      kb: Math.round(body.length / 1024),
      flighty: /"?flights?"?\s*[:=]|departureAirport|arrivalAirport|itinerary/i.test(body),
      head: body.replace(/\s+/g, ' ').trim().slice(0, 100),
    });
  }
  inline.sort(function (a, b) {
    return b.flighty - a.flighty || b.kb - a.kb;
  });
  console.log('\n%cInline scripts (flight-looking first):', 'font-weight:bold');
  console.table(inline.slice(0, 15));

  if (reachable) {
    var idx = deep.search(LEG);
    console.log('\n%cFOUND — this is what the capture will send:', 'color:green;font-weight:bold');
    console.log(deep.slice(Math.max(0, idx - 200), idx + 600));
  } else {
    console.log(
      '\n%cNOT REACHABLE.',
      'color:#c00;font-weight:bold',
      '\nThe itinerary is not in the light DOM or any OPEN shadow root.' +
        '\nIt is therefore in a closed shadow root or a cross-origin iframe — neither of which any script on this page can read.' +
        '\nCheck the numbers above: unreadable iframes > 0, or custom elements with no shadowRoot.',
    );
  }
})();
