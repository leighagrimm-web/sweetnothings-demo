/*
 * Portfolio demo: stands in for google.script.run, so the real admin (admin.js) runs unchanged against DemoDB.
 * Every action does what the real one does to the "Sheet" (status changes, invoices, replies, codes, settings);
 * emails and QuickBooks/Square calls are simulated and marked "(demo)".
 */
(function () {
  const iso = (n) => DemoDB.iso(n);
  const now = () => new Date().toISOString();
  let db;
  const find = (n) => db.orders.find((o) => o.number === n);
  const weeks = () => DemoDB.weeks(db);
  const withSeats = (cfg) => {
    const c = SN.clone(cfg);
    const seats = DemoDB.seats(db);
    c.events = (c.events || []).map((e) => Object.assign(e, { booked: seats[e.id] || 0 }, e.max !== '' && e.max != null ? { spotsLeft: Math.max(0, Number(e.max) - (seats[e.id] || 0)) } : {}));
    return c;
  };
  const fakeQb = (o, total) => ({ id: 'Q' + o.number, docNumber: String(2000 + Number(String(o.number).slice(3))), total: Math.round(total * 1.0225 * 100) / 100,
    tax: Math.round(total * 0.0225 * 100) / 100, balance: Math.round(total * 1.0225 * 100) / 100, link: '#demo-pay', env: 'demo' });

  const api = {
    adminLoad: () => ({ config: withSeats(db.cfg), stamp: 'demo-' + (db.stamp || 1), draft: db.draft, orders: SN.clone(db.orders), messages: SN.clone(db.messages), codes: SN.clone(db.codes), weekCounts: weeks(), sheetUrl: '#demo-sheet', today: iso(0) }),
    adminSaveSettings: (c) => {
      db.cfg = Object.assign(db.cfg, c); db.draft = null; db.stamp = (db.stamp || 1) + 1;
      try { localStorage.removeItem('sn_live_cfg_v2'); } catch (e) { /* the site re-reads settings next page */ }
      return { ok: true, config: withSeats(db.cfg), stamp: 'demo-' + db.stamp };
    },
    adminSaveDraft: (c) => { db.draft = c; try { localStorage.setItem('sn_config_draft', JSON.stringify(c)); } catch (e) { /* ignore */ } return { ok: true }; },
    adminClearDraft: () => { db.draft = null; return { ok: true }; },
    adminApprove: (n, inv) => {
      const o = find(n);
      if (o.status !== 'Pending review') return { ok: false, error: n + ' is already ' + o.status + '.' };
      const t = SN.invoiceTotals(inv.lines, inv.fee, 0, o.giftCredit);
      o.invoice = Object.assign({ lines: inv.lines, fee: inv.fee, note: inv.note, changed: false, sentAt: now(), emailStatus: 'Sent (demo)' }, t);
      o.invoice.qb = fakeQb(o, t.total);
      o.status = 'Invoice sent';
      return { ok: true, order: SN.clone(o), weekCounts: weeks() };
    },
    adminDecline: (n, note) => { const o = find(n); o.status = 'Declined'; o.declineNote = note; return { ok: true, order: SN.clone(o), emailStatus: 'Sent (demo)', weekCounts: weeks() }; },
    adminResendConfirmation: (n) => ({ ok: true, order: SN.clone(find(n)), weekCounts: weeks() }),
    adminSetStatus: (n, s) => { find(n).status = s; return { ok: true, weekCounts: weeks() }; },
    adminMessageCustomer: (n, text) => { const o = find(n); o.messages = (o.messages || []).concat([{ at: now(), text, emailStatus: 'Sent (demo)' }]); return { ok: true, order: SN.clone(o), emailStatus: 'Sent (demo)' }; },
    adminChangeDate: (n, d, notify, note) => {
      const o = find(n); const old = o.dateNeeded; o.dateNeeded = d;
      if (notify) o.messages = (o.messages || []).concat([{ at: now(), text: 'Your order’s date has changed from ' + old + ' to ' + d + '.' + (note ? '\n\n' + note : ''), emailStatus: 'Sent (demo)' }]);
      return { ok: true, order: SN.clone(o), emailStatus: notify ? 'Sent (demo)' : '', weekCounts: weeks() };
    },
    adminSetHandoff: (n, d, t, notify, note) => {
      const o = find(n); o.handoff = { date: d, time: t }; o.reminderSent = '';
      if (notify) o.messages = (o.messages || []).concat([{ at: now(), text: 'Time confirmed: ' + SN.prettyDate(d) + ' at ' + SN.time12(t) + (note ? '\n\n' + note : ''), emailStatus: 'Sent (demo)' }]);
      return { ok: true, order: SN.clone(o), emailStatus: notify ? 'Sent (demo)' : '' };
    },
    adminCreateOrder: (b) => {
      const need = [];
      if (!String(b.customer.name || '').trim()) need.push('name');
      if (!SN.validEmail(b.customer.email)) need.push('a valid email');
      if (!b.items.length) need.push('at least one item');
      const cookies = b.items.filter((it) => it.kind !== 'class');
      if (cookies.length && !b.dateNeeded) need.push('date needed');
      if (need.length) return { ok: false, code: 'invalid', errors: need };
      if (cookies.some((it) => it.kind === 'custom' && Number(it.qty) < (db.cfg.minQty || 12)) && !b.confirmWarnings) return { ok: false, code: 'warn', warnings: ['Custom Cookies: at least ' + (db.cfg.minQty || 12) + ' cookies'] };
      const per = (k) => (k === 'mini' ? db.cfg.miniPerDozen : db.cfg.largePerDozen) / 12;
      const items = cookies.map((it) => {
        if (it.kind === 'custom') { const unit = Number(it.unit) || Number(db.cfg.customBasePrice) || 5; return { kind: 'custom', qty: Number(it.qty), designs: Number(it.designs), desc: it.desc, unit, lineTotal: Number(it.qty) * unit, summary: it.designs + ' design' + (it.designs > 1 ? 's' : '') }; }
        const qty = Object.keys(it.fq).reduce((a, id) => a + (Number(it.fq[id]) || 0), 0);
        return { kind: it.kind, qty, fq: it.fq, unit: per(it.kind), lineTotal: qty * per(it.kind), summary: Object.keys(it.fq).filter((id) => Number(it.fq[id]) > 0).map((id) => it.fq[id] + ' ' + ((db.cfg.flavors.find((f) => f.id === id) || {}).name || id)).join(', ') };
      });
      const zone = b.fulfillment === 'delivery' ? db.cfg.zones.find((z) => z.zip === (b.address || {}).zip) : null;
      const fee = b.fulfillment === 'delivery' ? (b.deliveryFee !== '' && b.deliveryFee != null ? Number(b.deliveryFee) || 0 : zone ? Number(zone.fee) || 0 : 0) : 0;
      const subtotal = items.reduce((a, it) => a + it.lineTotal, 0);
      const num = DemoDB.nextNumber(db);
      const o = { number: num, type: 'Cookies', createdAt: now(), status: 'Pending review', items, eventType: b.eventType === 'Other' ? 'Other: ' + b.eventOther : b.eventType, dateNeeded: b.dateNeeded,
        allergies: b.allergies, eventTime: b.eventTime, pickupWindow: b.pickupWindow, fulfillment: b.fulfillment, address: b.fulfillment === 'delivery' ? b.address : null,
        customer: { name: b.customer.name, email: b.customer.email, phone: SN.formatPhone(b.customer.phone || '') }, subtotal, discount: 0, tax: 0, deliveryFee: fee, giftCredit: 0, total: subtotal + fee,
        taxRate: 0, promoCode: '', invoice: null, declineNote: '', messages: [], emailStatus: 'Not sent (phone order)', byPhone: true };
      db.orders.push(o);
      const res = { ok: true, orders: [{ number: num, type: 'Cookies' }], order: { number: num, type: 'Cookies' }, weekCounts: weeks() };
      if (b.approve) {
        const lines = items.map((it) => ({ desc: it.qty + ' ' + SN.itemLabel(it.kind) + (it.summary ? ' (' + it.summary + ')' : ''), qty: it.qty, unit: it.unit }));
        if (String(b.extraDesc || '').trim() && Number(b.extraAmount)) lines.push({ desc: b.extraDesc, qty: 1, unit: Number(b.extraAmount) });
        const a = api.adminApprove(num, { lines, fee, note: b.note || '' });
        res.approved = a.ok; res.approvedOrder = a.order;
      }
      return res;
    },
    adminSaveCode: (c, original) => {
      const code = String(c.code).toUpperCase();
      if (!/^[A-Z0-9-]{3,40}$/.test(code)) return { ok: false, error: 'Codes use letters, numbers and dashes (3 or more).' };
      const i = db.codes.findIndex((x) => x.code === (original || code));
      const row = { code, type: c.type, amount: Number(c.amount), balance: c.type === 'Gift card' ? (i === -1 ? Number(c.amount) : Number(c.balance)) : 0, active: c.active !== false, expires: c.expires || '', maxUses: Number(c.maxUses) || 0, uses: i === -1 ? 0 : db.codes[i].uses, note: c.note || '' };
      if (i === -1) db.codes.push(row); else db.codes[i] = row;
      return { ok: true, codes: SN.clone(db.codes) };
    },
    adminDeleteCode: (code) => { db.codes = db.codes.filter((x) => x.code !== code); return { ok: true, codes: SN.clone(db.codes) }; },
    adminSetMessageStatus: (id, s) => { db.messages.find((m) => m.id === id).status = s; return { ok: true }; },
    adminReplyMessage: (id, text) => {
      const m = db.messages.find((x) => x.id === id);
      m.replies = (m.replies || []).concat([{ at: now(), text, emailStatus: 'Sent (demo)' }]);
      m.status = 'Replied';
      return { ok: true, message: SN.clone(m), emailStatus: 'Sent (demo)' };
    },
    adminDeleteMessage: (id) => { db.messages = db.messages.filter((m) => m.id !== id); return { ok: true }; },
    adminPayments: () => ({
      qb: { keys: true, env: 'demo', connected: true, company: 'Sweet Nothings (demo company)', items: { custom: '1' }, error: '' },
      square: { ready: true, env: 'demo', location: 'Sweet Nothings (demo location)', error: '' },
      lastCheck: { at: now(), invoicesPaid: [], classesPaid: [], expired: [], completed: [], errors: [] },
      trigger: true, healthTrigger: true, callbackUrl: ''
    }),
    adminQbConnectUrl: () => '#demo',
    adminQbDisconnect: () => ({ ok: true }),
    adminQbSetupItems: () => ({ ok: true, items: {} }),
    // In the demo, "Check payments now" pretends every open invoice was just paid in QuickBooks.
    // The morning health check: in the demo everything is always working.
    adminRunHealthCheck: () => ({ at: now(), problems: [] }),
    // Refresh website: the demo site re-reads settings on its next page.
    adminRefreshSite: () => { try { localStorage.removeItem('sn_live_cfg_v2'); } catch (e) { /* ignore */ } return { ok: true }; },
    adminCheckPaymentsNow: () => {
      const paid = db.orders.filter((o) => o.status === 'Invoice sent' && o.invoice && o.invoice.qb);
      paid.forEach((o) => { o.status = 'Paid'; o.invoice.qb.balance = 0; });
      return { ok: true, invoicesPaid: paid.map((o) => o.number), classesPaid: [], expired: [], completed: [], errors: [] };
    },
    adminRetryInvoice: (n) => { const o = find(n); delete o.invoice.qbError; o.invoice.qb = fakeQb(o, o.invoice.total); return { ok: true, order: SN.clone(o), weekCounts: weeks() }; },
    // Inspiration photos: the ones demo visitors uploaded, else a soft placeholder.
    adminPhoto: (id) => {
      if (db.photos && db.photos[id]) return db.photos[id];
      const c = document.createElement('canvas'); c.width = 360; c.height = 280;
      const g = c.getContext('2d'); g.fillStyle = '#F7E3DD'; g.fillRect(0, 0, 360, 280); g.fillStyle = '#C8553D'; g.beginPath(); g.arc(180, 140, 80, 0, 7); g.fill();
      return c.toDataURL('image/jpeg', 0.8);
    }
  };

  // google.script.run.withSuccessHandler(ok).withFailureHandler(fail).someFunction(args) -> api.someFunction(args),
  // with a short wait like the real server, then saved back to the browser.
  function runner(ok, fail) {
    return new Proxy({}, {
      get(_, name) {
        if (name === 'withSuccessHandler') return (f) => runner(f, fail);
        if (name === 'withFailureHandler') return (f) => runner(ok, f);
        return (...args) => setTimeout(() => {
          try {
            db = DemoDB.load();
            if (!api[name]) throw new Error('The demo doesn’t do “' + String(name) + '”.');
            const r = api[name](...JSON.parse(JSON.stringify(args)));
            DemoDB.save(db);
            ok && ok(JSON.parse(JSON.stringify(r)));
          } catch (e) { fail && fail(e); }
        }, 300 + Math.random() * 300);
      }
    });
  }
  window.google = { script: { run: runner(null, null) } };
})();
