// Copies the real site (../sweetnothingsbym) into this portfolio demo and wires in the demo pieces:
//   node tools/sync-from-site.js
// - every page loads demo/demo-db.js + demo/demo-server.js before config.js, and demo/demo-after.js after it
// - config.js: the real Apps Script addresses are replaced with https://demo.invalid/api, so the demo can never
//   reach Melissa's test or live data (demo-server.js answers that address in the browser)
// - pages are marked noindex, so the demo never competes with sweetnothingsbym.com in search
// The demo's own files (admin.html, how-it-works.html, how-its-built.html, demo/, tools/, README.md) aren't touched.
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', '..', 'sweetnothingsbym');
const OUT = path.resolve(__dirname, '..');
const OWN = ['admin.html', 'how-it-works.html', 'how-its-built.html'];
const ASSETS = ['styles.css', 'config.js', 'layout.js', 'order.js', 'admin.js', 'logo.png', 'version.json'];

const pages = fs.readdirSync(SITE).filter((f) => f.endsWith('.html') && OWN.indexOf(f) === -1);
let changed = 0;
const put = (name, data) => { fs.writeFileSync(path.join(OUT, name), data); changed++; };

pages.forEach((f) => {
  let s = fs.readFileSync(path.join(SITE, f), 'utf8');
  if (!/name="robots"/.test(s)) s = s.replace(/(<meta name="viewport"[^>]*>)/, '$1\n<meta name="robots" content="noindex">');
  if (s.indexOf('demo/demo-server.js') === -1) {
    s = s.replace(/(<script src="config\.js[^"]*"><\/script>)/,
      '<script src="demo/demo-db.js"></script>\n<script src="demo/demo-server.js"></script>\n$1\n<script src="demo/demo-after.js"></script>');
  }
  put(f, s);
});

ASSETS.forEach((f) => {
  let data = fs.readFileSync(path.join(SITE, f));
  if (f === 'config.js') {
    let s = data.toString('utf8');
    s = s.replace(/https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/g, 'https://demo.invalid/api');
    if (/script\.google\.com/.test(s)) throw new Error('config.js still mentions script.google.com');
    data = s;
  }
  if (f === 'admin.js') {
    // The admin's "test Sheet" strip becomes a short guide for demo visitors.
    const s = data.toString('utf8');
    const from = 'Test admin: connected to the test Sheet. Emails go out with [TEST] in the subject.';
    if (s.indexOf(from) === -1) throw new Error('admin.js: test strip text not found');
    data = s.replace(from, 'Demo admin: try reviewing and approving an order, replying to a message, adding a phone order or changing a setting, then look at the customer site.');
  }
  if (f === 'order.js') {
    // The "Preview the request email" link shows on the test site; show it in the demo too.
    data = data.toString('utf8').replace("SN_ENV.name === 'uat' && cookieOrder", "(SN_ENV.name === 'uat' || SN_ENV.name === 'demo') && cookieOrder");
  }
  put(f, data);
});

// Every page asks for the demo scripts with a fresh ?v=, so browsers never run an old cached copy.
const stamp = Date.now().toString(36);
fs.readdirSync(OUT).filter((f) => f.endsWith('.html')).forEach((f) => {
  const file = path.join(OUT, f);
  const s = fs.readFileSync(file, 'utf8');
  const t = s.replace(/src="demo\/(demo-[a-z]+\.js)(\?v=[\w]+)?"/g, 'src="demo/$1?v=' + stamp + '"');
  if (t !== s) fs.writeFileSync(file, t);
});

console.log('Synced ' + changed + ' files from ' + SITE + ' (demo scripts ?v=' + stamp + ')');
