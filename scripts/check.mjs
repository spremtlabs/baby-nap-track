// The gate. `npm run check` runs the type check and the tests first, then this: guards on the
// source, then the web build of the real app walked in a headless browser at phone size through
// setup with this morning's nap, the morning, a nap and its timer, Settings, editing a sleep, the 4pm example,
// the 5 October evening, a stretch with no nap logged, going out, the help chat,
// the night, the chair method at bedtime, settling and the next morning, and at ten weeks, last night changed from
// the list and from the toast after up for the day, the sleep diary
// for a consultant printed on A4, the next morning
// with the night not logged and then added, a phone set up on version 1.0.0, the free week, the
// nap times locked after it, a purchase and a pending one, and a shared log paid for on the other phone.
// Then the same web build answers as an iPhone, from mock iphone-trial-and-counts v1: the question
// about usage counts, the free week started from the `7-day Trial` item or put off with Not now, an
// App Store with no such item, and an Apple Account that had its week already.
// Every walk also reads what the app would have sent PostHog: the steps of the free week, and no
// name, sleep time or field outside the list below. On an iPhone it reads that nothing went before
// the parent said yes. Nothing ships that has not been through it.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { seed, STORE_KEY } from './seed.ts'

const FAKE_PLAY_KEY = 'snug.fakeplay'
const EVENTS_KEY = 'snug.events'
// The only fields an event may carry. Anything else, and the baby's name anywhere, fails the gate.
const FIELDS = new Set(['naps', 'day', 'gate', 'sleeps', 'shared', 'price', 'outcome', 'late', 'source', 'medium', 'campaign', 'ad', 'distinct_id', 'product', 'app_version', 'platform', '$process_person_profile', '$geoip_disable', '$lib'])
const DAY = 864e5
// A seeded phone that has already met Play's price, `ago` days back.
const paidSeed = (scenario, paid) => { const x = seed(scenario), st = JSON.parse(x.state); st.paid = { price: '€9.99', trialFrom: null, owned: false, sharedPaid: false, ...paid(x.now) }; return { state: JSON.stringify(st), now: x.now } }

const fails = []
const fail = (where, what) => fails.push(`${where}: ${what}`)
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p] })

/* 1. The source */
const app = ['App.tsx', ...walk('src')].filter((p) => /\.tsx?$/.test(p))
for (const p of app) {
  const body = readFileSync(p, 'utf8')
  if (/test\/sample|scripts\/seed/.test(body)) fail(p, 'imports the sample baby. The app starts empty.')
  if (/—/.test(body)) fail(p, 'has an em dash')
  if (/successfully/i.test(body)) fail(p, 'says successfully. The toast is the success.')
  if (/Newsreader|serif/i.test(body)) fail(p, 'uses a serif. The app is one sans.')
  // The app was called Snug until 8 October 2026.
  if (/\bSnug\b/.test(body.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ''))) fail(p, 'says Snug. The app is called Baby Nap Track.')
  if (/\b(he|she|his|her|him)\b/.test(body.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '').match(/`[^`]*`|'[^'\n]*'/g)?.join(' ') ?? '')) fail(p, 'uses a pronoun for the baby in a string. Use the name.')
}

/* 1b. The iPhone build. The repo was Android's alone until 5 October 2026. Each line below is a
   thing Apple refuses a build or a review for, and none of them shows in the web walk. */
{
  const expo = JSON.parse(readFileSync('app.json', 'utf8')).expo
  const ios = expo.ios ?? {}
  // The name under the icon on both phones, and the one Apple matches against the App Store name.
  if (expo.name !== 'Baby Nap Track' || expo.web?.name !== 'Baby Nap Track') fail('app.json', `the app is called ${expo.name}, and its name is Baby Nap Track`)
  if (/\bSnug\b/.test(JSON.stringify(expo))) fail('app.json', 'says Snug. The app is called Baby Nap Track.')
  for (const f of ['store/listing.md', 'store/app-store.md']) {
    const md = readFileSync(f, 'utf8')
    if (!/^## (Title|Name)\n\nBaby Nap Track: /m.test(md)) fail(f, 'the store name does not start with Baby Nap Track')
    if (/\bSnug\b/.test(md.replace(/`[^`]*`/g, '').replace(/called Snug until/g, ''))) fail(f, 'says Snug outside a quote. The app is called Baby Nap Track.')
  }
  if (ios.bundleIdentifier !== 'com.spremtlabs.babysleep') fail('app.json', 'the iPhone build has no bundleIdentifier com.spremtlabs.babysleep, so nothing can be uploaded')
  if (ios.config?.usesNonExemptEncryption !== false) fail('app.json', 'ios.config.usesNonExemptEncryption is unanswered, so every upload stops on the export question')
  // React Native reads these four, and Apple refuses an upload that does not give a reason for each.
  const reasons = Object.fromEntries((ios.privacyManifests?.NSPrivacyAccessedAPITypes ?? []).map((x) => [x.NSPrivacyAccessedAPIType, x.NSPrivacyAccessedAPITypeReasons ?? []]))
  for (const [api, why] of [['UserDefaults', 'CA92.1'], ['FileTimestamp', 'C617.1'], ['SystemBootTime', '35F9.1'], ['DiskSpace', 'E174.1']]) {
    if (!reasons[`NSPrivacyAccessedAPICategory${api}`]?.includes(why)) fail('app.json', `the privacy manifest gives no reason ${why} for ${api}, and Apple refuses that upload`)
  }
  // What leaves the phone: the baby's name and the sleeps once a log is shared, the help chat and
  // the email typed into it, and the counts PostHog gets. The App Privacy answers in
  // store/app-store.md say the same, and nothing is used to track anyone.
  const collected = ios.privacyManifests?.NSPrivacyCollectedDataTypes ?? []
  for (const kind of ['Name', 'Health', 'EmailAddress', 'CustomerSupport', 'ProductInteraction']) {
    if (!collected.some((x) => x.NSPrivacyCollectedDataType === `NSPrivacyCollectedDataType${kind}`)) fail('app.json', `the privacy manifest leaves out ${kind}, which Baby Nap Track sends off the phone`)
  }
  // react-native-share carries an Instagram path that can reach Photos. Baby Nap Track never takes it, and Apple
  // still refused build 2 on 8 October 2026 with ITMS-90683 until both purpose strings were there.
  for (const key of ['NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription']) {
    if (!ios.infoPlist?.[key]) fail('app.json', `ios.infoPlist has no ${key}, and Apple refuses the upload with ITMS-90683`)
  }
  if (ios.privacyManifests?.NSPrivacyTracking !== false || collected.some((x) => x.NSPrivacyCollectedDataTypeTracking !== false)) fail('app.json', 'the privacy manifest says Baby Nap Track tracks people, and it does not')
  const eas = JSON.parse(readFileSync('eas.json', 'utf8'))
  if (!eas.build?.production?.ios) fail('eas.json', 'the production profile builds for Android only, so there is no iPhone build to submit')
  if (!eas.submit?.production?.ios) fail('eas.json', 'eas submit has no iPhone profile')
  // eas reads only the key's path, issuer and id from the environment. Any other `$NAME` in an
  // iPhone submit profile stays as those letters, and eas submit stops on it.
  for (const [name, p] of Object.entries(eas.submit ?? {})) {
    for (const [k, v] of Object.entries(p.ios ?? {})) {
      if (typeof v === 'string' && v.includes('$') && !['ascApiKeyPath', 'ascApiKeyIssuerId', 'ascApiKeyId'].includes(k)) fail('eas.json', `submit.${name}.ios.${k} is ${v}, which eas never reads from the environment`)
    }
  }
  // The App Store takes the sku on its own key. Without it an iPhone opens no purchase sheet.
  if (!/apple:\s*\{\s*sku:\s*SKU/.test(readFileSync('src/lib/billing.ts', 'utf8'))) fail('src/lib/billing.ts', 'the purchase asks Google Play only, so an iPhone cannot pay')
  // Apple's guideline 3.1.1: the free week on an iPhone is a free non-consumable named for its length,
  // `7-day Trial`, with the product id App Store Connect holds. The app, the purchase and the steps in
  // store/app-store.md name the same item, and the purchase asks the App Store alone.
  const shop = readFileSync('src/lib/shop.ts', 'utf8'), billing = readFileSync('src/lib/billing.ts', 'utf8'), listing = readFileSync('store/app-store.md', 'utf8')
  const sku = shop.match(/export const TRIAL_SKU = '([^']*)'/)?.[1], name = shop.match(/export const TRIAL_NAME = '([^']*)'/)?.[1]
  if (sku !== 'snug_trial') fail('src/lib/shop.ts', `the free week item is ${sku}, and App Store Connect holds snug_trial`)
  if (name !== '7-day Trial') fail('src/lib/shop.ts', `the free week item is called ${name}, and Apple asks for a name like 7-day Trial`)
  if (!/requestPurchase\(\{ request: \{ apple: \{ sku: TRIAL_SKU \} \}, type: 'in-app' \}\)/.test(billing)) fail('src/lib/billing.ts', 'the free week is not bought from the App Store as the TRIAL_SKU item on its own')
  for (const w of ['`snug_trial`', '`7-day Trial`', 'Non-Consumable', 'Price: Free']) if (!listing.includes(w)) fail('store/app-store.md', `the steps for the free week item never say ${w}`)
  // Google is named only where the store's name is chosen for the phone.
  for (const p of app.filter((p) => !/src\/lib\/(shop|billing)\.ts$/.test(p))) {
    for (const m of readFileSync(p, 'utf8').replace(/\/\/.*$/gm, '').matchAll(/[`'"][^`'"\n]*\b(Google|Play)\b[^`'"\n]*[`'"]/g)) fail(p, `names Google in a line an iPhone shows: ${m[0]}`)
  }
}

