/**
 * Assembles the shareable design-review page from the real Landing component.
 *
 *   npm run build:share -- <outPath>
 *
 * Nothing here is hand-written markup, which is the whole point. The previous
 * share file was hand-converted from the app and drifted from it twice — once
 * badly enough that a mismatched closing tag silently swallowed the entire nav.
 * Rendering the actual component means the share can only be wrong in the same
 * way the product is wrong.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const OUT = process.argv[2] ?? 'share.html'
const entry = fileURLToPath(new URL('../dist-share/share-entry.js', import.meta.url))
const { render } = await import(pathToFileURL(entry).href)

let body = render()

// App routes become in-page anchors where the landing page has an equivalent
// section, and inert otherwise. The share is a single page; a link that
// navigates nowhere reads as a bug during a design review.
const ROUTES = {
  '/': '#top',
  '/features': '#guard',
  '/features#guard': '#guard',
  '/pricing': '#pricing',
  '/about': '#audience',
}
body = body.replace(/href="(\/[^"]*)"/g, (_m, href) => `href="${ROUTES[href] ?? '#'}"`)

// No IntersectionObserver runs in a static page, so reveal everything up front.
body = body.replace(/data-reveal(?!ed)/g, 'data-reveal data-revealed="true"')

const css = readFileSync(new URL('../src/landing.css', import.meta.url), 'utf8')

const page = `<title>ViralPilot Landing</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${css}
body { margin: 0; background: #fff; }
.lp-review { background: #0b1a15; padding: 20px 0; }
.lp-review-inner { width: min(1180px, 100% - 44px); margin-inline: auto; display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: baseline; justify-content: space-between; font-family: Inter, system-ui, sans-serif; }
.lp-review-inner p { margin: 0; color: #b9d3c8; font-size: 13.5px; line-height: 1.55; }
.lp-review-inner strong { color: #12b473; font-weight: 600; }
/* Static copy: the scroll reveals are pre-applied. */
[data-reveal] { opacity: 1 !important; transform: none !important; }
</style>
<div class="lp-review"><div class="lp-review-inner">
<p><strong>ViralPilot — landing page, design review.</strong> Rendered from the live app. Links are inert here.</p>
<p>The live site also has Features, Pricing and About pages</p>
</div></div>
<div id="top"></div>
${body}
`

writeFileSync(OUT, page)

// Verify rather than assume. These are exactly the things that broke before.
const count = (re) => (page.match(re) || []).length
const navBlock = (body.match(/class="lp-nav-links"[\s\S]*?<\/nav>/) || [''])[0]
const labels = [...navBlock.matchAll(/>([^<>]{3,30})<\/(?:a|button)>/g)].map((m) => m[1].trim())

const report = {
  out: OUT,
  bytes: page.length,
  navLabels: labels,
  navClosedProperly: /<\/nav>/.test(navBlock),
  tagBalance: {
    div: [count(/<div\b/g), count(/<\/div>/g)],
    nav: [count(/<nav\b/g), count(/<\/nav>/g)],
    header: [count(/<header\b/g), count(/<\/header>/g)],
  },
}

const balanced = Object.values(report.tagBalance).every(([o, c]) => o === c)
console.log(JSON.stringify(report, null, 1))

if (!balanced || labels.length < 3) {
  console.error('\nFAILED: nav markup is not intact — refusing to publish this.')
  process.exit(1)
}
console.log('\nOK — nav intact, tags balanced.')
