// The chair method's picture: the bedroom at night, side-on and warm. The baby sleeps on its back in
// a sleeping bag; the parent sits in the honey armchair at tonight's place, leaning in with a hand
// on the baby for the first three nights, and is a dark shape in the lit doorway in the hall. The
// other places are marks on the rug. Drawn as one SVG string so the phone and the web build show
// the same picture. `now` is tonight's place, 0 beside the cot to 3 in the hall and 4 out of the
// room, and `done` counts the places already used.
// Where each place sits across the picture, as a share of its width, for the nights under it.
export const SCENE_STOPS = [{ x: 158, t: '1–3' }, { x: 214, t: '4–6' }, { x: 262, t: '7–9' }, { x: 326, t: '10–12' }]
let sceneN = 0
const FY = 170
const P = {
  wall1: '#4A3A61', wall2: '#382B4F', wains: '#2E2444', rail: '#5B4A75', floor1: '#3C2E48', floor2: '#2B2136', board: '#46384F',
  rug: '#5C4770', rugEdge: '#7C6697',
  sky1: '#2E3A6B', sky2: '#5B5E92', moon: '#FCE5AE', frame: '#EBDCC7', curtain: '#C97F82', curtainSh: '#A9646C', rod: '#8E7058',
  cot: '#ECDCC5', cotSh: '#CFBA9D', cotLt: '#F7EDDD', matt: '#F5EBDD',
  bag: '#9AA6EE', bagSh: '#7D8ADC', baby: '#F6D2B5', babySh: '#E6B595', blush: '#F09C8C',
  skin: '#E8B08A', skinSh: '#CF936D', hair: '#6B4334', lip: '#B4614D',
  sweater: '#A9CDB2', sweaterSh: '#88B193', trouser: '#56508A', trouserSh: '#443F74', slipper: '#F3E6D4', slipperSh: '#D8C6AE',
  chair: '#EAA341', chairLt: '#F6C06A', chairSh: '#CA842C', chairDk: '#B57422', leg: '#8A5A2B',
  rim: '#FFDCA4', door: '#4E3D66', doorEdge: '#65527F', hall1: '#FFE3AB', hall2: '#F3AF62', hallFloor: '#DC9852',
}
const DARK = Object.fromEntries(Object.keys(P).map((k) => [k, '#33284A'])) as typeof P

// A limb from (x1, y1) to (x2, y2), w1 wide at the start and w2 at the end, with round ends.
function limb (x1: number, y1: number, x2: number, y2: number, w1: number, w2: number, fill: string) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l
  const p = (x: number, y: number, w: number, s: number) => `${(x + nx * w / 2 * s).toFixed(1)} ${(y + ny * w / 2 * s).toFixed(1)}`
  return `<path d="M${p(x1, y1, w1, 1)}L${p(x2, y2, w2, 1)}L${p(x2, y2, w2, -1)}L${p(x1, y1, w1, -1)}Z" fill="${fill}"/>`
    + `<circle cx="${x1}" cy="${y1}" r="${w1 / 2}" fill="${fill}"/><circle cx="${x2}" cy="${y2}" r="${w2 / 2}" fill="${fill}"/>`
}

// The armchair from the side, facing the cot, in local units with the floor at y 0: the back and
// the far arm behind the sitter, the seat under her.
const chair = (c: typeof P) => `<rect x="-28" y="-8" width="5" height="8" rx="2" fill="${c.leg}"/><rect x="22" y="-8" width="5" height="8" rx="2" fill="${c.leg}"/>`
  + `<path d="M8 -14L8 -70C8 -91 37 -93 37 -72L33 -14Z" fill="${c.chairSh}"/>`
  + `<path d="M35.6 -77C36.6 -60 35 -38 33.2 -16" fill="none" stroke="${c.rim}" stroke-width="1.7" opacity=".6"/>`
  + `<path d="M-30 -41C-30 -50 -19 -51 -17 -45L14 -45L14 -30L-30 -30Z" fill="${c.chairDk}"/><circle cx="-24" cy="-42.5" r="6" fill="${c.chairSh}"/>`
  + `<rect x="-31" y="-28" width="64" height="20" rx="7" fill="${c.chair}"/>`
  + `<rect x="-31" y="-36" width="50" height="11" rx="5.5" fill="${c.chairLt}"/>`

