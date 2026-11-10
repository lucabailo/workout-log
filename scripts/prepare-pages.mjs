// Finishes the web export for GitHub Pages: makes it installable on the home screen,
// enables SQLite in the browser, and lets links to any screen load the app.
// Usage: node scripts/prepare-pages.mjs <dist dir> <base path, e.g. /workout-log>
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dist = 'dist', base = ''] = process.argv.slice(2);
const indexPath = join(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');

const head = [
  // SQLite on the web needs SharedArrayBuffer, which needs two isolation headers.
  // GitHub Pages can't send headers, so this service worker adds them (first visit reloads once).
  `<script src="${base}/coi-serviceworker.js"></script>`,
  `<link rel="manifest" href="${base}/manifest.webmanifest" />`,
  `<link rel="apple-touch-icon" href="${base}/icons/apple-touch-icon.png" />`,
  '<meta name="theme-color" content="#E8501E" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Workout Log" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
].join('\n    ');

if (!html.includes('coi-serviceworker')) {
  html = html.replace('<title>', `${head}\n    <title>`);
  // No pinch-zoom: it behaves like an app, and inputs don't zoom the page on iPhone.
  html = html.replace(
    'content="width=device-width, initial-scale=1, shrink-to-fit=no"',
    'content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"',
  );
}
writeFileSync(indexPath, html);

// GitHub Pages serves 404.html for unknown paths: the app then opens the right screen itself.
copyFileSync(indexPath, join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`Prepared ${dist} for ${base || '/'}`);
