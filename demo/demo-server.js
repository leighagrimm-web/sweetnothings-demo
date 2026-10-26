/*
 * Portfolio demo: stands in for the Apps Script web app. The site's requests go to https://demo.invalid/api
 * (tools/sync-from-site.js swaps the real addresses out), and this answers them from DemoDB, in the browser.
 * Same answers as the real server: settings, orders, messages, promo codes, class payment checks, calendar files.
 */
(function () {
  const API = 'https://demo.invalid/api';
  const realFetch = window.fetch.bind(window);
  const PRIVATE = ['ownerEmail', 'replyToEmail', 'ownerPhone', 'pickupAddress', 'pickupInstructions', 'maintenancePassword', 'adminHelpers', 'senderName', 'siteUrl', 'environment', 'adminUrl'];
  const OCCASIONS = ['Birthday', 'Baby Shower', 'Wedding Shower', 'Anniversary', 'Party', 'Other'];

  function publicConfig(db) {
    const out = {};
    Object.keys(db.cfg).forEach((k) => { if (PRIVATE.indexOf(k) === -1 && k !== 'blockedRanges') out[k] = db.cfg[k]; });
    const seats = DemoDB.seats(db);
    out.events = (db.cfg.events || []).filter((e) => e.show !== false && String(e.title || '').trim()).map((e) => {
      const x = Object.assign({}, e);
      delete x.show;
      x.booked = seats[e.id] || 0;
      if (x.max !== '' && x.max != null) x.spotsLeft = Math.max(0, Number(x.max) - x.booked);
      return x;
    });
    out.gallery = (db.cfg.gallery || []).filter((g) => g.show !== false);
    out.blockedDates = [];
    const today = SN.isoDate(new Date());
    (db.cfg.blockedRanges || []).forEach((r) => {
      for (let d = r.start < today ? today : r.start; d <= (r.end || r.start); d = SN.isoDate(new Date(new Date(d + 'T12:00:00').getTime() + 864e5))) out.blockedDates.push(d);
    });
    const w = DemoDB.weeks(db);
    out.weekLoads = {};
    Object.keys(w).forEach((m) => { out.weekLoads[m] = { custom: w[m].custom.approved, artisan: w[m].artisan.approved }; });
    return out;
  }

  // Inspiration photos: kept (shrunk already by the site) so the admin can show them; ids look like Drive file ids.
  function keepPhotos(db, list) {
    return (Array.isArray(list) ? list : []).slice(0, 5).map((p, i) => {
      const id = 'DEMO' + Date.now().toString(36) + i + 'x'.repeat(12);
      if (p && p.data) db.photos[id] = p.data;
      return { id, url: 'https://drive.google.com/file/d/' + id + '/view' };
    });
  }

  function submitOrder(db, b) {
    const cfg = db.cfg;
    const flavors = {};
    cfg.flavors.forEach((f) => { flavors[f.id] = f; });
    const code = b.code ? db.codes.find((c) => c.active !== false && c.code.toUpperCase() === String(b.code).trim().toUpperCase()) : null;
    if (b.code && !code) return { ok: false, code: 'invalid', errors: ['a valid promo or gift code (or remove it)'] };
    const pct = code && code.type === 'Percent off' ? code.amount : 0;
    let gift = code && code.type === 'Gift card' ? code.balance : 0;
    const customer = { name: String(b.customer.name || '').trim(), email: String(b.customer.email || '').trim(), phone: SN.formatPhone(b.customer.phone || '') };
    const cookies = [], classes = [];
    (b.items || []).forEach((it) => {
      if (it.kind === 'custom') {
        const unit = Number(cfg.customBasePrice) || 5;
        const photos = keepPhotos(db, it.photos);
        cookies.push({ kind: 'custom', qty: it.qty, designs: it.designs, desc: it.desc, photos, photoNames: [], unit, lineTotal: it.qty * unit,
          summary: it.designs + ' design' + (it.designs > 1 ? 's' : '') + ' · estimated at ' + SN.money(unit) + ' each' + (photos.length ? ' · ' + photos.length + ' photo' + (photos.length > 1 ? 's' : '') + ' attached' : '') });
      } else if (it.kind === 'mini' || it.kind === 'large') {
        const fq = {};
        Object.keys(it.fq || {}).forEach((id) => { if (Number(it.fq[id]) > 0) fq[id] = Number(it.fq[id]); });
        const qty = Object.keys(fq).reduce((a, k) => a + fq[k], 0);
        const unit = (it.kind === 'mini' ? cfg.miniPerDozen : cfg.largePerDozen) / 12;
        cookies.push({ kind: it.kind, qty, fq, unit, lineTotal: qty * unit, summary: Object.keys(fq).map((id) => fq[id] + ' ' + (flavors[id] ? flavors[id].name : id)).join(', ') });
      } else if (it.kind === 'class') {
        const ev = cfg.events.find((e) => e.id === it.eventId);
        if (!ev) return;
        classes.push({ kind: 'class', eventId: ev.id, title: ev.title, date: ev.date, start: ev.start, end: ev.end, address: [ev.venue, ev.address].filter(Boolean).join(', '),
          qty: it.qty, unit: Number(ev.price), lineTotal: it.qty * Number(ev.price), summary: SN.classWhen(ev) });
      }
    });
    const now = new Date().toISOString();
    const made = [];
    if (classes.length) {
      const subtotal = classes.reduce((a, it) => a + it.lineTotal, 0);
      const discount = Math.round(subtotal * pct) / 100;
      const credit = Math.min(gift, subtotal - discount); gift -= credit;
      const total = subtotal - discount - credit;
      made.push({ number: DemoDB.nextNumber(db), type: 'Class', createdAt: now, status: 'Booked', items: classes, eventType: '', dateNeeded: classes[0].date, allergies: '', eventTime: '', pickupWindow: '',
        fulfillment: 'class', address: null, customer, subtotal, discount, tax: 0, deliveryFee: 0, giftCredit: credit, total, taxRate: 0, promoCode: code ? code.code : '', messages: [], emailStatus: 'Sent (demo)',
        invoice: { lines: classes.map((c) => ({ desc: 'Class: ' + c.title, qty: c.qty, unit: c.unit })), fee: 0, subtotal: subtotal - discount, tax: 0, credit, total, note: '', changed: false, sentAt: now } });
      if (code && code.type === 'Gift card') code.balance = Math.round((code.balance - credit) * 100) / 100;
    }
    if (cookies.length) {
      const subtotal = cookies.reduce((a, it) => a + it.lineTotal, 0);
      const discount = Math.round(subtotal * pct) / 100;
      const delivery = b.fulfillment === 'delivery';
      const zone = delivery ? cfg.zones.find((z) => z.zip === (b.address || {}).zip) : null;
      const fee = zone ? Number(zone.fee) || 0 : 0;
      const credit = Math.min(gift, subtotal - discount + fee);
      const eventType = b.eventType === 'Other' && b.eventOther ? 'Other: ' + b.eventOther : (OCCASIONS.indexOf(b.eventType) !== -1 ? b.eventType : '');
      made.push({ number: DemoDB.nextNumber(db), type: 'Cookies', createdAt: now, status: 'Pending review', items: cookies, eventType, dateNeeded: b.dateNeeded, allergies: b.allergies || '',
        eventTime: b.eventTime || '', pickupWindow: b.pickupWindow || '', fulfillment: delivery ? 'delivery' : 'pickup', address: delivery ? b.address : null, customer,
        subtotal, discount, tax: 0, deliveryFee: fee, giftCredit: credit, total: subtotal - discount + fee - credit, taxRate: 0, promoCode: code ? code.code : '',
        invoice: null, declineNote: '', messages: [], emailStatus: 'Sent (demo)' });
    }
    if (code && code.type === 'Percent off') code.uses = (code.uses || 0) + 1;
    made.forEach((o) => db.orders.push(o));
    const pub = made.map((o) => Object.assign({}, o, { payUrl: '' }));
    return { ok: true, orders: pub, order: pub.find((o) => o.type === 'Cookies') || pub[0] };
  }

  function sendMessage(db, b) {
    const id = db.messages.reduce((a, m) => Math.max(a, m.id), 0) + 1;
    db.messages.unshift({ id, createdAt: new Date().toISOString(), status: 'New', topic: b.topic || 'Quick message', name: b.name || '', email: b.email || '', phone: b.phone || '',
      orderNumber: b.orderNumber || '', message: b.message || '', photos: keepPhotos(db, b.photos), photoNames: [], source: b.topic ? 'Contact page' : 'Message me' });
    return { ok: true };
  }

  function ics(db, id) {
    const ev = (db.cfg.events || []).find((e) => e.id === id);
    if (!ev || !ev.date) return '';
    const t = (s) => { const m = String(s || '').match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])?/i); if (!m) return null; let h = Number(m[1]) % (m[3] ? 12 : 24); if (m[3] && /p/i.test(m[3])) h += 12; return [h, Number(m[2] || 0)]; };
    const s = t(ev.start) || [18, 0], e = t(ev.end) || [s[0] + 2, s[1]];
    const two = (n) => String(n).padStart(2, '0');
    const d = ev.date.replace(/-/g, '');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sweet Nothings demo//EN', 'BEGIN:VEVENT', 'UID:' + ev.id + '@demo',
      'DTSTART:' + d + 'T' + two(s[0]) + two(s[1]) + '00', 'DTEND:' + d + 'T' + two(e[0]) + two(e[1]) + '00',
      'SUMMARY:' + ev.title, 'LOCATION:' + [ev.venue, ev.address].filter(Boolean).join(', ').replace(/,/g, '\\,'), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }

  function answer(url, init) {
    const db = DemoDB.load();
    const q = new URLSearchParams(url.split('?')[1] || '');
    if (q.get('action') === 'config') return { body: { ok: true, config: publicConfig(db) } };
    if (q.get('action') === 'ics') return { text: ics(db, q.get('event')), type: 'text/calendar' };
    let b = {};
    try { b = JSON.parse((init && init.body) || '{}'); } catch (e) { /* empty */ }
    let r;
    if (b.action === 'submitOrder') r = submitOrder(db, b);
    else if (b.action === 'sendMessage') r = sendMessage(db, b);
    else if (b.action === 'checkCode') {
      const c = db.codes.find((x) => x.active !== false && x.code.toUpperCase() === String(b.code || '').trim().toUpperCase());
      r = !c ? { ok: false, error: 'That code isn’t valid. Try DEMO10 or GIFT-DEMO-25.' } : c.type === 'Gift card' ? { ok: true, code: c.code, type: 'gift', amount: c.balance } : { ok: true, code: c.code, type: 'percent', amount: c.amount };
    } else if (b.action === 'checkClassPayment') {
      const o = db.orders.find((x) => x.number === b.number);
      r = !o ? { ok: false, error: 'We couldn’t find that booking.' } : { ok: true, number: o.number, status: o.status, total: o.total, classes: o.items.map((it) => ({ title: it.title, summary: it.summary, qty: it.qty, eventId: it.eventId })), payUrl: '', holdMinutes: db.cfg.classHoldMinutes || 15 };
    } else if (b.action === 'checkBypass') r = { ok: false, error: 'There’s no password in the demo.' };
    else r = { ok: false, error: 'Unknown action.' };
    DemoDB.save(db);
    return { body: r };
  }

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url;
    if (!url || url.indexOf(API) !== 0) return realFetch(input, init);
    return new Promise((resolve) => setTimeout(() => {
      const a = answer(url, init);
      resolve(new Response(a.text != null ? a.text : JSON.stringify(a.body), { status: 200, headers: { 'Content-Type': a.type || 'application/json' } }));
    }, 250 + Math.random() * 250));   // a little wait, like the real server
  };
})();