// The sitter's back, shoulders and head: a profile facing the cot, hair up, eyes closed, a small smile.
const upper = (c: typeof P) => `<path d="M-14 -40C-18 -56 -16 -71 -9 -79C-4 -85 6 -86 11 -81C17 -75 18 -58 12 -40Z" fill="${c.sweater}"/>`
  + `<path d="M-14 -40C-18 -56 -16 -71 -9 -79C-6.5 -82 -4 -83 -2 -83.5C-8 -74 -10 -58 -7 -40Z" fill="${c.sweaterSh}"/>`
  + `<path d="M11.5 -81C17 -75 18 -58 12.5 -42" fill="none" stroke="${c.rim}" stroke-width="1.8" opacity=".7"/>`
  + `<path d="M-3.5 -82L-3 -90L3.5 -90L4.5 -83Z" fill="${c.skinSh}"/><ellipse cx=".5" cy="-82.5" rx="6.5" ry="2.4" fill="${c.sweaterSh}"/>`
  + `<path d="M3 -89C1 -87 -4 -86 -7 -87C-9 -87.5 -10 -89 -10 -90.5L-10.5 -91.5C-11.5 -92 -11.5 -93 -10.6 -93.4L-11.8 -94.2C-13 -94.8 -13.6 -96 -12.6 -97C-12 -98 -11 -99.2 -10.8 -100.5C-10.6 -102 -11.2 -103.5 -10.6 -105C-9 -110 -3 -112 2 -111.5C9 -111 13 -105 12.5 -98C12 -93 8 -89 3 -89Z" fill="${c.skin}"/>`
  + `<circle cx="-5" cy="-94.5" r="2.7" fill="${c.blush}" opacity=".4"/>`
  + `<path d="M-10.8 -103C-9 -110 -2 -113.5 4 -113C11 -112 15 -105 14 -97C13.5 -92 10 -88.5 6 -88C7.5 -93 7 -98 4 -101C0 -104.5 -5 -104 -10.8 -103Z" fill="${c.hair}"/>`
  + `<circle cx="12" cy="-109" r="6.2" fill="${c.hair}"/>`
  + `<path d="M15.5 -112C18.5 -108 18 -102 14.4 -98M13 -94C11.5 -91 9 -89 6.5 -88.2" fill="none" stroke="${c.rim}" stroke-width="1.6" stroke-linecap="round" opacity=".65"/>`
  + `<ellipse cx="3.6" cy="-97" rx="2.3" ry="3.3" fill="${c.skinSh}"/>`
  + `<path d="M-8.6 -99.2q1.9 1.6 3.8 .2" fill="none" stroke="#3A2620" stroke-width="1.25" stroke-linecap="round"/>`
  + `<path d="M-9.2 -102.8q2 -1.1 4.1 -.4" fill="none" stroke="${c.hair}" stroke-width="1.1" stroke-linecap="round"/>`
  + `<path d="M-11.2 -92.6q1.1 1 2.4 .2" fill="none" stroke="${c.lip}" stroke-width="1.2" stroke-linecap="round"/>`
const legs = (c: typeof P) => `<rect x="-38" y="-38" width="10" height="33" rx="5" fill="${c.trouserSh}"/>`
  + `<path d="M-46 -.5C-46 -6 -41 -7 -36 -7L-30 -7C-28 -7 -28 0 -30 0Z" fill="${c.slipperSh}"/>`
  + `<path d="M10 -49L-40 -47.5C-49 -47.5 -49 -32 -40 -32L10 -33Z" fill="${c.trouser}"/>`
  + `<rect x="-46.5" y="-41" width="12.5" height="37" rx="6.2" fill="${c.trouser}"/>`
  + `<path d="M-54.5 -.3C-54.5 -6.8 -48.5 -8.4 -42.5 -8.4L-34.5 -8.4C-32 -8.4 -32 0 -34.5 0Z" fill="${c.slipper}"/>`