/* 2. The web build of the real app */
const PUPPETEER = [process.env.CHECK_PUPPETEER, ...['astera', 'astera-anatomy', 'astera-arrival', 'astera-companion'].map((d) => `${process.env.HOME}/dev/${d}/node_modules/puppeteer/lib/puppeteer/puppeteer.js`), 'node_modules/puppeteer/lib/puppeteer/puppeteer.js']
  .find((p) => p && existsSync(p))
if (!PUPPETEER) fail('gate', 'no puppeteer to walk the app with. Set CHECK_PUPPETEER or npm i -D puppeteer.')

if (PUPPETEER && !fails.length) {
  execSync('npx expo export --platform web --output-dir dist', { stdio: 'pipe' })
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' }
  const server = createServer((req, res) => {
    let p = join('dist', decodeURIComponent(req.url.split('?')[0]))
    if (!existsSync(p) || statSync(p).isDirectory()) p = join('dist', 'index.html')
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' })
    res.end(readFileSync(p))
  })
  await new Promise((r) => server.listen(0, r))
  const base = `http://127.0.0.1:${server.address().port}/`
  // A path from the folder the gate runs in. Handed to import() as it is, `node_modules/...` is read
  // as a package called node_modules, which stopped the gate on GitHub's runner from 1.0.5 on.
  const { default: puppeteer } = await import(pathToFileURL(resolve(PUPPETEER)).href)
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const shots = process.env.SHOTS
  if (shots) mkdirSync(shots, { recursive: true })

  // Each phone gets its own browser profile, so no two share storage.
  const open = async (name, { state = null, now, play = null }) => {
    const page = await (await browser.createBrowserContext()).newPage()
    page.errors = []
    page.on('pageerror', (e) => page.errors.push(String(e)))
    page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()) })
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
    await page.evaluateOnNewDocument((key, state, now, playKey, play) => {
      if (state && !sessionStorage.getItem('seeded')) { localStorage.setItem(key, state); sessionStorage.setItem('seeded', '1') }
      if (play && !localStorage.getItem(playKey)) localStorage.setItem(playKey, play)
      const Real = Date, offset = now - Real.now()
      class Fake extends Real { constructor (...a) { if (a.length) super(...a); else super(Real.now() + offset) } static now () { return Real.now() + offset } }
      globalThis.Date = Fake
    }, STORE_KEY, state, now, FAKE_PLAY_KEY, play ? JSON.stringify(play) : null)
    await page.goto(base, { waitUntil: 'networkidle0' })
    page.label = name
    return page
  }
  const text = (page) => page.evaluate(() => document.body.textContent)
  const expect = async (page, want) => {
    for (let i = 0; i < 30; i++) { if ((await text(page)).includes(want)) return true; await new Promise((r) => setTimeout(r, 100)) }
    fail(page.label, `the screen never said "${want}"`)
    return false
  }
  const tap = async (page, label) => {
    const ok = await page.evaluate((label) => {
      const all = [...document.querySelectorAll('[role=button],[role=switch],button,[aria-label]')]
      const el = all.find((e) => e.getAttribute('aria-label') === label) || all.find((e) => e.innerText && e.innerText.trim() === label)
      if (!el) return false
      el.click(); return true
    }, label)
    if (!ok) fail(page.label, `nothing to tap called "${label}"`)
    await new Promise((r) => setTimeout(r, 400))
  }
  const look = async (page, name) => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    if (w[0] > w[1] + 1) fail(page.label, `the page is ${w[0]}px wide in ${w[1]}px`)
    if (shots) await page.screenshot({ path: `${shots}/${name}.png` })
  }
  // What the web build kept in place of sending it to PostHog.
  const sent = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), EVENTS_KEY)
  const expectSent = async (page, event, fields = {}) => {
    for (let i = 0; i < 40; i++) {
      const hit = (await sent(page)).find((e) => e.event === event && Object.entries(fields).every(([k, v]) => e.properties[k] === v))
      if (hit) return hit
      await new Promise((r) => setTimeout(r, 100))
    }
    fail(page.label, `PostHog never got ${event} ${JSON.stringify(fields)}`)
  }
  const count = async (page, event) => (await sent(page)).filter((e) => e.event === event).length
  const done = async (page) => {
    for (const e of page.errors) fail(page.label, e)
    for (const e of await sent(page)) {
      for (const k of Object.keys(e.properties)) if (!FIELDS.has(k)) fail(page.label, `${e.event} carries ${k}`)
      if (/Oisín|Cian/.test(JSON.stringify(e))) fail(page.label, `${e.event} carries the baby's name`)
      if (e.properties.product !== 'snug') fail(page.label, `${e.event} is not marked product: snug`)
    }
  }
  // Sets a time field the way the phone's clock would.
  const setTime = async (page, id, hhmm) => {
    const ok = await page.evaluate((id, v) => {
      const el = document.querySelector(`[data-testid=${id}]`)
      if (!el) return false
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }, id, hhmm)
    if (!ok) fail(page.label, `no time field called ${id}`)
    await new Promise((r) => setTimeout(r, 300))
  }
  const absent = async (page, what) => { if ((await text(page)).includes(what)) fail(page.label, `the screen said "${what}"`) }
  // Taps the control whose label starts with these words, for a row whose time is worked out.
  const tapStart = async (page, start) => {
    const ok = await page.evaluate((s) => { const el = [...document.querySelectorAll('[aria-label]')].find((e) => e.getAttribute('aria-label').startsWith(s)); if (!el) return false; el.click(); return true }, start)
    if (!ok) fail(page.label, `nothing to tap starting "${start}"`)
    await new Promise((r) => setTimeout(r, 400))
  }
  // Scrolls the Today screen until the words are near the top, for the picture.
  const scrollTo = async (page, words) => {
    await page.evaluate((w) => {
      const box = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(d).overflowY))
      const el = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === w && d.children.length <= 1)
      if (box && el) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 120
    }, words)
    await new Promise((r) => setTimeout(r, 300))
  }
  const disabled = (page, label) => page.evaluate((l) => [...document.querySelectorAll('[role=button]')].filter((e) => e.innerText.trim() === l).some((e) => e.getAttribute('aria-disabled') === 'true'), label)

  // Setup, from an empty phone.
  {
    const now = new Date(); now.setHours(10, 0, 0, 0)
    const p = await open('setup', { now: now.getTime() })
    // Setup asks for the parent's email from 1.0.14. The call is answered here and kept, so the
    // walk can read what went, and no test address reaches the database.
    const signups = []
    await p.setRequestInterception(true)
    p.on('request', (r) => {
      if (!r.url().includes('/rpc/sleep_signup')) return r.continue()
      if (r.method() === 'POST') signups.push(JSON.parse(r.postData() || '{}'))
      r.respond({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }, contentType: 'application/json', body: r.method() === 'OPTIONS' ? '' : '{"ok":true}' })
    })
    await expect(p, "Let's get your first nap time.")
    await expect(p, "We'll email you sleep tips as your baby grows.")
    await look(p, 'setup-1')
    await p.type('[data-testid=name]', 'Cian')
    await p.type('[data-testid=email]', 'nope')
    await expect(p, "That doesn't look like an email address yet.")
    await p.evaluate(() => { const el = document.querySelector('[data-testid=email]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })) })
    await p.type('[data-testid=email]', 'parent@example.com')
    await p.evaluate(() => {
      const el = document.querySelector('[data-testid=born]')
      const d = new Date(Date.now() - 76 * 864e5), v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await tap(p, 'Next')
    await expect(p, "Cian's day")
    await look(p, 'setup-2')
    await tap(p, 'Next')
    await expect(p, 'When did Cian wake up this morning?')
    await setTime(p, 'wake-time', '07:30')
    await look(p, 'setup-3')
    await tap(p, 'Next')
    await expect(p, 'Has Cian had a nap since 7:30am?')
    await tap(p, 'Add a nap')
    await expect(p, 'Fell asleep')
    await setTime(p, 'fell-asleep', '08:30')
    await setTime(p, 'woke-up', '09:10')
    await expect(p, '40 min asleep')
    await tap(p, 'Save')
    await expect(p, '8:30 to 9:10am')
    await look(p, 'setup-4')
    await tap(p, 'Done')
    await expect(p, 'Tap when Cian falls asleep.')
    await expect(p, '8:30 to 9:10am')
    // The week shows from the first day.
    await expect(p, 'The line marks 5 hours of day sleep.')
    await expect(p, 'Woke up')
    await absent(p, 'Nap needed')
    await look(p, 'setup-done')
    for (let i = 0; i < 20 && !signups.length; i++) await new Promise((r) => setTimeout(r, 100))
    if (signups.length !== 1 || signups[0].p_email !== 'parent@example.com' || signups[0].p_source !== 'setup') fail('setup', `setup sent the email as ${JSON.stringify(signups)}`)
    // Android asks nothing about counts and offers no free week item.
    await absent(p, 'Can Baby Nap Track send us counts')
    await absent(p, 'Start my free week')
    await expectSent(p, 'snug_first_open', { source: null, campaign: null, ad: false })
    await expectSent(p, 'snug_setup_done', { naps: 1 })
    await expectSent(p, 'snug_day', { day: null, gate: 'none' })
    await done(p)
  }

  // Set up at midday, 4 October 2026: woke 6:50, napped 9:15 to 10:20, set up at 1pm.
  {
    const now = new Date(); now.setHours(13, 0, 0, 0)
    const p = await open('setup-1pm', { now: now.getTime() })
    await p.type('[data-testid=name]', 'Oisín')
    await p.evaluate(() => {
      const el = document.querySelector('[data-testid=born]')
      const d = new Date(Date.now() - 188 * 864e5), v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await tap(p, 'Next')
    await tap(p, 'Next')
    await setTime(p, 'wake-time', '06:50')
    await tap(p, 'Next')
    await tap(p, 'Add a nap')
    await setTime(p, 'fell-asleep', '09:15')
    await setTime(p, 'woke-up', '10:20')
    await tap(p, 'Save')
    await tap(p, 'Done')
    await expect(p, 'Nap window open')
    await expect(p, '1 h 55 min to go. Aim for that in the next nap.')
    await absent(p, 'Nap needed')
    await look(p, 'setup-1pm')
    await done(p)
  }

  // The next morning with the night not logged: the screen asks before it gives a nap time.
  {
    const p = await open('tomorrow', seed('tomorrow'))
    await expect(p, 'When did Oisín wake up this morning?')
    await absent(p, 'Bedtime')
    await look(p, 'tomorrow-ask')
    await setTime(p, 'wake-time', '06:40')
    await tap(p, 'Save')
    await expect(p, 'Has Oisín had a nap since 6:40am?')
    await tap(p, 'Add a nap')
    await setTime(p, 'fell-asleep', '07:45')
    await setTime(p, 'woke-up', '08:30')
    await tap(p, 'Save')
    await expect(p, '7:45 to 8:30am')
    await look(p, 'tomorrow-naps')
    await tap(p, 'Done')
    await expect(p, 'Saved. Next nap 10:50am.')
    await expect(p, 'Nap window in 2 h 10 min')
    await look(p, 'tomorrow-done')
    // The night it skipped can be added after.
    await tap(p, 'Last night, Add')
    await expect(p, 'Pop in when Oisín went down and woke in the night.')
    await setTime(p, 'night-down', '19:10')
    await tap(p, 'Save')
    await expect(p, '7:10pm to 6:40am')
    await expect(p, '11 h 30 min')
    await done(p)
  }

  // A phone set up on version 1.0.0 is asked about the morning when the update opens.
  {
    const p = await open('v1', seed('v1'))
    await expect(p, 'When did Oisín wake up this morning?')
    await absent(p, 'Nap needed')
    await done(p)
  }

  // The morning, a nap, Settings and editing a sleep.
  {
    const p = await open('morning', seed('morning'))
    await expect(p, 'Nap window in 35 min')
    await expect(p, '12:20')
    await expect(p, 'Put Oisín down between 12:10 and 12:30pm.')
    await expect(p, '1 h 57 min to go, across 2 more naps.')
    await look(p, 'morning')
    await expect(p, 'Tap when Oisín falls asleep.')
    await tap(p, 'Start the timer')
    await expect(p, 'Nap started at 11:35am.')
    await expect(p, 'Napping')
    await expect(p, 'Tap when Oisín wakes up.')
    // The timer is a button 76 wide. 1.0.5 drew a 216 wide circle, which came out on 7 October 2026.
    const size = await p.evaluate(() => { const r = document.querySelector('[data-testid=timer]')?.getBoundingClientRect(); return r ? Math.round(r.height) : null })
    if (size == null || size > 100) fail('morning', `the timer is ${size}px tall, and it is a button 76 wide`)
    // 4 October 2026: the timer looked stopped. It starts at 0 min and moves every second.
    const timer = () => p.evaluate(() => document.querySelector('[aria-label$=" sec"]')?.getAttribute('aria-label') ?? null)
    const t1 = await timer()
    await new Promise((r) => setTimeout(r, 2200))
    const t2 = await timer()
    if (!t1 || !/^0 min 0\d sec$/.test(t1)) fail('morning', `the timer read "${t1}" just after the tap, not 0 min and a few seconds`)
    if (t1 === t2) fail('morning', `the timer still read "${t1}" two seconds later`)
    await look(p, 'napping')
    await tap(p, 'Stop the timer')
    await expect(p, 'Nap ended.')
    await expect(p, 'Start')
    // 11 October 2026: a sleep added with a quick tap on the timer, then its wake-up and its start
    // picked in that order, read 25 h 18 min asleep and Save stayed grey.
    await tapStart(p, 'Nap, 0 min')
    await expect(p, 'Edit sleep')
    await setTime(p, 'woke-up', '11:20')
    const moved = await p.evaluate(() => document.querySelector('[data-testid=fell-asleep]')?.value)
    if (moved !== '11:19') fail('morning', `the wake-up picked for a tapped sleep left its start at ${moved}, not 11:19`)
    await setTime(p, 'fell-asleep', '10:50')
    await expect(p, '30 min asleep')
    await tap(p, 'Save')
    await expect(p, '10:50 to 11:20am')
    await tap(p, 'Settings')
    await expect(p, "Oisín's day")
    await tap(p, 'Bedtime, more')
    await expect(p, '7:15')
    // Play requires the app itself to link to its privacy page.
    await expect(p, 'Privacy')
    await absent(p, 'Send counts of how Baby Nap Track is used')
    await look(p, 'settings')
    await tap(p, 'Done')
    // The wake-up row changes this morning's time.
    await tap(p, 'Up for the day, 6:55am')
    await expect(p, 'When did Oisín wake up this morning?')
    await setTime(p, 'wake-time', '06:30')
    await tap(p, 'Save')
    await expect(p, 'Saved.')
    await expect(p, '6:30am')
    await tap(p, 'Add a sleep you missed')
    await expect(p, 'Add a sleep')
    await look(p, 'add')
    await tap(p, 'Save')
    await expect(p, 'Added.')
    await done(p)
  }

  // Last night can be changed all day, from 7 October 2026. Up to
  // 1.0.5 the night left the screen once the baby was up for the day.
  {
    const p = await open('last-night', seed('morning'))
    await expect(p, 'Last night')
    await expect(p, 'to 6:55am, woke twice')
    await scrollTo(p, 'Last night')
    await look(p, 'last-night-row')
    await tapStart(p, 'Last night, ')
    await expect(p, 'Down for the night')
    await expect(p, 'Add a time Oisín woke')
    await expect(p, 'asleep, woke twice')
    await look(p, 'last-night-sheet')
    await setTime(p, 'night-down', '19:30')
    await expect(p, '7:30pm')
    await tap(p, 'Remove this waking')
    await expect(p, 'asleep, woke once')
    // A time out of order is said, and Save waits.
    await setTime(p, 'night-back-1', '03:00')
    await expect(p, 'Each time has to come after the one above it.')
    if (!(await disabled(p, 'Save'))) fail('last-night', 'Save could be tapped with the times out of order')
    await setTime(p, 'night-back-1', '04:12')
    await absent(p, 'Each time has to come after the one above it.')
    await setTime(p, 'night-up', '06:45')
    await tap(p, 'Add a time Oisín woke')
    await expect(p, 'asleep, woke twice')
    await setTime(p, 'night-woke-1', '00:20')
    await setTime(p, 'night-back-1', '00:50')
    await look(p, 'last-night-changed')
    await tap(p, 'Save')
    await expect(p, 'Saved. Next nap')
    await expect(p, '7:30pm to 6:45am, woke twice')
    await expect(p, 'Up for the day')
    await expect(p, '6:45am')
    await scrollTo(p, 'Last night')
    await look(p, 'last-night-saved')
    // It opens again on the night as saved.
    await tapStart(p, 'Last night, ')
    await expect(p, '10 h 29 min asleep, woke twice')
    await tap(p, 'Close')
    await done(p)
  }

  // A parent can send the log to a sleep consultant, from 7 October 2026. Settings
  // sends a sleep diary. The web build keeps it in storage, and here it is printed the way the phone
  // prints it, on A4, and read back.
  {
    const p = await open('diary', seed('morning'))
    await tap(p, 'Settings')
    await expect(p, "Send Oisín's sleep diary")
    await expect(p, 'Seeing a sleep consultant or your GP?')
    await look(p, 'diary-settings')
    const printed = async (days, want) => {
      await tap(p, days)
      await p.evaluate(() => localStorage.removeItem('snug.diary'))
      await tap(p, 'Send the sleep diary')
      const got = await p.evaluate(() => JSON.parse(localStorage.getItem('snug.diary') || 'null'))
      if (!got) { fail('diary', `Send made no diary for ${days}`); return }
      if (!/^Oisín sleep diary \d+ \w+ to \d+ \w+ \d{4}$/.test(got.base)) fail('diary', `the files are called "${got.base}"`)
      if (got.csv.split('\r\n')[0] !== 'Sleep,Fell asleep,Woke,Minutes') fail('diary', 'the spreadsheet has no heading row')
      const doc = await (await browser.createBrowserContext()).newPage()
      await doc.setContent(got.html, { waitUntil: 'load' })
      await doc.evaluate(() => document.fonts.ready)
      const pdf = Buffer.from(await doc.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }))
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length
      if (pages !== want) fail('diary', `the ${days} diary printed on ${pages} pages, not ${want}`)
      // Nothing runs off the side of the page: 178 mm wide between the margins is 673 pixels.
      await doc.emulateMediaType('print')
      await doc.setViewport({ width: 673, height: 950 })
      const wide = await doc.evaluate(() => document.documentElement.scrollWidth)
      if (wide > 674) fail('diary', `the ${days} diary is ${wide}px wide on a page 673px wide`)
      // Every bar sits inside its own night's line. A line that lost its layout drew the bars across
      // the whole page on 7 October 2026, and the page count and width never saw it.
      const stray = await doc.evaluate(() => [...document.querySelectorAll('.track i')].filter((i) => {
        const a = i.getBoundingClientRect(), t = i.parentElement.getBoundingClientRect()
        return a.left < t.left - 1 || a.right > t.right + 1 || a.top < t.top - 1 || a.bottom > t.bottom + 1
      }).length)
      if (stray) fail('diary', `the ${days} diary draws ${stray} bars outside their night's line`)
      const words = await doc.evaluate(() => document.body.textContent)
      for (const w of ['Oisín was born on', 'Wakings a night', 'Night by night']) if (!words.includes(w)) fail('diary', `the ${days} diary never says "${w}"`)
      for (const w of ['undefined', 'NaN']) if (words.includes(w)) fail('diary', `the ${days} diary says ${w}`)
      if (shots) await doc.screenshot({ path: `${shots}/diary-${days.replace(' ', '-')}.png`, fullPage: true })
      await doc.close()
    }
    await printed('3 days', 1)
    await printed('2 weeks', 2)
    await done(p)
  }

  // The morning tap: up for the day, and the toast opens last night to change.
  {
    const x = seed('night')
    const p = await open('up-change', { state: x.state, now: x.now + (4 * 60 + 40) * 6e4 })
    await expect(p, 'Asleep')
    await tap(p, 'Stop the timer')
    await expect(p, 'Is Oisín up for the day?')
    await tap(p, 'Up for the day')
    await expect(p, 'Up for the day.')
    // Up to 1.0.5 the screen's clock ran behind the tap, and for up to 20 seconds it asked again.
    await absent(p, 'When did Oisín wake up this morning?')
    await tap(p, 'Change')
    await expect(p, 'Add a time Oisín woke')
    await expect(p, 'woke once')
    await look(p, 'up-change')
    await setTime(p, 'night-up', '06:20')
    await tap(p, 'Save')
    await expect(p, 'Saved.')
    await expect(p, '7pm to 6:20am, woke once')
    await done(p)
  }

  // The 5 October evening: 1.0.4 showed 1 h 35 min of a 3 hour day and hid the naps at bedtime.
  {
    const p = await open('evening', seed('evening'))
    await expect(p, "Today's naps came to 3 h 5 min.")
    await expect(p, '8:30 to 10am')
    await expect(p, 'Down for the night')
    await expect(p, 'Today3 h 5 min')
    await look(p, 'evening')
    // A nap added after bedtime is a nap, by its own times.
    await tap(p, 'Add a sleep you missed')
    await setTime(p, 'fell-asleep', '12:30')
    await setTime(p, 'woke-up', '13:00')
    await tap(p, 'Save')
    await expect(p, 'Added the nap from 12:30 to 1pm.')
    await expect(p, "Today's naps came to 3 h 35 min.")
    // 11 October 2026: a wake-up picked before the start, then an earlier start, read 25 h 18 min.
    await tapStart(p, 'Nap, 1 h 30 min')
    await expect(p, 'Edit sleep')
    await setTime(p, 'woke-up', '08:00')
    await setTime(p, 'fell-asleep', '07:30')
    await expect(p, '30 min asleep')
    await absent(p, '24 h 30 min')
    await tap(p, 'Save')
    await expect(p, '7:30 to 8am')
    await done(p)
  }

  // A stretch with no nap logged is marked, and a tap on it adds the nap.
  {
    const p = await open('gap', seed('gap'))
    await expect(p, 'Nothing logged 7 to 11:05am')
    await expect(p, 'No nap logged')
    await look(p, 'gap')
    await tap(p, 'Nothing logged 7 to 11:05am, Add')
    await expect(p, 'Add a sleep')
    await tap(p, 'Save')
    await expect(p, 'Added.')
    await absent(p, 'Nothing logged')
    await done(p)
  }

  // Going out: the plan, then the Today screen with it.
  {
    const p = await open('out', seed('morning'))
    await tap(p, 'Going out later? Plan the naps around it')
    await expect(p, 'Going out')
    await expect(p, 'Nap in the car')
    await expect(p, 'of day sleep on this plan. The aim is 3 hours.')
    await look(p, 'out-sheet')
    await tap(p, 'Stay awake')
    await expect(p, 'Home')
    await tap(p, 'Nap in the car')
    await tap(p, 'Use this plan')
    await expect(p, 'Plan saved.')
    await expect(p, 'Going out at 3pm. Change the plan')
    await expect(p, 'The plan for going out gives Oisín')
    await look(p, 'out-today')
    await done(p)
  }

  // The help chat opens from the corner and says a person answers. The walk sends nothing.
  {
    const p = await open('help', seed('morning'))
    await tap(p, 'Help')
    await expect(p, 'A person reads every message.')
    await expect(p, "Ask us anything about Baby Nap Track and we'll answer here.")
    await look(p, 'help')
    await tap(p, 'Close')
    await done(p)
  }

  // The 4pm example: a short day of three short naps.
  {
    const p = await open('4pm', seed('short'))
    await expect(p, 'Nap needed now')
    await expect(p, 'Get Oisín to sleep now. A nap in the car or the buggy counts.')
    await expect(p, 'Oisín needs 1 h 5 min more to make 3 hours.')
    await look(p, 'short-4pm')
    await done(p)
  }

  // A short morning nap, from 1.0.17: two ways to make it up, and the day follows the one tapped.
  {
    const p = await open('short-nap', seed('short-nap'))
    await expect(p, 'That nap was short. Here are two ways to make it up.')
    await expect(p, 'Nap at 11:25am, then one more. Bedtime 7pm.')
    await expect(p, 'Put Oisín down between 11:15 and 11:35am.')
    await look(p, 'short-nap')
    await tap(p, 'Earlier bedtime')
    await expect(p, 'Put Oisín down between 11:35 and 11:55am.')
    await expect(p, 'Nap at 11:45am, then one more. Bedtime 6:20pm.')
    await look(p, 'short-nap-bed')
    await tap(p, 'Nap sooner')
    await expect(p, 'Put Oisín down between 11:15 and 11:35am.')
    await done(p)
  }

  // The night, dark.
  {
    const p = await open('night', seed('night'))
    await expect(p, 'Asleep')
    await expect(p, 'Down for the night at 7pm and woke once.')
    const bg = await p.evaluate(() => { const el = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).backgroundColor === 'rgb(14, 18, 34)'); return !!el })
    if (!bg) fail('night', 'the screen did not go dark')
    await look(p, 'night')
    await done(p)
  }

  // The chair method, from mock chair-method v4: night 4 at bedtime with its picture, the night
  // held back and let go, settling, asleep, Settings, the chart the next morning, and the sheet
  // that starts it from Settings.
  {
    const p = await open('chair', seed('chair'))
    await expect(p, 'Chair method, night 4')
    await expect(p, 'Tap when Oisín is in the cot.')
    const tall = await p.evaluate(() => { const el = document.querySelector('[data-testid=chair-picture] svg'); return el ? el.getBoundingClientRect().height : 0 })
    if (tall < 100) fail('chair', `the picture is ${Math.round(tall)}px tall, so it did not draw`)
    await look(p, 'chair-bedtime')
    await tap(p, 'Stay by the cot one more night')
    await expect(p, 'Move the chair tonight')
    await tap(p, 'Move the chair tonight')
    await expect(p, 'Stay by the cot one more night')
    await tap(p, 'Start the timer')
    await expect(p, 'Settling')
    await expect(p, 'In the cot at 6:50pm.')
    await expect(p, 'Tap when Oisín is asleep.')
    await expect(p, 'Not yet')
    await tap(p, 'I went over')
    await tap(p, 'I went over')
    await expect(p, 'Twice so far')
    await look(p, 'chair-settling')
    await tap(p, 'Fell asleep')
    await expect(p, 'Oisín was asleep in under a minute. You went over twice.')
    await expect(p, 'Down for the night')
    await absent(p, 'Settling')
    await expect(p, 'How much did Oisín cry while settling?')
    await look(p, 'chair-ask')
    await tap(p, 'Teething')
    await tap(p, 'Some')
    await expect(p, 'Saved.')
    await absent(p, 'How much did Oisín cry while settling?')
    await tap(p, 'Settings')
    await expect(p, 'Night 4, halfway to the door')
    await look(p, 'chair-settings')
    await done(p)
    const m = await open('chair-morning', seed('chair-morning'))
    await expect(m, 'Minutes to fall asleep, one bar a night')
    await expect(m, 'Last night Oisín fell asleep in 31 min.')
    await expect(m, "That's 15 min faster than night 1.")
    await expect(m, 'You went over twice.')
    await expect(m, 'There was some crying.')
    await expect(m, 'Tonight the chair stays halfway to the door.')
    await expect(m, 'Chair method, night 5 of 13. The chair is halfway to the door tonight.')
    await scrollTo(m, 'Chair method')
    await look(m, 'chair-morning')
    await done(m)
    const s = await open('chair-start', seed('morning'))
    await tap(s, 'Settings')
    await absent(s, 'The HSE suggests it from six months.')
    await tap(s, 'Start the chair method')
    await expect(s, 'Put Oisín in the cot awake.')
    await look(s, 'chair-sheet')
    await tap(s, 'Start tonight')
    await expect(s, 'The chair method starts tonight.')
    await done(s)
    // From 1.0.18 Settings offers it at every age. A baby of ten weeks gets the HSE's line with it.
    const y = await open('chair-young', seed('young'))
    await tap(y, 'Settings')
    await expect(y, 'The HSE suggests it from six months.')
    await look(y, 'chair-young-settings')
    await tap(y, 'Start the chair method')
    await expect(y, 'Put Cian in the cot awake.')
    await tap(y, 'Start tonight')
    await expect(y, 'The chair method starts tonight.')
    await done(y)
  }

  // The parent's email in Settings, for a phone that left it out of setup: a bad address turned
  // back and a good one saved. The call is answered here, so no test address reaches the database.
  {
    const p = await open('email', seed('morning'))
    await p.setRequestInterception(true)
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }
    p.on('request', (r) => (r.url().includes('/rpc/sleep_signup') ? r.respond({ status: 200, headers: cors, contentType: 'application/json', body: r.method() === 'OPTIONS' ? '' : '{"ok":true}' }) : r.continue()))
    await tap(p, 'Settings')
    await expect(p, "Add your email and we'll send you sleep tips as Oisín grows.")
    const put = (v) => p.evaluate((v) => {
      const el = document.querySelector('[data-testid=email-settings]')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, v)
    await put('nope')
    await tap(p, 'Save')
    await expect(p, "That doesn't look like an email address.")
    await put('parent@example.com')
    await tap(p, 'Save')
    await expect(p, "We have your email, and we'll send you sleep tips as Oisín grows.")
    await done(p)
  }

  // The free week. Play has a price, so setup says so and Settings says when the week ends.
  {
    const now = new Date(); now.setHours(10, 0, 0, 0)
    const p = await open('free-week', { now: now.getTime(), play: { price: '€9.99' } })
    await expect(p, 'Baby Nap Track is free for 7 days. Then the nap times are €9.99, once.')
    // On Android the week starts by itself, as it always has.
    await expectSent(p, 'snug_free_week_started', { price: '€9.99' })
    await expectSent(p, 'snug_day', { day: 0, gate: 'trial' })
    await done(p)
    const m = await open('free-week-settings', { ...seed('morning'), play: { price: '€9.99' } })
    await expect(m, 'Nap window in 35 min')
    await tap(m, 'Settings')
    await expect(m, 'Free to the end of')
    await expect(m, 'Get them now for €9.99')
    await look(m, 'settings-free-week')
    await done(m)
  }

  // With no price from Play, nothing about paying shows anywhere.
  {
    const p = await open('no-price', seed('morning'))
    await expect(p, 'Nap window in 35 min')
    await tap(p, 'Settings')
    await expect(p, "Oisín's day")
    await absent(p, '€')
    await absent(p, 'free week')
    await done(p)
  }

  // Day 7, the last free day: the nap times still show, the screen says the week ends today, and
  // PostHog hears day 7 with the week not yet ended.
  {
    const p = await open('day-7', { ...paidSeed('morning', (now) => ({ trialFrom: now - 7 * DAY })), play: { price: '€9.99' } })
    await expect(p, 'Nap window in 35 min')
    await expect(p, 'Nap times are free to the end of today.')
    await expectSent(p, 'snug_day', { day: 7, gate: 'trial' })
    if (await count(p, 'snug_free_week_ended')) fail('day-7', 'sent the free week ending on its last day')
    await look(p, 'day-7')
    await done(p)
  }

  // After the free week: the nap time asks for the payment, logging still works, and paying opens
  // the nap times again. PostHog hears the week end once, however often the app opens after it.
  {
    const p = await open('locked', { ...paidSeed('morning', (now) => ({ trialFrom: now - 9 * DAY })), play: { price: '€9.99' } })
    await expect(p, 'Your free week of nap times is up')
    const ended = await expectSent(p, 'snug_free_week_ended', { shared: false })
    if (ended && !(ended.properties.sleeps > 0)) fail('locked', `the week's end carried ${ended.properties.sleeps} sleeps`)
    await expectSent(p, 'snug_day', { day: 9, gate: 'locked' })
    await new Promise((r) => setTimeout(r, 600))
    await p.reload({ waitUntil: 'networkidle0' })
    await expect(p, 'Your free week of nap times is up')
    await new Promise((r) => setTimeout(r, 1500))
    if ((await count(p, 'snug_free_week_ended')) !== 1) fail('locked', `the free week ending was sent ${await count(p, 'snug_free_week_ended')} times`)
    await expect(p, "Get them for €9.99, once, and they're yours to keep. Logging stays free.")
    await absent(p, 'Nap window')
    await absent(p, 'to go')
    await look(p, 'locked')
    await tap(p, 'Start the timer')
    await expect(p, 'Napping')
    await tap(p, 'Stop the timer')
    await expect(p, 'Nap ended.')
    await expect(p, 'Your free week of nap times is up')
    await tap(p, 'Get the nap times for €9.99')
    await expect(p, 'The nap times are yours. Thank you!')
    await expect(p, 'Nap window')
    await expectSent(p, 'snug_buy_tapped', { gate: 'locked' })
    await expectSent(p, 'snug_purchase', { outcome: 'owned', late: false })
    await tap(p, 'Settings')
    await expect(p, 'Yours to keep. Thank you!')
    await look(p, 'paid')
    await done(p)
  }

  // A payment Play has not finished leaves the nap times locked and says so.
  {
    const p = await open('pending', { ...paidSeed('morning', (now) => ({ trialFrom: now - 9 * DAY })), play: { price: '€9.99', pending: true } })
    await tap(p, 'Get the nap times for €9.99')
    await expect(p, 'Google Play is finishing the payment. The nap times open when it goes through.')
    await expectSent(p, 'snug_purchase', { outcome: 'pending' })
    await expect(p, 'Your free week of nap times is up')
    await done(p)
  }

  // An iPhone, from mock iphone-trial-and-counts v1. The pretend App Store has the price and the free
  // `7-day Trial` item. Setup asks about counts after the questions about the baby, then offers the
  // free week. Nothing reaches PostHog before a yes, and the nap times wait for the free week.
  const IOS = { price: '€9.99', os: 'ios', week: true }
  const babyAndMorning = async (p, name) => {
    await expect(p, "Let's get your first nap time.")
    await p.type('[data-testid=name]', name)
    await p.evaluate(() => {
      const el = document.querySelector('[data-testid=born]')
      const d = new Date(Date.now() - 76 * 864e5), v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await tap(p, 'Next')
    await tap(p, 'Next')
    await setTime(p, 'wake-time', '07:30')
    await tap(p, 'Next')
    await expect(p, `Has ${name} had a nap since 7:30am?`)
    await tap(p, 'No naps yet')
  }
  const nothingSent = async (p, when) => { const e = await sent(p); if (e.length) fail(p.label, `sent ${e.map((x) => x.event).join(', ')} to PostHog ${when}`) }
  // The switch as drawn, its knob to the right when on, and the answer the app saved. The web build
  // leaves aria-checked off a switch, so the knob is what the gate reads.
  const switchOn = (p) => p.evaluate((k) => {
    const knob = document.querySelector('[role=switch][aria-label="Send counts of how Baby Nap Track is used"] > div')
    if (!knob) return 'missing'
    const saved = JSON.parse(localStorage.getItem(k) || '{}').counts
    return `${/translateX\(20px\)/.test(knob.style.transform)}, saved ${saved}`
  }, STORE_KEY)
  const ten = new Date(); ten.setHours(10, 0, 0, 0)
  const lastFree = new Date(ten); lastFree.setDate(lastFree.getDate() + 7)
  const lastFreeSaid = `${lastFree.toLocaleDateString('en-IE', { weekday: 'long' })} ${lastFree.getDate()} ${lastFree.toLocaleDateString('en-IE', { month: 'long' })}`

  // No to the counts, Not now to the free week: Today logs sleep, nothing is sent, and the week is
  // offered on Today and in Settings until the parent starts it.
  {
    const p = await open('iphone-not-now', { now: ten.getTime(), play: IOS })
    await absent(p, 'Baby Nap Track is free for 7 days')
    await babyAndMorning(p, 'Cian')
    await expect(p, "Can Baby Nap Track send us counts of how it's used?")
    await expect(p, 'They show us which parts of Baby Nap Track get used, so we know what to work on next.')
    await expect(p, "Cian's name, birthday and sleep times are never in it.")
    await expect(p, "It says which day of the free week you're on and how many sleeps you've logged.")
    await expect(p, 'You can change this any time in Settings.')
    await look(p, 'iphone-counts')
    await nothingSent(p, 'before the parent answered')
    await tap(p, "No, don't send them")
    await expect(p, 'Nap times free for')
    await expect(p, `That's to the end of ${lastFreeSaid}. You get each nap time and the plan for the rest of the day. Baby Nap Track reminds you before each nap and bedtime too.`)
    await expect(p, 'After that, the nap times, the plan and the reminders stop until you pay €9.99, once. Logging sleep, the timer and sharing stay free.')
    await expect(p, 'The App Store will ask you to confirm the free week.')
    await look(p, 'iphone-week')
    await tap(p, 'Back')
    await expect(p, "Can Baby Nap Track send us counts of how it's used?")
    await tap(p, "No, don't send them")
    await tap(p, 'Not now')
    await expect(p, 'Nap times are free for 7\u00a0days')
    await expect(p, "You get each nap time and the plan for the rest of the day. After that, they're €9.99, once. Logging stays free.")
    await absent(p, 'Nap window')
    await absent(p, 'Planned naps')
    await look(p, 'iphone-not-now')
    await tap(p, 'Start the timer')
    await expect(p, 'Napping')
    await tap(p, 'Stop the timer')
    await expect(p, 'Nap ended.')
    await new Promise((r) => setTimeout(r, 2500))
    await nothingSent(p, 'after the parent said no')
    await tap(p, 'Settings')
    await expect(p, 'Free for 7 days from the day you start.')
    await expect(p, 'Get them now for €9.99')
    await expect(p, "Baby Nap Track sends a count each day you open the app, and when you do things like finish setup or share a log. Cian's name, birthday and sleep times are never in the counts.")
    if ((await switchOn(p)) !== 'false, saved false') fail('iphone-not-now', `the counts switch read ${await switchOn(p)} after the parent said no`)
    await look(p, 'iphone-settings')
    // The switch is the way back to yes, and the counts start from it.
    await tap(p, 'Send counts of how Baby Nap Track is used')
    await expectSent(p, 'snug_first_open')
    await expectSent(p, 'snug_day', { day: null, gate: 'offer' })
    await tap(p, 'Done')
    await tap(p, 'Start my free week')
    await expectSent(p, 'snug_free_week_started', { price: '€9.99' })
    await absent(p, 'Nap times are free for 7\u00a0days')
    await tap(p, 'Settings')
    await expect(p, 'Free to the end of')
    await tap(p, 'Done')
    await done(p)
  }

  // Yes to the counts, and the free week started from setup. The first tap closes Apple's sheet
  // without starting it, and the screen stays where it was.
  {
    const p = await open('iphone-start', { now: ten.getTime(), play: { ...IOS, weekCancel: true } })
    await babyAndMorning(p, 'Cian')
    await expect(p, "Can Baby Nap Track send us counts of how it's used?")
    await tap(p, 'Yes, send them')
    await expect(p, 'Nap times free for')
    await expectSent(p, 'snug_first_open')
    await tap(p, 'Start my free week')
    await new Promise((r) => setTimeout(r, 800))
    await expect(p, 'Nap times free for')
    await absent(p, "The free week didn't start")
    await p.evaluate((k) => { const f = JSON.parse(localStorage.getItem(k)); delete f.weekCancel; localStorage.setItem(k, JSON.stringify(f)) }, FAKE_PLAY_KEY)
    await tap(p, 'Start my free week')
    await expect(p, 'Tap when Cian falls asleep.')
    await absent(p, 'Nap times free for')
    await absent(p, 'Nap times are free for 7\u00a0days')
    await expectSent(p, 'snug_setup_done', { naps: 0 })
    await expectSent(p, 'snug_free_week_started', { price: '€9.99' })
    await look(p, 'iphone-started')
    await tap(p, 'Settings')
    await expect(p, 'Free to the end of')
    if ((await switchOn(p)) !== 'true, saved true') fail('iphone-start', `the counts switch read ${await switchOn(p)} after the parent said yes`)
    await tap(p, 'Done')
    await done(p)
  }

  // An App Store without the free week item: setup ends after the counts, and nothing locks.
  {
    const p = await open('iphone-no-item', { now: ten.getTime(), play: { ...IOS, week: false } })
    await babyAndMorning(p, 'Cian')
    await tap(p, 'Yes, send them')
    await expect(p, 'Tap when Cian falls asleep.')
    await absent(p, 'Start my free week')
    await absent(p, '€')
    await done(p)
  }

  // The first App Store version, 8 October 2026: no price and no free week item. The counts question
  // names no free week, because there is none and the day it would send is empty.
  {
    const p = await open('iphone-free', { now: ten.getTime(), play: { os: 'ios', week: false } })
    await babyAndMorning(p, 'Cian')
    await expect(p, "Can Baby Nap Track send us counts of how it's used?")
    await expect(p, "It says how many sleeps you've logged.")
    await absent(p, 'free week')
    await tap(p, 'Yes, send them')
    await expect(p, 'Tap when Cian falls asleep.')
    await absent(p, 'Start my free week')
    await absent(p, '€')
    await done(p)
  }

  // An Apple Account that took the free week nine days ago, on a phone set up again: no second week.
  {
    const p = await open('iphone-had-week', { now: ten.getTime(), play: { ...IOS, weekFrom: ten.getTime() - 9 * DAY } })
    await babyAndMorning(p, 'Cian')
    await tap(p, "No, don't send them")
    await expect(p, 'Your free week of nap times is up')
    await absent(p, 'Start my free week')
    await nothingSent(p, 'after the parent said no')
    await done(p)
  }

  // Sharing, live: one phone sends the link, a second joins with it, and a nap logged on the
  // first reaches the second. The test log is deleted from the database at the end.
  {
    const a = await open('share-a', { ...seed('morning'), play: { price: '€9.99', owned: true } })
    await expect(a, 'Nap window in 35 min')
    await tap(a, 'Settings')
    await tap(a, 'Send a link')
    await new Promise((r) => setTimeout(r, 2500))
    const key = await a.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}').share?.key, STORE_KEY)
    if (!key) fail('share', 'Send a link made no shared log')
    else {
      await expectSent(a, 'snug_share_started')
      await tap(a, 'Done')
      const bNow = seed('morning').now
      const b = await open('share-b', { now: bNow, play: { price: '€9.99' }, state: JSON.stringify({ paid: { price: '€9.99', trialFrom: bNow - 9 * DAY, owned: false, sharedPaid: false } }) })
      await expect(b, "Let's get your first nap time.")
      await tap(b, 'Someone sent you a link? Join their log')
      await b.waitForSelector('[data-testid=join-link]', { timeout: 5000 })
      await b.type('[data-testid=join-link]', `https://babynaptrack.com/join/#${key}`)
      await tap(b, 'Join')
      // Phone A paid, so phone B, whose own free week ended, gets the nap times from the log.
      await expect(b, 'Nap window in 35 min')
      await expect(b, "You're logging Oisín's sleep with everyone who has the link.")
      await absent(b, 'Your free week of nap times is up')
      await expectSent(b, 'snug_share_joined')
      await tap(a, 'Start the timer')
      await new Promise((r) => setTimeout(r, 4000))
      await b.reload({ waitUntil: 'networkidle0' })
      await expect(b, 'Napping')
      await look(b, 'shared')
      await done(a); await done(b)
      await fetch('https://eynuujdjarqnwkjofrpw.supabase.co/rest/v1/rpc/sleep_forget', {
        method: 'POST', headers: { apikey: 'sb_publishable_u1X1QV-qny9l9YvnVvGvog_xQ8dw1Tm', 'Content-Type': 'application/json' }, body: JSON.stringify({ p_key: key }),
      })
    }
  }

  await browser.close()
  server.close()
}

if (fails.length) {
  console.log(`CHECK FAILED, ${fails.length}`)
  for (const f of fails) console.log('  ' + f)
  process.exit(1)
}
console.log('CHECK PASSED: types, tests, source guards, and the web build walked through setup with a morning nap, setup at 1pm, the next morning with the night not logged and then added, last night changed from the list and from the morning toast, the sleep diary printed on A4, a 1.0.0 phone, the morning, a nap and its timer moving, Settings, adding a sleep, the 4pm example, a short nap and the two ways to make it up, the night, the chair method at bedtime, settling with the trips to the cot, the crying asked after and the next morning, an email taken in setup and in Settings, the free week, no price, the nap times locked and paid for, a pending payment, a log shared live between two phones with the payment carried across, an iPhone saying no to counts and Not now to the free week, an iPhone saying yes and starting the week, an App Store with no free week item, an Apple Account that had its week, and what PostHog hears at each step')
