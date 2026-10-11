// Draws store/feature.html into store/assets/feature-1024x500.png, Play's feature graphic.
// Run: node store/feature.mjs
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const PUPPETEER = [process.env.CHECK_PUPPETEER, ...(existsSync(`${process.env.HOME}/dev`) ? readdirSync(`${process.env.HOME}/dev`) : []).map((d) => `${process.env.HOME}/dev/${d}/node_modules/puppeteer/lib/puppeteer/puppeteer.js`), 'node_modules/puppeteer/lib/puppeteer/puppeteer.js'].find((p) => p && existsSync(p))
const { default: puppeteer } = await import(pathToFileURL(resolve(PUPPETEER)).href)
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage()
await page.setViewport({ width: 1024, height: 500 })
await page.goto(pathToFileURL(resolve('store/feature.html')).href)
await page.evaluate(() => document.fonts.ready)
const wide = await page.$eval('.words', (el) => el.getBoundingClientRect().right)
if (wide > 1000) throw new Error(`the words run to ${Math.round(wide)}px, past the 1000px the graphic leaves`)
await page.screenshot({ path: 'store/assets/feature-1024x500.png' })
await browser.close()
console.log(`store/assets/feature-1024x500.png, words end at ${Math.round(wide)}px`)