// Upright, the hands rest together on the knee.
const lapArms = (c: typeof P) => limb(2, -76, 0, -54, 10, 8.5, c.sweater)
  + `<path d="M-3 -75C-5 -66 -5 -60 -4 -55" fill="none" stroke="${c.sweaterSh}" stroke-width="1.3" stroke-linecap="round"/>`
  + limb(0, -54, -29, -51, 8.5, 7.5, c.sweater)
  + `<ellipse cx="-35.5" cy="-51.5" rx="6.4" ry="4.4" fill="${c.skin}"/><path d="M-39 -49.2q3 1.3 6 .2" fill="none" stroke="${c.skinSh}" stroke-width="1.1" stroke-linecap="round"/>`

// Leaning in, the upper body turns about the hip.
const LEAN = -25, HIP = [4, -38] as const
function rot (x: number, y: number): [number, number] {
  const a = LEAN * Math.PI / 180, dx = x - HIP[0], dy = y - HIP[1]
  return [HIP[0] + dx * Math.cos(a) - dy * Math.sin(a), HIP[1] + dx * Math.sin(a) + dy * Math.cos(a)]
}
// The elbow rests on the cot's rail and the hand on the baby, in the room's units.
const ELBOW: [number, number] = [116, 100], HAND: [number, number] = [83, 129]
const local = (cx: number, [x, y]: [number, number]): [number, number] => [x - cx, y - FY]

function sitter (cx: number, reach: boolean, c: typeof P = P) {
  const g = (inner: string) => `<g transform="translate(${cx} ${FY})">${inner}</g>`
  if (!reach) return g(chair(c) + legs(c) + upper(c) + lapArms(c))
  const [sx, sy] = rot(2, -76), [ex, ey] = local(cx, ELBOW)
  return g(chair(c) + legs(c) + `<g transform="rotate(${LEAN} ${HIP[0]} ${HIP[1]})">${upper(c)}</g>` + limb(sx, sy, ex, ey, 10, 9, c.sweater)
    + `<path d="M${sx - 2} ${sy + 5}L${ex + 3} ${ey + 4}" stroke="${c.sweaterSh}" stroke-width="1.4" stroke-linecap="round"/>`)
}
// The forearm and hand inside the cot, behind the bars.
function forearm () {
  const [ex, ey] = ELBOW, [hx, hy] = HAND, a = Math.atan2(hy - ey, hx - ex), d = a * 180 / Math.PI
  const px = hx + 4 * Math.cos(a), py = hy + 4 * Math.sin(a)
  return limb(ex, ey, hx, hy, 9, 7.5, P.sweater)
    + `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="6.6" ry="4.4" transform="rotate(${d.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})" fill="${P.skin}"/>`
}

// The cot: the mattress and the baby asleep on its back in a sleeping bag, then the bars, the rails
// and the posts in front.
const cotBack = () => `<ellipse cx="66" cy="${FY + 1.5}" rx="58" ry="4.5" fill="#1C1426" opacity=".5"/>`
  + `<rect x="18" y="139" width="96" height="10" rx="3" fill="${P.matt}"/>`
  + `<path d="M42 139.5C33 139.5 32 126 42 125.5L91 124.5C96 124.5 96 139.5 91 139.5Z" fill="${P.bag}"/>`
  + `<path d="M40 137.5C60 138.5 80 138.5 92 137" fill="none" stroke="${P.bagSh}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`
  + `<path d="M50 131.5H87" stroke="${P.bagSh}" stroke-width="1.3" stroke-linecap="round"/>`
  + `<circle cx="101" cy="130" r="9.5" fill="${P.baby}"/><circle cx="98.6" cy="120.8" r="1.9" fill="${P.baby}"/>`
  + `<path d="M100.6 123q1.6 1.2 3.2 0" fill="none" stroke="#7A5A55" stroke-width="1.2" stroke-linecap="round"/>`
  + `<path d="M94.4 122.6q.9 .7 1.8 0" fill="none" stroke="${P.lip}" stroke-width="1" stroke-linecap="round"/>`
  + `<circle cx="98" cy="126" r="2.3" fill="${P.blush}" opacity=".5"/>`
  + `<path d="M107 125q3 1.5 3.4 4.5" fill="none" stroke="${P.babySh}" stroke-width="1.6" stroke-linecap="round"/>`
