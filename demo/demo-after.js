/*
 * Portfolio demo: runs right after config.js on every page. Marks the environment as the demo and adds the
 * banner: what this is, links between the customer site / admin / write-ups, and "Reset demo data".
 */
(function () {
  SN_ENV.name = 'demo';
  SN_ENV.admin = 'admin.html';

  const here = location.pathname.split('/').pop() || 'index.html';
  const link = (href, label) => '<a href="' + href + '"' + (here === href ? ' aria-current="page"' : '') + '>' + label + '</a>';
  const bar = document.createElement('div');
  bar.className = 'demo-bar';
  bar.setAttribute('role', 'note');
  bar.innerHTML =
    '<div class="demo-bar-in">' +
      '<span class="demo-bar-what"><strong>Portfolio demo</strong> · fake data, nothing is saved or sent · built by Leigha Grimm for Sweet Nothings by M</span>' +
      '<nav aria-label="Demo">' + link('index.html', 'Customer site') + link('admin.html', 'Owner admin') + link('how-it-works.html', 'How it works') + link('how-its-built.html', 'How it’s built') +
        '<button type="button" id="demo-reset">Reset demo data</button></nav>' +
    '</div>';
  const add = () => document.body.insertBefore(bar, document.body.firstChild);
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#demo-reset')) return;
    if (!confirm('Put the sample orders, messages and settings back? Anything you changed in the demo is cleared.')) return;
    DemoDB.reset();
    location.reload();
  });

  const css = document.createElement('style');
  css.textContent =
    '.demo-bar{background:#2C3756;color:#E4E7EE;font:500 13px/1.4 "DM Sans",system-ui,sans-serif;position:relative;z-index:70}' +
    '.demo-bar-in{max-width:1180px;margin:0 auto;padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;justify-content:space-between}' +
    '.demo-bar strong{color:#fff}' +
    '.demo-bar nav{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center}' +
    '.demo-bar a{color:#F7E3DD;text-decoration:none;border-bottom:1px solid transparent}' +
    '.demo-bar a:hover,.demo-bar a[aria-current]{border-bottom-color:#F7E3DD}' +
    '.demo-bar button{font:inherit;color:#1F2A44;background:#F7E3DD;border:0;border-radius:999px;padding:4px 12px;cursor:pointer}';
  document.head.appendChild(css);
})();
