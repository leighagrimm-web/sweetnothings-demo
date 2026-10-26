# Sweet Nothings by M · portfolio demo

A clickable demo of the ordering site and owner admin I built for **Sweet Nothings by M**, a home bakery
([sweetnothingsbym.com](https://www.sweetnothingsbym.com)). It's the real site and admin code, running against a
pretend server inside your browser with sample data. Nothing is saved anywhere or sent to anyone.

- **Customer site** (`index.html`): browse the menu, build a bag, check out (try code `DEMO10`), book a class, send a message.
- **Owner admin** (`admin.html`): review and approve orders, reply to messages, add a phone order, change settings.
  Orders you place on the demo site show up here.
- **How it works** (`how-it-works.html`): every rule and flow behind the site.
- **How it's built** (`how-its-built.html`): the stack and why each piece was chosen.

## How the demo works

- `demo/demo-db.js`: the sample data, kept in the browser's localStorage (the stand-in for the Google Sheet).
- `demo/demo-server.js`: answers the site's requests in the browser (the stand-in for the Apps Script web app).
- `demo/demo-admin.js`: stands in for Apps Script's `google.script.run`, so the real `admin.js` runs unchanged.
- `demo/demo-after.js`: the demo banner, links and "Reset demo data".

## Updating from the real site

```
node tools/sync-from-site.js
```

Copies the current site from `../sweetnothingsbym`, adds the demo scripts to each page, and replaces the real server
addresses with `https://demo.invalid/api` so the demo can never reach real data. Preview locally with
`node tools/serve.js` (http://localhost:5600).

Built by Leigha Grimm.