const cotFront = () => [27, 40, 53, 66, 79, 92, 105].map((x) => `<rect x="${x}" y="110" width="4.4" height="38" rx="2.2" fill="${P.cot}"/>`).join('')
  + `<rect x="15" y="147" width="102" height="6.5" rx="3" fill="${P.cotSh}"/>`
  + `<rect x="10" y="104" width="112" height="7" rx="3.5" fill="${P.cot}"/><path d="M14 104.8H118" stroke="${P.cotLt}" stroke-width="1.2" stroke-linecap="round"/>`
  + `<rect x="12" y="96" width="8" height="${FY - 96}" rx="4" fill="${P.cot}"/><rect x="112" y="96" width="8" height="${FY - 96}" rx="4" fill="${P.cot}"/>`
  + `<path d="M119.6 98V${FY - 2}" stroke="${P.rim}" stroke-width="1.3" stroke-linecap="round" opacity=".5"/>`
  + `<circle cx="16" cy="95" r="5" fill="${P.cotLt}"/><circle cx="116" cy="95" r="5" fill="${P.cotLt}"/>`

// The window over the cot, with the moon out and the curtains drawn back.
const windowArt = (id: (s: string) => string) => `<path d="M30 92V56Q30 38 65 38Q100 38 100 56V92Z" fill="url(#${id('k')})"/>`
  + `<path d="M84 50a9.5 9.5 0 1 0 6 16a8 8 0 1 1 -6 -16z" fill="${P.moon}"/>`
  + [[42, 52, 1.3], [56, 64, 1], [47, 78, 1.1], [92, 80, .9], [72, 48, .9]].map(([x, y, r]: number[]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${P.moon}" opacity=".85"/>`).join('')
  + `<path d="M30 92V56Q30 38 65 38Q100 38 100 56V92Z" fill="none" stroke="${P.frame}" stroke-width="4"/>`
  + `<path d="M65 40V92M30 66H100" stroke="${P.frame}" stroke-width="2.6"/>`
  + `<rect x="25" y="91" width="80" height="5" rx="2" fill="${P.frame}"/>`
  + `<path d="M18 34H112" stroke="${P.rod}" stroke-width="2.6" stroke-linecap="round"/>`
  + `<path d="M21 34H38C36 50 39 62 35 72C33 80 34 88 37 98H20C21 80 19 54 21 34Z" fill="${P.curtain}"/><path d="M28 36C27 54 29 76 27 96" stroke="${P.curtainSh}" stroke-width="2" fill="none" stroke-linecap="round"/>`
  + `<path d="M109 34H92C94 50 91 62 95 72C97 80 96 88 93 98H110C109 80 111 54 109 34Z" fill="${P.curtain}"/><path d="M102 36C103 54 101 76 103 96" stroke="${P.curtainSh}" stroke-width="2" fill="none" stroke-linecap="round"/>`

export function chairScene (now: number, done = now): string {
  const k = ++sceneN, id = (s: string) => `chair${s}${k}`
  const st = SCENE_STOPS[Math.min(now, 3)]
  // Each place for the chair is a mark on the rug: filled once used, dashed while still to come.
  const spots = SCENE_STOPS.map((s, i) => {
    if ((i === now && now < 4) || i === 3) return ''
    return i < done
      ? `<ellipse cx="${s.x}" cy="${FY + 8}" rx="21" ry="4.2" fill="${P.rugEdge}"/>`
      : `<ellipse cx="${s.x}" cy="${FY + 8}" rx="21" ry="4.2" fill="none" stroke="#A08AB6" stroke-width="1.6" stroke-dasharray="4 4"/>`
  }).join('')
  const shadow = now >= 3 ? '' : `<ellipse cx="${st.x + 2}" cy="${FY + 1.5}" rx="38" ry="4.5" fill="#1C1426" opacity=".5"/>`
    + `<path d="M${st.x - 30} ${FY + 1}L${st.x + 34} ${FY + 1}L${st.x - 22} 200L${st.x - 92} 200Z" fill="#1C1426" opacity=".2"/>`
  const room = now === 0
    ? cotBack() + forearm() + cotFront() + sitter(st.x, true)
    : cotBack() + cotFront() + (now >= 3 ? '' : sitter(st.x, false))
  // In the hall the parent is a dark shape in the lit doorway, behind the door.
  const hall = now === 3 ? `<g clip-path="url(#${id('d')})"><g transform="translate(${st.x} ${FY}) scale(.82) translate(${-st.x} ${-FY})">${sitter(st.x, false, { ...DARK, rim: P.rim })}</g></g>` : ''
  return `<svg viewBox="0 28 380 172">`
    + `<defs>`
    + `<clipPath id="${id('c')}"><rect y="28" width="380" height="172" rx="18"/></clipPath>`
    + `<clipPath id="${id('d')}"><rect x="298" y="0" width="54" height="${FY}"/></clipPath>`
    + `<linearGradient id="${id('w')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.wall1}"/><stop offset="1" stop-color="${P.wall2}"/></linearGradient>`
    + `<linearGradient id="${id('f')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.floor1}"/><stop offset="1" stop-color="${P.floor2}"/></linearGradient>`
    + `<linearGradient id="${id('h')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.hall1}"/><stop offset="1" stop-color="${P.hall2}"/></linearGradient>`
    + `<linearGradient id="${id('k')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky1}"/><stop offset="1" stop-color="${P.sky2}"/></linearGradient>`
    + `<radialGradient id="${id('g')}" cx="318" cy="120" r="230" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFC27A" stop-opacity=".42"/><stop offset=".45" stop-color="#FFB86B" stop-opacity=".14"/><stop offset="1" stop-color="#FFB86B" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="${id('s')}" x1="330" y1="${FY}" x2="160" y2="200" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFD08A" stop-opacity=".55"/><stop offset="1" stop-color="#FFD08A" stop-opacity="0"/></linearGradient>`
    + `</defs>`
    + `<g clip-path="url(#${id('c')})">`
    // The wall with its panelling, warm from the hall light.
    + `<rect y="28" width="380" height="${FY - 28}" fill="url(#${id('w')})"/>`
    + `<rect y="${FY - 56}" width="380" height="56" fill="${P.wains}" opacity=".5"/>`
    + `<path d="M0 ${FY - 56}H380" stroke="${P.rail}" stroke-width="2.5"/>`
    + windowArt(id)
    // The door open wide, and the hall lit beyond it.
    + `<rect x="292" y="0" width="66" height="${FY}" fill="${P.rail}"/>`
    + `<rect x="298" y="0" width="54" height="${FY}" fill="url(#${id('h')})"/>`
    + `<rect x="298" y="${FY - 16}" width="54" height="16" fill="${P.hallFloor}" opacity=".6"/>`
    + hall
    + `<path d="M298 0L312 0V${FY - 5}L298 ${FY}Z" fill="${P.door}"/><path d="M312 0V${FY - 5}" stroke="${P.doorEdge}" stroke-width="2"/>`
    + `<circle cx="308" cy="${FY - 56}" r="2.2" fill="${P.hall1}"/>`
    + `<rect y="28" width="380" height="172" fill="url(#${id('g')})"/>`
    // The floor, the rug, and the hall light falling across them.
    + `<rect y="${FY - 5}" width="292" height="5" fill="${P.rail}"/><rect x="358" y="${FY - 5}" width="22" height="5" fill="${P.rail}"/>`
    + `<rect y="${FY}" width="380" height="${200 - FY}" fill="url(#${id('f')})"/>`
    + `<rect x="124" y="${FY + 3}" width="164" height="12" rx="6" fill="${P.rug}"/>`
    + `<path d="M298 ${FY}H352L336 200H160Z" fill="url(#${id('s')})"/>`
    + spots + shadow + room
    + `</g>`
    + `</svg>`
}
