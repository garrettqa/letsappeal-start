// Meta Conversions API relay.
//
// WHY THIS EXISTS
// Until 2026-08-02 this pixel was browser-only. Events Manager showed
// server_last_fired_time as 1969-12-31, meaning no server event had ever been sent.
// Browser-only means every event blocked by an ad blocker, Safari ITP or iOS never
// reaches Meta. Meta's own panel estimates a 17.8% lower cost per result for
// advertisers who close that gap.
//
// WHAT IT SENDS, AND WHAT IT DELIBERATELY DOES NOT
// user_data carries ONLY: client_ip_address, client_user_agent, and the _fbp / _fbc
// cookies. Every one of those is already sent by the browser pixel on the same page
// view, so this is the same information over a more reliable transport, not new data
// sharing.
//
// IT MUST NEVER SEND em, ph, fn, ln OR ANY OTHER HASHED PERSONAL IDENTIFIER.
// privacy.html states: "We have deliberately left off the Meta setting that would
// attach your email to those signals, because we do not think it is an appropriate
// trade in a category like this one." Adding em here would break that promise just as
// surely as switching on Automatic Advanced Matching in Events Manager, which was
// declined on 2026-08-02 for the same reason.
//
// DEDUPLICATION
// The browser sends fbq(..., {eventID}) and this endpoint sends the identical event_id.
// Meta collapses the pair into one event. If event_id is ever dropped from either side,
// every conversion double counts, so the endpoint rejects requests without one rather
// than sending an event that would corrupt the numbers.
//
// The access token lives in the META_CAPI_TOKEN environment variable and must never be
// committed or exposed to the browser. That is the whole reason this runs server side.

const PIXEL_ID = '1031029212882366';
const GRAPH_VERSION = 'v21.0';

// Only these five. Same list as privacy.html and the pixel comment in the page heads.
// Anything else is rejected, so a future edit cannot quietly widen what Meta receives.
const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'Lead',
  'CompleteRegistration',
  'InitiateCheckout',
]);

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (p.startsWith(name + '=')) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

function clientIp(req) {
  // Vercel puts the real client IP first in x-forwarded-for.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length) return String(xff[0]).split(',')[0].trim();
  return req.headers['x-real-ip'] || undefined;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Defensive clean-up. Meta returns "Cannot parse access token" if the value carries
  // a trailing newline, stray whitespace, or wrapping quotes, all of which are easy to
  // pick up when copying a token into a dashboard field. Seen for real on 2026-08-02.
  const rawToken = process.env.META_CAPI_TOKEN;
  const token = rawToken ? rawToken.trim().replace(/^["']|["']$/g, '') : rawToken;
  if (!token) {
    // Not configured yet. Fail quietly with 204 so the site never shows an error to a
    // visitor because of a missing analytics secret.
    return res.status(204).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'bad_body' });
  }

  const eventName = String(body.event_name || '');
  const eventId = String(body.event_id || '');

  if (!ALLOWED_EVENTS.has(eventName)) {
    return res.status(400).json({ error: 'event_not_allowed', event_name: eventName });
  }
  // No event_id means no deduplication, which means double counted conversions.
  // Refusing is safer than sending.
  if (!eventId) {
    return res.status(400).json({ error: 'missing_event_id' });
  }

  const cookies = req.headers.cookie;
  const userData = {
    client_ip_address: clientIp(req),
    client_user_agent: req.headers['user-agent'],
  };
  const fbp = readCookie(cookies, '_fbp');
  const fbc = readCookie(cookies, '_fbc');
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: typeof body.event_source_url === 'string' ? body.event_source_url : undefined,
        action_source: 'website',
        user_data: userData,
      },
    ],
  };

  try {
    const url = 'https://graph.facebook.com/' + GRAPH_VERSION + '/' + PIXEL_ID +
      '/events?access_token=' + encodeURIComponent(token);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    if (!r.ok) {
      console.error('capi_upstream_error', r.status, text.slice(0, 500));
      // Meta's own error text is returned ONLY when ?debug=1 is passed, because
      // debugging this blind is otherwise impossible on a serverless function.
      // The token is stripped first as a belt-and-braces measure: Meta does not echo
      // it back today, but this must never be the reason a secret leaks.
      if (req.query && req.query.debug === '1') {
        const safe = text.split(token).join('[REDACTED]').slice(0, 600);
        return res.status(502).json({ error: 'upstream', status: r.status, meta: safe });
      }
      return res.status(502).json({ error: 'upstream' });
    }
    // On ?debug=1 echo Meta's own acknowledgement, which carries events_received.
    // A 200 alone does not prove Meta kept the event; events_received does.
    if (req.query && req.query.debug === '1') {
      return res.status(200).json({ ok: true, meta: text.slice(0, 300) });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('capi_exception', err && err.message);
    return res.status(500).json({ error: 'exception' });
  }
};
