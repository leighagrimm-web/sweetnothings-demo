/*
 * Portfolio demo: the "Google Sheet" for this demo, kept in the visitor's own browser (localStorage).
 * The customer site (demo-server.js) and the admin (demo-admin.js) both read and write it, so an order placed on
 * the demo site shows up in the demo admin. Nothing leaves the browser. "Reset demo data" puts the samples back.
 */
(function () {
  // GitHub Pages serves this demo from the same address as the real test site (leighagrimm-web.github.io), so they
  // share browser storage. The site's own keys (sn_bag, sn_orders, sn_live_cfg_v2…) get a demo prefix here, so
  // the demo never touches the test site's saved bag or settings, and the other way around.
  ['getItem', 'setItem', 'removeItem'].forEach((fn) => {
    const orig = Storage.prototype[fn];
    Storage.prototype[fn] = function (k, ...rest) {
      const key = String(k);
      return orig.call(this, /^sn_/.test(key) && !/^sn_demo/.test(key) ? 'sn_demo__' + key : key, ...rest);
    };
  });

  const KEY = 'sn_demo_db_v1';
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return SN.isoDate(d); };
  const ago = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();

  // The sample business data: Melissa's real menu, prices, wording and photos (SN_DEFAULTS, a snapshot of the live
  // site), with private details replaced by made-up ones.
  function seedConfig() {
    const cfg = SN.clone(SN_DEFAULTS);
    Object.assign(cfg, {
      maintenanceMode: false, acceptingOrders: true, environment: 'Demo',
      ownerEmail: 'owner@example.com', replyToEmail: 'owner@example.com', ownerPhone: '(847) 555-0123',
      pickupAddress: '123 Demo Street, Rosemont, IL', pickupInstructions: 'Ring the side doorbell; cookies will be on the bench.',
      capCustomPerWeek: cfg.capCustomPerWeek || 50, capArtisanPerWeek: cfg.capArtisanPerWeek || 75, classHoldMinutes: 15
    });
    // Classes always sit a few weeks ahead, so the demo never shows "already happened".
    let first = true;
    cfg.events = (cfg.events || []).map((e) => {
      const x = Object.assign({ show: true }, e);
      delete x.booked; delete x.spotsLeft;
      if (x.button === 'Add to bag' && first) { x.date = iso(24); x.max = x.max || 18; first = false; }
      return x;
    });
    cfg.gallery = (cfg.gallery || []).map((g) => Object.assign({ show: true }, g));
    cfg.blockedRanges = [{ start: iso(40), end: iso(43), note: 'Family trip' }];
    delete cfg.blockedDates;
    return cfg;
  }

  function seedOrders(cfg) {
    const cls = cfg.events.find((e) => e.button === 'Add to bag') || { id: 'e1', title: 'Cookie Decorating Class', price: 60 };
    const flavor = (i) => (cfg.flavors[i] || cfg.flavors[0] || { id: 'cc', name: 'Chocolate Chip' });
    const per = (k) => (k === 'mini' ? cfg.miniPerDozen : cfg.largePerDozen) / 12;
    const base = Number(cfg.customBasePrice) || 5;
    const person = (name, n) => ({ name, email: name.split(' ')[0].toLowerCase() + '@example.com', phone: '(847) 555-01' + String(n).padStart(2, '0') });
    const order = (num, status, extra) => Object.assign({
      number: num, type: 'Cookies', createdAt: ago(30), status, eventType: 'Birthday', dateNeeded: iso(18), allergies: '', eventTime: '', pickupWindow: '',
      fulfillment: 'pickup', address: null, customer: person('Jordan Ellis', 1), taxRate: 0, items: [], subtotal: 0, tax: 0, deliveryFee: 0, total: 0,
      invoice: null, declineNote: '', promoCode: '', discount: 0, giftCredit: 0, messages: [], emailStatus: 'Sent (demo)'
    }, extra);
    const custom = (qty, designs, desc, unit) => ({ kind: 'custom', qty, designs, desc, unit: unit || base, lineTotal: qty * (unit || base), summary: designs + ' design' + (designs > 1 ? 's' : '') + ' · estimated at ' + SN.money(unit || base) + ' each' });
    const artisan = (kind, fq) => {
      const qty = Object.keys(fq).reduce((a, k) => a + fq[k], 0);
      return { kind, qty, fq, unit: per(kind), lineTotal: qty * per(kind), summary: Object.keys(fq).map((id) => fq[id] + ' ' + (cfg.flavors.find((f) => f.id === id) || { name: id }).name).join(', ') };
    };
    const totals = (o) => { o.subtotal = o.items.reduce((a, it) => a + it.lineTotal, 0); o.total = o.subtotal - o.discount + o.deliveryFee - o.giftCredit; return o; };
    const invoice = (o, note) => {
      const lines = o.items.map((it) => ({ desc: it.qty + ' ' + SN.itemLabel(it.kind), qty: it.qty, unit: it.unit }));
      const sub = lines.reduce((a, l) => a + l.qty * l.unit, 0);
      return { lines, fee: o.deliveryFee, subtotal: sub, tax: 0, credit: 0, total: sub + o.deliveryFee, note: note || '', changed: false, sentAt: ago(20), emailStatus: 'Sent (demo)',
        qb: { id: 'Q' + o.number, docNumber: String(1000 + Number(o.number.slice(3))), total: Math.round((sub + o.deliveryFee) * 1.0225 * 100) / 100, tax: Math.round(sub * 0.0225 * 100) / 100, balance: Math.round((sub + o.deliveryFee) * 1.0225 * 100) / 100, link: '#demo-pay', env: 'demo' } };
    };
    const f0 = flavor(0).id, f1 = flavor(1).id, f2 = flavor(2).id, f3 = flavor(3).id;
    const orders = [
      totals(order('SN-1012', 'Pending review', { createdAt: ago(3), customer: person('Taylor Brooks', 12), eventType: 'Baby Shower', dateNeeded: iso(19), eventTime: '2:00 PM',
        allergies: 'One guest has a tree-nut allergy', fulfillment: 'delivery', address: { street: '48 Maple Ave', city: 'Rosemont', zip: (cfg.zones[0] || { zip: '60018' }).zip },
        deliveryFee: Number((cfg.zones[0] || { fee: 5 }).fee) || 5, pickupWindow: '10:00 AM – 12:00 PM · Friday evening also works',
        items: [custom(24, 3, 'Pink and gold, "Oh Baby" plaques, onesies and rattles'), artisan('mini', { [f0]: 6, [f1]: 6 })], promoCode: 'DEMO10', discount: 0 })),
      totals(order('SN-1011', 'Pending review', { createdAt: ago(8), customer: person('Sam Rivera', 11), eventType: 'Party', dateNeeded: iso(22), items: [custom(36, 2, 'Football and jersey cookies in team colors')] })),
      totals(order('SN-1010', 'Invoice sent', { createdAt: ago(60), customer: person('Morgan Lee', 10), eventType: 'Anniversary', dateNeeded: iso(5), payReminderSent: '',
        items: [custom(24, 2, 'Hearts and "50" plaques, gold accents')] })),
      totals(order('SN-1009', 'Paid', { createdAt: ago(90), customer: person('Riley Chen', 9), eventType: 'Birthday', dateNeeded: iso(9), pickupWindow: '4:00 PM – 6:00 PM',
        handoff: { date: iso(9), time: '17:00' }, items: [artisan('large', { [f0]: 6, [f2]: 6, [f3]: 12 })] })),
      totals(order('SN-1008', 'Baking', { createdAt: ago(120), customer: person('Avery Patel', 8), eventType: 'Wedding Shower', dateNeeded: iso(3), items: [custom(48, 4, 'Dresses, rings and monograms in sage and white')] })),
      totals(order('SN-1007', 'Completed', { createdAt: ago(300), customer: person('Casey Kim', 7), dateNeeded: iso(-4), items: [artisan('mini', { [f0]: 12 })] })),
      totals(order('SN-1006', 'Declined', { createdAt: ago(200), customer: person('Drew Martin', 6), dateNeeded: iso(4), declineNote: 'So sorry, I’m fully booked that weekend!', items: [custom(24, 1, 'Unicorns')] }))
    ];
    orders.filter((o) => ['Invoice sent', 'Paid', 'Baking', 'Completed'].indexOf(o.status) !== -1).forEach((o) => { o.invoice = invoice(o); });
    const paid = orders.find((o) => o.number === 'SN-1009'); paid.invoice.qb.balance = 0;
    const clsOrder = (num, name, n, qty, status, hours) => totals(order(num, status, { createdAt: ago(hours), type: 'Class', fulfillment: 'class', eventType: '', customer: person(name, n), dateNeeded: cls.date,
      items: [{ kind: 'class', eventId: cls.id, title: cls.title, date: cls.date, start: cls.start, end: cls.end, address: [cls.venue, cls.address].filter(Boolean).join(', '), qty, unit: Number(cls.price) || 60, lineTotal: qty * (Number(cls.price) || 60), summary: SN.classWhen(cls) }] }));
    [clsOrder('SN-1005', 'Jamie Fox', 5, 2, 'Paid', 70), clsOrder('SN-1004', 'Quinn Adams', 4, 1, 'Paid', 80), clsOrder('SN-1003', 'Harper Lane', 3, 3, 'Paid', 100)].forEach((o) => {
      o.invoice = { lines: [{ desc: 'Class: ' + cls.title, qty: o.items[0].qty, unit: o.items[0].unit }], fee: 0, subtotal: o.subtotal, tax: 0, credit: 0, total: o.total, note: '', changed: false, sentAt: o.createdAt };
      orders.push(o);
    });
    return orders;
  }

  function seed() {
    const cfg = seedConfig();
    return {
      v: 1, cfg, draft: null, counter: 1013, photos: {},
      orders: seedOrders(cfg),
      messages: [
        { id: 3, createdAt: ago(2), status: 'New', topic: 'Rush order', name: 'Logan Price', email: 'logan@example.com', phone: '', orderNumber: '', message: 'Hi! Any chance you could do 2 dozen minis for this Saturday? Totally understand if not.', photos: [], photoNames: [], source: 'Contact page' },
        { id: 2, createdAt: ago(26), status: 'New', topic: 'Custom design idea', name: 'Jess Howard', email: 'jess@example.com', phone: '(847) 555-0188', orderNumber: '', message: 'Could you do a pastel unicorn set for my daughter’s 6th birthday? About 24 cookies.', photos: [], photoNames: [], source: 'Contact page' },
        { id: 1, createdAt: ago(72), status: 'Replied', topic: 'Quick message', name: '', email: 'kelly@example.com', phone: '', orderNumber: '', message: 'Do you deliver to Park Ridge?', photos: [], photoNames: [], source: 'Message me',
          replies: [{ at: ago(70), text: 'Hi Kelly! Yes, Park Ridge is in my drop-off area. Just pick drop-off at checkout.', emailStatus: 'Sent (demo)' }] }
      ],
      codes: [
        { code: 'DEMO10', type: 'Percent off', amount: 10, balance: 0, active: true, expires: '', maxUses: 0, uses: 4, note: 'Try it at checkout' },
        { code: 'GIFT-DEMO-25', type: 'Gift card', amount: 25, balance: 25, active: true, expires: '', maxUses: 0, uses: 0, note: 'Try it at checkout' }
      ]
    };
  }

  window.DemoDB = {
    iso,
    load() {
      try { const db = JSON.parse(localStorage.getItem(KEY) || 'null'); if (db && db.v === 1) return db; } catch (e) { /* fall through */ }
      const db = seed();
      this.save(db);
      return db;
    },
    save(db) {
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch (e) { db.photos = {}; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e2) { /* storage full: keep going in memory */ } }
    },
    reset() {
      try {
        localStorage.removeItem(KEY);
        ['sn_live_cfg_v2', 'sn_bag', 'sn_orders', 'sn_config_draft'].forEach((k) => localStorage.removeItem(k));
      } catch (e) { /* ignore */ }
    },
    nextNumber(db) { db.counter = (db.counter || 1013) + 1; return 'SN-' + (db.counter - 1); },
    // Week totals for the admin and the site's weekly limits (cookies counted once an order is approved).
    weeks(db) {
      const counted = ['Invoice sent', 'Paid', 'Baking', 'Ready', 'Completed'];
      const w = {};
      db.orders.filter((o) => o.type !== 'Class' && o.dateNeeded).forEach((o) => {
        const m = SN.mondayOf(o.dateNeeded);
        w[m] = w[m] || { custom: { approved: 0, pending: 0 }, artisan: { approved: 0, pending: 0 } };
        o.items.forEach((it) => {
          const k = it.kind === 'custom' ? 'custom' : 'artisan';
          if (counted.indexOf(o.status) !== -1) w[m][k].approved += it.qty; else if (o.status === 'Pending review') w[m][k].pending += it.qty;
        });
      });
      return w;
    },
    // Spots taken per class (bookings waiting to pay, booked, paid or done).
    seats(db) {
      const s = {};
      db.orders.filter((o) => o.type === 'Class' && ['Awaiting payment', 'Booked', 'Paid', 'Completed'].indexOf(o.status) !== -1)
        .forEach((o) => o.items.forEach((it) => { s[it.eventId] = (s[it.eventId] || 0) + it.qty; }));
      return s;
    }
  };
})();
