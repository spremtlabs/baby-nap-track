// The store screenshots: the real app's screens from the web build, with the sample baby loaded.
// Play's are 360x640 scaled 3x to 1080x1920. `--apple` takes the App Store's 6.9 inch iPhone set,
// 430x932 scaled 3x to 1290x2796, into store/assets/app-store, with the sleep diary in place of
// the top of Settings. `npm run check` first, so dist/ is
// the current build.
// Run: node store/shots.mjs, or node store/shots.mjs --apple
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { STORE_KEY, seed } from '../scripts/seed.ts'

const apple = process.argv.includes('--apple')
const out = apple ? 'store/assets/app-store' : 'store/assets'
const size = apple ? { width: 430, height: 932 } : { width: 360, height: 640 }
mkdirSync(out, { recursive: true })
const PUPPETEER = [process.env.CHECK_PUPPETEER, ...(existsSync(`${process.env.HOME}/dev`) ? readdirSync(`${process.env.HOME}/dev`) : []).map((d) => `${process.env.HOME}/dev/${d}/node_modules/puppeteer/lib/puppeteer/puppeteer.js`), 'node_modules/puppeteer/lib/puppeteer/puppeteer.js'].find((p) => p && existsSync(p))
const { default: puppeteer } = await import(pathToFileURL(resolve(PUPPETEER)).href)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' }
const server = createServer((req, res) => {
  let p = join('dist', decodeURIComponent(req.url.split('?')[0]))
  if (!existsSync(p) || statSync(p).isDirectory()) p = join('dist', 'index.html')
  res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p))
})
await new Promise((r) => server.listen(0, r))
const base = `http://127.0.0.1:${server.address().port}/`
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })

async function shot (name, scenario, after) {
  const { state, now } = seed(scenario)
  const page = await browser.newPage()
  await page.setViewport({ ...size, deviceScaleFactor: 3 })
  await page.evaluateOnNewDocument((key, state, now) => {
    // The store shots leave out the card that asks for an email.
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(state), signedUp: true }))
    const Real = Date, offset = now - Real.now()
    class Fake extends Real { constructor (...a) { if (a.length) super(...a); else super(Real.now() + offset) } static now () { return Real.now() + offset } }
    globalThis.Date = Fake
  }, STORE_KEY, state, now)
  await page.goto(base, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 600))
  if (after) await after(page)
  // A browser rings whatever has focus, and a phone draws no ring.
  await page.addStyleTag({ content: '*:focus, *:focus-visible { outline: none !important; }' })
  // The help button floats over the list and covered a nap's length in four of the six App Store
  // shots, so that set leaves it out.
  if (apple) await page.addStyleTag({ content: '[data-testid=help] { display: none !important; }' })
  await page.screenshot({ path: `${out}/${name}.png` })
  await page.close()
}
const tap = (label) => async (page) => {
  await page.evaluate((label) => { const el = [...document.querySelectorAll('[role=button]')].find((e) => e.innerText.trim() === label); el && el.click() }, label)
  await new Promise((r) => setTimeout(r, 900))
}
const scrollTo = (label) => async (page) => {
  await page.evaluate((label) => {
    const el = [...document.querySelectorAll('div')].find((e) => e.textContent === label)
    const sc = document.querySelector('[data-testid=today]')
    if (el && sc) sc.scrollTop = el.getBoundingClientRect().top + sc.scrollTop - 24
  }, label)
  await new Promise((r) => setTimeout(r, 400))
}

// Settings scrolled so the sharing and the sleep diary fill the panel.
const sheetTo = (label) => async (page) => {
  await page.evaluate((label) => {
    const el = [...document.querySelectorAll('div')].find((e) => e.textContent === label)
    let sc = el && el.parentElement
    while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement
    // The group's own line goes just above the panel's edge, so the panel opens on the group's title.
    let g = el
    while (g && g !== sc && !(parseFloat(getComputedStyle(g).borderTopWidth) > 0)) g = g.parentElement
    const top = g && g !== sc ? g.getBoundingClientRect().top + 2 : el.getBoundingClientRect().top - 24
    if (el && sc) sc.scrollTop += top - sc.getBoundingClientRect().top
  }, label)
  await new Promise((r) => setTimeout(r, 400))
}

await shot('01-next-nap', 'morning')
// The chair method, from 1.0.11: night 4 at bedtime with the picture, and the chart the next morning.
// Both stores show them second and third, and the App Store draws the first three in its search results.
await shot('02-chair-bedtime', 'chair', scrollTo('Bedtime window open'))
await shot('03-chair-morning', 'chair-morning', scrollTo('Chair method'))
await shot('04-day-sleep', 'morning', scrollTo('Day sleep'))
await shot('05-nap-needed', 'short')
await shot('06-week', 'morning', scrollTo('This week'))
await shot('07-night', 'night')
// Settings draws the browser's own date box, which an iPhone never shows. The App Store set shows
// the part of Settings below it, with sharing and the sleep diary.
if (!apple) await shot('08-settings', 'morning', tap('Settings'))
else await shot('08-sleep-diary', 'morning', async (page) => { await tap('Settings')(page); await sheetTo("Share Oisín's sleep")(page) })

await browser.close()
server.close()
console.log(`eight screenshots in ${out}`)
