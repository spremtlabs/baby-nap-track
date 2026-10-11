// The sleep diary a parent sends a sleep consultant or a GP: one line per night on the 6pm to 6pm
// chart a children's sleep clinic uses, the averages, a table night by night, and a spreadsheet of
// every sleep. Everything here is worked out from the log, so the tests read it in plain strings.
import { DAY, HOUR, MIN, ageText, isMark, readLog, type Baby, type Sleep } from './engine.ts'
import { dur, fmt, hm } from './words.ts'

export type Span = { s: number; e: number }
export type DiaryNight = {
  // 6pm on the evening the line starts. The line runs to 6pm the next day.
  six: number
  // When the baby went down, null when the night was not logged.
  bed: number | null
  wakes: { w: number; b: number }[]
  // Up for the day, null while the night is still going or when it was not logged.
  up: number | null
  stretches: Span[]
  naps: Span[]
  // The line runs past now.
  partial: boolean
  night: number
  day: number
  // Nothing logged on this line at all.
  empty: boolean
}
export type Diary = {
  name: string
  base: string
  nights: DiaryNight[]
  from: number
  to: number
  avgNight: number | null
  avgDay: number | null
  wakings: number | null
  bedtime: number | null
  csv: string
  html: string
}

const pad = (n: number) => String(n).padStart(2, '0')
// A time with its minutes always, so a column of them scans straight down: 7:00pm, 12:05am.
export const full = (t: number) => { const x = hm(t); return x.t + x.ap }
const fullRange = (a: number, b: number) => { const A = hm(a), B = hm(b); return A.ap === B.ap ? `${A.t} to ${B.t}${B.ap}` : `${A.t}${A.ap} to ${B.t}${B.ap}` }
const iso = (t: number) => { const x = new Date(t); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}` }
const dm = (t: number) => new Date(t).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
const dmy = (t: number) => new Date(t).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
const dmLong = (t: number) => new Date(t).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })
const wd = (t: number) => new Date(t).toLocaleDateString('en-IE', { weekday: 'short' })
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
// 6pm on the calendar day k days before the day of t.
const sixOf = (t: number, back = 0) => { const d = new Date(t); d.setDate(d.getDate() - back); d.setHours(18, 0, 0, 0); return d.getTime() }

// The nights in the log: each run of night sleep up to the one that ended with the baby up for the
// day. A morning typed in without its night is a run with no length.
function runs (sleeps: Sleep[]) {
  const out: Sleep[][] = []
  let cur: Sleep[] = []
  for (const x of sleeps) {
    if (x.kind !== 'night') continue
    cur.push(x)
    if (x.up && x.e != null) { out.push(cur); cur = [] }
  }
  if (cur.length) out.push(cur)
  return out
}

export function diary (baby: Baby, log: Sleep[], now: number, days: number): Diary {
  const sleeps = readLog(baby, log, now)
  // The newest line starts at the last 6pm a night could have begun by now.
  const last = sixOf(now - 18 * HOUR)
  const sixes = Array.from({ length: days }, (_, k) => sixOf(last, days - 1 - k))
  const byEvening = new Map<number, Sleep[]>()
  // A night belongs to the evening twelve hours before it started, so a bedtime at 5:50pm or a
  // first sleep after midnight stays on its own line.
  for (const r of runs(sleeps)) { const k = sixOf(r[0].s - 12 * HOUR); if (!byEvening.has(k)) byEvening.set(k, r) }

  const nights: DiaryNight[] = sixes.map((six) => {
    const r = byEvening.get(six) ?? []
    const real = r.filter((x) => !isMark(x)), end = r[r.length - 1]
    const stretches = real.map((x) => ({ s: x.s, e: x.e ?? now }))
    const wakes = stretches.slice(1).map((x, k) => ({ w: stretches[k].e, b: x.s }))
    const naps = sleeps.filter((x) => x.kind === 'nap' && x.s >= six && x.s < six + DAY).map((x) => ({ s: x.s, e: x.e ?? now }))
    return {
      six, bed: real.length ? real[0].s : null, wakes, up: end?.up && end.e != null ? end.e : null, stretches, naps,
      partial: six + DAY > now,
      night: stretches.reduce((a, x) => a + x.e - x.s, 0),
      day: naps.reduce((a, x) => a + x.e - x.s, 0),
      empty: !r.length && !naps.length,
    }
  })
  // A phone with less in its log than the days asked for starts the diary at its first night.
  while (nights.length > 1 && nights[0].empty) nights.shift()

  // A day counts toward the average once it is over and has a nap logged.
  const done = nights.filter((n) => n.bed != null && n.up != null), whole = nights.filter((n) => !n.partial && n.naps.length)
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  const beds = done.map((n) => (n.bed! - n.six) / MIN).sort((a, b) => a - b)
  const from = nights[0].six, to = nights[nights.length - 1].partial ? now : last + DAY
  const name = baby.name.replace(/[\\/:*?"<>|]/g, '').trim() || 'Baby'
  const years = new Date(from).getFullYear() === new Date(to).getFullYear()
  const base = `${name} sleep diary ${dm(from)}${years ? '' : ` ${new Date(from).getFullYear()}`} to ${dm(to)} ${new Date(to).getFullYear()}`

  const d: Diary = {
    name: baby.name, base, nights, from, to,
    avgNight: mean(done.map((n) => n.night)),
    avgDay: mean(whole.map((n) => n.day)),
    wakings: mean(done.map((n) => n.wakes.length)),
    bedtime: beds.length ? from + beds[beds.length >> 1] * MIN : null,
    csv: '', html: '',
  }
  d.csv = csvOf(nights)
  d.html = htmlOf(baby, d, now)
  return d
}

// One row for each sleep, both times with their date, so a night across midnight reads plainly.
function csvOf (nights: DiaryNight[]) {
  const rows = ['Sleep,Fell asleep,Woke,Minutes']
  for (const n of nights) {
    for (const x of n.stretches) rows.push(`Night,${iso(x.s)},${iso(x.e)},${Math.round((x.e - x.s) / MIN)}`)
    for (const x of n.naps) rows.push(`Nap,${iso(x.s)},${iso(x.e)},${Math.round((x.e - x.s) / MIN)}`)
  }
  return rows.join('\r\n') + '\r\n'
}

const lenHtml = (ms: number) => { const m = Math.round(ms / MIN), h = Math.floor(m / 60), r = m % 60; return h ? `${h}<small>h</small>${r}<small>min</small>` : `${r}<small>min</small>` }

function htmlOf (baby: Baby, d: Diary, now: number) {
  const N = esc(d.name), n = d.nights.length
  const rh = n <= 3 ? 16 : n <= 7 ? 13 : 10.6
  const pc = (six: number, t: number) => Math.max(0, Math.min(100, (t - six) / DAY * 100)).toFixed(3)
  const bar = (six: number, x: Span, cls = '') => { const a = +pc(six, x.s), b = +pc(six, x.e); return b > a ? `<i class="${cls}" style="left:${a}%;width:${(b - a).toFixed(3)}%"></i>` : '' }
  const ticks = ['6pm', '9pm', 'Midnight', '3am', '6am', '9am', 'Noon', '3pm', '6pm']
  const lines = Array.from({ length: 23 }, (_, k) => k + 1).map((h) => `<span class="g${h === 6 || h === 18 ? ' mid' : h % 3 ? ' hr' : ''}" style="left:${(h / 24 * 100).toFixed(3)}%"></span>`).join('')
  const nightText = (x: DiaryNight) => (x.bed == null ? 'Not logged' : x.up == null ? `${dur(x.night)} so far` : dur(x.night))
  const dayText = (x: DiaryNight) => (x.partial && !x.naps.length ? 'Not yet' : x.empty ? '' : dur(x.day))
  const rows = d.nights.map((x) => `<div class="ch row"><span class="d">${wd(x.six)} <small>${dm(x.six)}</small></span><div class="track">${lines}${x.stretches.map((s) => bar(x.six, s)).join('')}${x.naps.map((s) => bar(x.six, s, 'nap')).join('')}${x.partial ? `<span class="now" style="left:${pc(x.six, now)}%"></span>` : ''}</div><span class="v${x.bed == null ? ' m' : ''}">${nightText(x)}</span><span class="v${x.partial && !x.naps.length ? ' m' : ''}">${dayText(x)}</span></div>`).join('')
  const stat = (v: string, label: string) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`
  const none = '<span class="m">Not enough logged</span>'
  const born = baby.born ? `${N} was born on ${dmy(parseDay(baby.born))} and is ${ageText(baby, now)} old.` : ''
  const due = baby.due ? ` ${N} was due on ${dmy(parseDay(baby.due))}.` : ''
  const table = d.nights.map((x) => `<tr><td>${wd(x.six)} ${dm(x.six)}</td><td class="n${x.bed == null ? ' m' : ''}">${x.bed == null ? 'Not logged' : full(x.bed)}</td><td class="${x.wakes.length ? '' : 'm'}">${x.wakes.length ? x.wakes.map((w) => `${full(w.w)}, awake ${dur(w.b - w.w)}`).join('<br>') : x.bed == null ? '' : 'None'}</td><td class="n${x.up == null ? ' m' : ''}">${x.up != null ? full(x.up) : x.partial ? 'Not yet' : x.empty ? '' : 'Not logged'}</td><td class="${x.naps.length ? '' : 'm'}">${x.naps.length ? x.naps.map((s) => fullRange(s.s, s.e)).join('<br>') : x.partial ? 'Not yet' : x.empty ? '' : 'None'}</td></tr>`).join('')
  return `<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><title>${esc(d.base)}</title>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:15mm 16mm 13mm}
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Figtree,Roboto,'Helvetica Neue',Arial,system-ui;color:#151A2C;background:#fff;font-size:9pt}
.kick{font-size:7pt;letter-spacing:.14em;text-transform:uppercase;color:#6C7186;font-weight:700}
.who{font-weight:300;font-size:34pt;line-height:1;letter-spacing:-.03em;margin:4mm 0 3mm}
.when{font-size:9pt;line-height:1.45;color:#5E6378;max-width:150mm}
.stats{display:flex;margin:8mm 0 8mm;border-top:.6pt solid #DDE0E8;border-bottom:.6pt solid #DDE0E8}
.stat{flex:1;padding:4mm 0 4mm 4mm;border-left:.6pt solid #DDE0E8}
.stat:first-child{border-left:0;padding-left:0}
.stat b{display:block;font-weight:300;font-size:18pt;letter-spacing:-.02em;line-height:1.05;white-space:nowrap}
.stat b small{font-size:8pt;font-weight:600;color:#6C7186;letter-spacing:0;margin:0 1.4mm 0 .6mm}
.stat span{display:block;font-size:7.5pt;color:#6C7186;margin-top:1.6mm}
.m{color:#8A8FA3}
.ch{display:flex;align-items:center}
.ch .d{width:22mm;flex:none}
.ch .track,.ch .ticks{flex:1;position:relative}
.ch .v{width:22mm;flex:none;text-align:right}
.axis{font-size:6.8pt;color:#6C7186;margin-bottom:1.5mm}
.ticks{height:3.4mm}
.ticks span{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}
.ticks span:first-child{transform:none}
.ticks span:last-child{transform:translateX(-100%)}
.axis .h{font-weight:700;color:#151A2C}
.row{height:${rh}mm;border-top:.5pt solid #EEF0F4}
.row:last-child{border-bottom:.5pt solid #EEF0F4}
.row .d{font-size:8pt;font-weight:700;white-space:nowrap}
.row .d small{font-weight:400;color:#6C7186;font-size:8pt}
.row .v{font-size:7.8pt}
.track{height:100%;position:relative}
.track .g{position:absolute;top:0;bottom:0;width:.5pt;background:#EEF0F4}
.track .g.hr{background:#F5F6F9}
.track .g.mid{background:#D3D7E2}
.track i{position:absolute;top:28%;bottom:28%;background:#4252A8;border-radius:1mm}
.track i.nap{background:#7F8BCB}
.track .now{position:absolute;top:12%;bottom:12%;width:0;border-left:1pt dashed #6C7186}
.key{display:flex;flex-wrap:wrap;gap:2mm 6mm;font-size:7pt;color:#6C7186;margin-top:3mm}
.key span{display:flex;align-items:center;gap:2mm}
.key i{width:6mm;height:2.6mm;border-radius:.8mm;background:#4252A8}
.key i.nap{background:#7F8BCB}
.key i.now{width:0;height:3.4mm;border-left:1pt dashed #6C7186;border-radius:0;background:none}
.tbl{margin-top:9mm}
.tbl.next{break-before:page;margin-top:0}
.tbl h2{font-size:7pt;letter-spacing:.14em;text-transform:uppercase;color:#6C7186;font-weight:700;margin-bottom:3mm}
table{width:100%;border-collapse:collapse;font-size:7.8pt;line-height:1.35}
thead{display:table-header-group}
th{text-align:left;font-weight:600;color:#6C7186;padding:0 2.4mm 2mm 0;border-bottom:.6pt solid #DDE0E8;white-space:nowrap}
td{padding:1.7mm 2.4mm 1.7mm 0;border-bottom:.5pt solid #EEF0F4;vertical-align:top;font-variant-numeric:tabular-nums}
tr{break-inside:avoid}
td:first-child{font-weight:700;white-space:nowrap}
td.n{white-space:nowrap}
.foot{margin-top:7mm;font-size:6.8pt;color:#8A8FA3}
</style></head><body>
<p class="kick">Sleep diary</p>
<h1 class="who">${N}</h1>
<p class="when">${born}${due} This diary runs from 6pm on ${dmLong(d.from)} to ${full(d.to)} on ${dmy(d.to)}.</p>
<div class="stats">
${stat(d.avgNight != null ? lenHtml(d.avgNight) : none, 'Night sleep, on average')}
${stat(d.avgDay != null ? lenHtml(d.avgDay) : none, 'Day sleep, on average')}
${stat(d.wakings != null ? (Math.round(d.wakings * 10) / 10).toFixed(1) : none, 'Wakings a night')}
${stat(d.bedtime != null ? fmt(d.bedtime).replace(/(am|pm)$/, '<small>$1</small>') : none, 'Usual bedtime')}
</div>
<div class="ch axis"><span class="d"></span><div class="ticks">${ticks.map((x, k) => `<span style="left:${k * 12.5}%">${x}</span>`).join('')}</div><span class="v h">Night</span><span class="v h">Day</span></div>
<div class="rows">${rows}</div>
<div class="key"><span><i></i>Night sleep</span><span><i class="nap"></i>Naps</span>${d.nights.some((x) => x.partial) ? '<span><i class="now"></i>When the diary was sent</span>' : ''}</div>
<div class="tbl${n > 3 ? ' next' : ''}"><h2>Night by night</h2><table><thead><tr><th>Evening</th><th>Asleep</th><th>Woke in the night</th><th>Up for the day</th><th>Naps the next day</th></tr></thead><tbody>${table}</tbody></table></div>
<p class="foot">Made with Baby Nap Track</p>
</body></html>`
}
