// Turns the Vite build into the artifact page: inlines the JS bundle, strips the
// document skeleton (the host adds its own) and copies the runtime textures.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'publish');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'tex'), { recursive: true });

let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dist, 'assets', 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');

const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1];

// keep title, font links and styles from the head; drop charset/viewport (host adds them)
const keep = [];
const title = head.match(/<title>[\s\S]*?<\/title>/i);
if (title) keep.push(title[0]);
for (const m of head.matchAll(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/gi)) keep.push(m[0]);
for (const m of head.matchAll(/<style[\s\S]*?<\/style>/gi)) keep.push(m[0]);

const bodyNoScript = body.replace(/<script[^>]*src="[^"]*app\.js"[^>]*><\/script>/i, '');
const page = `${keep.join('\n')}\n${bodyNoScript.trim()}\n<script type="module">\n${js}\n</script>\n`;
fs.writeFileSync(path.join(out, 'index.html'), page);

for (const f of fs.readdirSync(path.join(dist, 'tex'))) {
  fs.copyFileSync(path.join(dist, 'tex', f), path.join(out, 'tex', f));
}

// local test wrapper that mimics the host skeleton
const test = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>${page}</body></html>`;
fs.writeFileSync(path.join(out, 'test.html'), test);

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log('page', kb(Buffer.byteLength(page)), 'js', kb(Buffer.byteLength(js)));
for (const f of fs.readdirSync(path.join(out, 'tex'))) console.log('tex/' + f, kb(fs.statSync(path.join(out, 'tex', f)).size));
