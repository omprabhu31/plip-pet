// Plip, a pixel-art water droplet. Everything here is pure: a mood in, an SVG
// document out. The pet is drawn on a 40 x 44 pixel grid and scaled up with
// crisp edges, and each mood brings its own face and its own little effects.

import type { Mood } from '../types'

export type { Mood }

const W = 40
const H = 44
// Where the droplet's own 32 x 32 grid sits inside the canvas.
const OX = 4
const OY = 9

const C = {
  out: '#1b3a6b',
  body: '#8fdcff',
  shade: '#5cb8f0',
  deep: '#3d93d6',
  light: '#c9f1ff',
  shine: '#ffffff',
  eye: '#16213e',
  blush: '#ff9ec0',
  mouth: '#16213e',
  tongue: '#ff6f9a',
  heart: '#ff4f86',
  heartOut: '#b02a5c',
  bubble: '#bff0ff',
  bubbleOut: '#4aa3dd',
  cloud: '#e9eef7',
  cloudOut: '#7c8aa8',
  rain: '#5cb8f0',
  zzz: '#9fb4d9',
  spark: '#fff3a6',
  shades: '#14141f',
  shadesShine: '#6f7fa8',
  ballOut: '#4b5470',
  ballLight: '#f4f7ff',
  ballMid: '#b9c3dc',
  ballDark: '#7f8bab',
  string: '#7c8aa8',
  discoPink: '#ff4fb8',
  discoCyan: '#3fe0ff',
  discoYellow: '#ffe14f',
  discoLime: '#7dff6a',
  discoPurple: '#b06bff',
  discoOrange: '#ff8a3d',
  discoRed: '#ff3d5a',
  fog: '#e6ecf7',
}

type Grid = Map<string, string>
const key = (x: number, y: number) => `${x},${y}`

// ---------------------------------------------------------------- the body

const CX = 16
const CY = 20
const R = 10.4
const TIP = 3

function insideDrop(x: number, y: number): boolean {
  const px = x + 0.5
  const py = y + 0.5
  if ((px - CX) ** 2 + (py - CY) ** 2 <= R * R) return true
  if (py < TIP || py > CY) return false
  const t = (py - TIP) / (CY - TIP)
  const hw = R * Math.pow(Math.sin((t * Math.PI) / 2), 1.5)
  const lean = 2.4 * (1 - t) ** 2.2 // the tip flicks to the right
  return Math.abs(px - (CX + lean)) <= hw
}

function insideFeet(x: number, y: number): boolean {
  const feet: [number, number][] = [
    [11.5, 30.2],
    [20.5, 30.2],
  ]
  return feet.some(([fx, fy]) => ((x + 0.5 - fx) / 3) ** 2 + ((y + 0.5 - fy) / 2) ** 2 <= 1)
}

function shapeToGrid(inside: (x: number, y: number) => boolean, shade: boolean): Grid {
  const g: Grid = new Map()
  for (let y = 0; y < 34; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inside(x, y)) continue
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      if (edge) {
        g.set(key(x, y), C.out)
        continue
      }
      if (!shade) {
        g.set(key(x, y), C.body)
        continue
      }
      const nx = (x + 0.5 - CX) / R
      const ny = (y + 0.5 - CY) / R
      const d = nx * 0.55 + ny * 0.85
      g.set(key(x, y), d > 0.62 ? C.deep : d > 0.3 ? C.shade : d < -0.55 ? C.light : C.body)
    }
  }
  return g
}

const BODY = (() => {
  const g = shapeToGrid(insideDrop, true)
  // The shine: a tall glint up the left side and a dot beside it.
  const shine: [number, number][] = [
    [9, 13], [9, 14], [8, 15], [8, 16], [8, 17], [9, 12], [10, 11],
    [11, 15],
  ]
  for (const [x, y] of shine) if (g.get(key(x, y)) && g.get(key(x, y)) !== C.out) g.set(key(x, y), C.shine)
  // A glint on the tip.
  for (const [x, y] of [[17, 6], [16, 7]] as [number, number][]) {
    if (g.get(key(x, y)) && g.get(key(x, y)) !== C.out) g.set(key(x, y), C.light)
  }
  return g
})()

const FEET = shapeToGrid(insideFeet, false)

function arm(side: -1 | 1): Grid {
  const ax = side < 0 ? 5.2 : 26.8
  const ay = 23.6
  return shapeToGrid((x, y) => ((x + 0.5 - ax) / 2.6) ** 2 + ((y + 0.5 - ay) / 2.2) ** 2 <= 1, false)
}

// ---------------------------------------------------------------- faces

type Face = { eyes: Grid; mouth: Grid; extra?: Grid }

function paint(points: [number, number][], color: string, g: Grid = new Map()): Grid {
  for (const [x, y] of points) g.set(key(x, y), color)
  return g
}

function roundEyes(lookX = 0): Grid {
  const g: Grid = new Map()
  for (const ex of [11, 19]) {
    for (let y = 19; y <= 21; y++) for (let x = ex; x <= ex + 1; x++) g.set(key(x + lookX, y), C.eye)
    g.set(key(ex + lookX, 19), C.shine)
  }
  return g
}

const FACES: Record<Mood, Face> = {
  idle: {
    eyes: roundEyes(),
    mouth: paint([[14, 22], [15, 23], [16, 23], [17, 22]], C.mouth),
  },
  working: {
    eyes: roundEyes(1),
    mouth: paint([[15, 23], [16, 23], [15, 24], [16, 24]], C.mouth),
  },
  happy: {
    eyes: paint(
      [[10, 21], [11, 20], [12, 20], [13, 21], [18, 21], [19, 20], [20, 20], [21, 21]],
      C.eye,
    ),
    mouth: paint([[15, 24], [16, 24]], C.tongue, paint([[14, 22], [15, 22], [16, 22], [17, 22], [14, 23], [17, 23], [15, 23], [16, 23]], C.mouth)),
  },
  sad: {
    eyes: paint([[12, 19], [19, 19]], C.shine, paint(
      [[11, 20], [12, 20], [11, 21], [12, 21], [19, 20], [20, 20], [19, 21], [20, 21], [10, 18], [11, 18], [20, 18], [21, 18]],
      C.eye,
    )),
    mouth: paint([[15, 23], [16, 23], [14, 24], [17, 24]], C.mouth),
    extra: paint([[12, 22], [12, 23]], C.bubble),
  },
  sleepy: {
    eyes: paint(
      [[10, 20], [11, 21], [12, 21], [13, 20], [18, 20], [19, 21], [20, 21], [21, 20]],
      C.eye,
    ),
    mouth: paint([[15, 23], [16, 23]], C.mouth),
  },
  loved: {
    eyes: (() => {
      const g: Grid = new Map()
      const heart = [
        '.X.X.',
        'XXXXX',
        '.XXX.',
        '..X..',
      ]
      for (const ex of [10, 18]) {
        heart.forEach((row, dy) =>
          [...row].forEach((c, dx) => c === 'X' && g.set(key(ex + dx, 19 + dy), C.heart)),
        )
        g.set(key(ex + 1, 19), C.shine)
      }
      return g
    })(),
    mouth: paint([[14, 23], [15, 24], [16, 24], [17, 23]], C.mouth),
  },
  vibing: {
    // Disco shades: two dark lenses on a bridge, each with a glint.
    eyes: paint([[10, 19], [18, 19]], C.shadesShine, paint(
      [
        [9, 19], [10, 19], [11, 19], [12, 19], [13, 19], [14, 19], [17, 19], [18, 19], [19, 19], [20, 19], [21, 19], [22, 19],
        [15, 19], [16, 19],
        [9, 20], [10, 20], [11, 20], [12, 20], [13, 20], [14, 20], [17, 20], [18, 20], [19, 20], [20, 20], [21, 20], [22, 20],
        [10, 21], [11, 21], [12, 21], [13, 21], [18, 21], [19, 21], [20, 21], [21, 21],
      ],
      C.shades,
    )),
    // A big open grin.
    mouth: paint([[15, 24], [16, 24]], C.tongue, paint([[13, 22], [14, 23], [15, 23], [16, 23], [17, 23], [18, 22], [14, 24], [17, 24]], C.mouth)),
  },
}

const BLUSH = paint([[8, 22], [9, 22], [10, 22], [21, 22], [22, 22], [23, 22]], C.blush)

// ---------------------------------------------------------------- effects

function sprite(rows: string[], palette: Record<string, string>): Grid {
  const g: Grid = new Map()
  rows.forEach((row, y) => [...row].forEach((c, x) => palette[c] && g.set(key(x, y), palette[c])))
  return g
}

const BUBBLE = sprite(['.oo.', 'o.wo', 'o..o', '.oo.'], { o: C.bubbleOut, w: C.shine })
const SMALL_BUBBLE = sprite(['oo', 'oo'], { o: C.bubbleOut })
const HEART = sprite(['.o.o.', 'oxoxo', 'oxxxo', '.oxo.', '..o..'], { o: C.heartOut, x: C.heart })
const SPARK = sprite(['.s.', 'sws', '.s.'], { s: C.spark, w: C.shine })
const CLOUD = sprite(
  [
    '...oooo.....',
    '..occccoooo.',
    '.occcccccccoo',
    'occcccccccccco',
    'occcccccccccco',
    '.oooooooooooo.',
  ],
  { o: C.cloudOut, c: C.cloud },
)
const DROP = sprite(['r', 'r'], { r: C.rain })
const ZED = sprite(['zzz', '..z', '.z.', 'zzz'], { z: C.zzz })
const ZED_BIG = sprite(['zzzzz', '...z.', '..z..', '.z...', 'zzzzz'], { z: C.zzz })

// The disco: a mirror ball on a string, notes in party colors, coloured
// lights and a flashing floor.
const BALL = sprite(
  [
    '...s...',
    '..ooo..',
    '.olmlo.',
    'omldlmo',
    'oldmdlo',
    'omldlmo',
    '.olmlo.',
    '..ooo..',
  ],
  { s: C.string, o: C.ballOut, l: C.ballLight, m: C.ballMid, d: C.ballDark },
)
// The ball's facets the other way round, flashed over it to make it turn.
const BALL_TURN = sprite(
  ['', '', '..pml..', '.mdldc.', '.dlmld.', '.cdldm.', '..lmp..'],
  { l: C.ballLight, m: C.ballMid, d: C.ballDark, p: C.discoPink, c: C.discoCyan },
)
// Coloured light from the ball, washing over Plip's body one colour at a time.
const LIGHT_COLORS = [C.discoPink, C.discoCyan, C.discoPurple]
const lightOn = (color: string): Grid => {
  const g: Grid = new Map()
  for (let y = 0; y < 34; y++) for (let x = 0; x < 32; x++) if (insideDrop(x, y)) g.set(key(x, y), color)
  return g
}
const NOTE_ROWS = ['..xx', '..x.', '..x.', 'xxx.', 'xx..']
const NOTE_PINK = sprite(NOTE_ROWS, { x: C.discoPink })
const NOTE_CYAN = sprite(NOTE_ROWS, { x: C.discoCyan })
const NOTE_YELLOW = sprite(NOTE_ROWS, { x: C.discoYellow })
const GLEAM = (color: string) => sprite(['.c.', 'cwc', '.c.'], { c: color, w: C.shine })
const FLOOR_COLORS = [C.discoPink, C.discoCyan, C.discoYellow, C.discoLime, C.discoPurple]
// One floor tile 4 x 2, coloured in its turn.
const TILE = (color: string) => sprite(['cccc', 'cccc'], { c: color })
const PARTY = [C.discoPink, C.discoCyan, C.discoYellow, C.discoLime, C.discoPurple]
const CONFETTI = (color: string) => sprite(['c', 'c'], { c: color })
// An equalizer bar, 1 x 12, that the beat scales from the bottom up.
const EQ_BAR = (color: string) => sprite(Array(12).fill('c'), { c: color })

// The dancing faces: the same shades, a different mouth for each dance.
const MOUTH_GRIN = FACES.vibing.mouth
const MOUTH_OOH = paint([[15, 22], [16, 22], [14, 23], [17, 23], [15, 24], [16, 24]], C.mouth)
const MOUTH_WOO = paint([[14, 24], [15, 24], [16, 24], [17, 24]], C.tongue, paint(
  [[14, 22], [15, 22], [16, 22], [17, 22], [13, 23], [18, 23], [14, 23], [15, 23], [16, 23], [17, 23], [13, 24], [18, 24], [14, 25], [15, 25], [16, 25], [17, 25]],
  C.mouth,
))
const MOUTH_TONGUE = paint([[16, 24], [17, 24], [16, 25], [17, 25]], C.tongue, paint([[13, 22], [14, 23], [15, 23], [16, 23], [17, 23], [18, 22]], C.mouth))
const BOLT = (color: string) => sprite(['..cc', '.cc.', 'cccc', '..cc', '.cc.', '.c..'], { c: color })
const STAR = (color: string) => sprite(['..c..', '.cwc.', 'cwwwc', '.cwc.', '..c..'], { c: color, w: C.shine })
const FOG = sprite(['.ffff.', 'ffffff', '.ffff.'], { f: C.fog })
const STREAK = (color: string) => sprite(['cccc'], { c: color })
const RAINBOW_BUBBLE = (color: string) => sprite(['.cc.', 'cwcc', 'cccc', '.cc.'], { c: color, w: C.shine })
// A tiny droplet friend who joins in.
const BUDDY = (color: string) =>
  sprite(['...o...', '..obo..', '.obbbo.', 'obebebo', 'obbbbbo', '.obbbo.', '..ooo..'], { o: C.out, b: color, e: C.eye })
const MOUTH_SMIRK = paint([[13, 23], [14, 23], [15, 23], [16, 23], [17, 22], [18, 21]], C.mouth)

// ---------------------------------------------------------------- svg

function rects(g: Grid, dx = 0, dy = 0): string {
  // Merge each row's runs of one color into one rect.
  const rows = new Map<number, { x: number; color: string }[]>()
  for (const [k, color] of g) {
    const [x = 0, y = 0] = k.split(',').map(Number)
    const row = rows.get(y) ?? []
    row.push({ x, color })
    rows.set(y, row)
  }
  let out = ''
  for (const [y, cells] of [...rows].sort((a, b) => a[0] - b[0])) {
    cells.sort((a, b) => a.x - b.x)
    let i = 0
    while (i < cells.length) {
      const start = cells[i]!
      let end = start
      let j = i
      for (;;) {
        const nextCell = cells[j + 1]
        if (!nextCell || nextCell.x !== end.x + 1 || nextCell.color !== start.color) break
        end = nextCell
        j++
      }
      out += `<rect x="${start.x + dx}" y="${y + dy}" width="${end.x - start.x + 1}" height="1" fill="${start.color}"/>`
      i = j + 1
    }
  }
  return out
}

function group(cls: string, inner: string, style = ''): string {
  return `<g class="${cls}"${style ? ` style="${style}"` : ''}>${inner}</g>`
}

const CSS = `
.fx,.pet,.eyes,.armL,.armR,.shadow{transform-box:fill-box}
.pet{transform-origin:50% 100%}
.eyes{transform-origin:50% 50%;animation:blink 4.2s infinite}
.shadow{transform-origin:50% 50%}
.armL{transform-origin:100% 50%}
.armR{transform-origin:0% 50%}
@keyframes blink{0%,91%,97%,100%{transform:scaleY(1)}94%{transform:scaleY(.15)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}
@keyframes bobShadow{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.88)}}
@keyframes hop{0%,100%{transform:translateY(0) scale(1,1)}12%{transform:translateY(0) scale(1.1,.9)}35%{transform:translateY(-5px) scale(.94,1.07)}55%{transform:translateY(0) scale(1.08,.93)}70%{transform:translateY(0) scale(1,1)}}
@keyframes hopShadow{0%,100%,70%{transform:scale(1)}35%{transform:scale(.6)}}
@keyframes wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
@keyframes breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.04,.96)}}
@keyframes droop{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(1px) scale(1.04,.96)}}
@keyframes waveL{0%,100%{transform:rotate(0)}50%{transform:rotate(35deg)}}
@keyframes waveR{0%,100%{transform:rotate(0)}50%{transform:rotate(-35deg)}}
@keyframes rise{0%{transform:translateY(0);opacity:0}15%{opacity:1}80%{opacity:1}100%{transform:translateY(-22px);opacity:0}}
@keyframes riseSway{0%{transform:translate(0,0);opacity:0}15%{opacity:1}50%{transform:translate(2px,-10px)}85%{opacity:1}100%{transform:translate(-1px,-20px);opacity:0}}
@keyframes twinkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}}
@keyframes fall{0%{transform:translateY(0);opacity:1}100%{transform:translateY(9px);opacity:0}}
@keyframes drift{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(5px,-12px);opacity:0}}
@keyframes cloudBob{0%,100%{transform:translateX(0)}50%{transform:translateX(1px)}}
@keyframes groove{0%,100%{transform:translate(-1px,0) rotate(-6deg) scale(1.04,.96)}25%{transform:translate(0,-2px) rotate(0) scale(.97,1.03)}50%{transform:translate(1px,0) rotate(6deg) scale(1.04,.96)}75%{transform:translate(0,-2px) rotate(0) scale(.97,1.03)}}
@keyframes grooveShadow{0%,50%,100%{transform:scaleX(1)}25%,75%{transform:scaleX(.8)}}
@keyframes discoL{0%,49%{transform:rotate(0)}50%,100%{transform:rotate(80deg)}}
@keyframes discoR{0%,49%{transform:rotate(-80deg)}50%,100%{transform:rotate(0)}}
@keyframes spin{0%,49%{opacity:0}50%,100%{opacity:1}}
@keyframes flash{0%,100%{opacity:.15}50%{opacity:1}}
@keyframes light{0%,100%{opacity:0}16%,33%{opacity:.3}50%{opacity:0}}
.beam{transform-box:view-box;transform-origin:19.5px 5px}
.eq{transform-origin:50% 100%}
@keyframes twirl{0%,100%{transform:scaleX(1) translateY(0)}25%{transform:scaleX(.15) translateY(-3px)}50%{transform:scaleX(-1) translateY(0)}75%{transform:scaleX(.15) translateY(-3px)}}
@keyframes twirlShadow{0%,50%,100%{transform:scaleX(1)}25%,75%{transform:scaleX(.7)}}
@keyframes flapL{0%,100%{transform:rotate(-20deg)}50%{transform:rotate(45deg)}}
@keyframes flapR{0%,100%{transform:rotate(20deg)}50%{transform:rotate(-45deg)}}
@keyframes sweep{0%{transform:rotate(-32deg)}100%{transform:rotate(32deg)}}
@keyframes jump{0%,100%{transform:translateY(0) scale(1.12,.88)}15%{transform:translateY(-2px) scale(.9,1.12)}45%{transform:translateY(-7px) scale(.95,1.05)}80%{transform:translateY(0) scale(1.1,.9)}}
@keyframes jumpShadow{0%,80%,100%{transform:scale(1)}45%{transform:scale(.5)}}
@keyframes pumpL{0%,100%{transform:rotate(40deg)}45%{transform:rotate(115deg)}}
@keyframes pumpR{0%,100%{transform:rotate(-40deg)}45%{transform:rotate(-115deg)}}
@keyframes confetti{0%{transform:translateY(0) rotate(0);opacity:0}10%{opacity:1}85%{opacity:1}100%{transform:translateY(40px) rotate(270deg);opacity:0}}
@keyframes slide{0%{transform:translateX(-3px) rotate(-4deg)}12.5%{transform:translateX(-1px) rotate(4deg)}25%{transform:translateX(1px) rotate(-4deg)}37.5%{transform:translateX(3px) rotate(4deg)}50%{transform:translateX(3px) rotate(-4deg)}62.5%{transform:translateX(1px) rotate(4deg)}75%{transform:translateX(-1px) rotate(-4deg)}87.5%{transform:translateX(-3px) rotate(4deg)}}
@keyframes slideShadow{0%,87.5%{transform:translateX(-3px)}12.5%,75%{transform:translateX(-1px)}25%,62.5%{transform:translateX(1px)}37.5%,50%{transform:translateX(3px)}}
@keyframes robotL{0%,49%{transform:rotate(0)}50%,100%{transform:rotate(90deg)}}
@keyframes robotR{0%,49%{transform:rotate(-90deg)}50%,100%{transform:rotate(0)}}
@keyframes eqA{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@keyframes eqB{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.35)}}
@keyframes headbang{0%,100%{transform:translateY(-1px) scale(.96,1.04) rotate(-2deg)}40%{transform:translateY(1px) scale(1.1,.88) rotate(5deg)}}
@keyframes hornsL{0%,100%{transform:rotate(95deg)}40%{transform:rotate(125deg)}}
@keyframes hornsR{0%,100%{transform:rotate(-95deg)}40%{transform:rotate(-125deg)}}
@keyframes zap{0%,100%{opacity:0}5%,15%{opacity:1}20%{opacity:0}25%,30%{opacity:1}35%{opacity:0}}
@keyframes stage{0%,100%{opacity:.08}50%{opacity:.3}}
@keyframes moonwalk{0%{transform:translate(-6px,0) scaleX(1)}12.5%{transform:translate(-3px,-1px) scaleX(1)}25%{transform:translate(0,0) scaleX(1)}37.5%{transform:translate(3px,-1px) scaleX(1)}49.9%{transform:translate(6px,0) scaleX(1)}50%{transform:translate(6px,0) scaleX(-1)}62.5%{transform:translate(3px,-1px) scaleX(-1)}75%{transform:translate(0,0) scaleX(-1)}87.5%{transform:translate(-3px,-1px) scaleX(-1)}100%{transform:translate(-6px,0) scaleX(-1)}}
@keyframes moonShadow{0%,100%{transform:translateX(-6px)}25%,75%{transform:translateX(0)}50%{transform:translateX(6px)}}
@keyframes glideL{0%,100%{transform:rotate(-15deg)}50%{transform:rotate(25deg)}}
@keyframes glideR{0%,100%{transform:rotate(-25deg)}50%{transform:rotate(15deg)}}
@keyframes fogDrift{0%{transform:translateX(0);opacity:0}30%{opacity:.85}100%{transform:translateX(10px);opacity:0}}
@keyframes windmill{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
@keyframes windShadow{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.6)}}
@keyframes streak{0%{transform:translateX(0);opacity:0}20%{opacity:1}100%{transform:translateX(-8px);opacity:0}}
@keyframes streakR{0%{transform:translateX(0);opacity:0}20%{opacity:1}100%{transform:translateX(8px);opacity:0}}
@keyframes buddyHop{0%,100%{transform:translateY(0) scale(1.1,.9)}40%{transform:translateY(-6px) scale(.92,1.08)}70%{transform:translateY(0) scale(1.05,.95)}}
@keyframes sideHop{0%,100%{transform:translate(-2px,0) scale(1.06,.94)}25%{transform:translate(0,-3px) scale(.96,1.04)}50%{transform:translate(2px,0) scale(1.06,.94)}75%{transform:translate(0,-3px) scale(.96,1.04)}}
@keyframes jelly{0%,100%{transform:skewX(0) scale(1,1)}15%{transform:skewX(14deg) scale(1.1,.9)}35%{transform:skewX(-11deg) scale(.92,1.08)}55%{transform:skewX(7deg) scale(1.05,.95)}75%{transform:skewX(-3deg) scale(.98,1.02)}}
@keyframes jellyShadow{0%,100%{transform:scaleX(1)}15%{transform:scaleX(1.15)}35%{transform:scaleX(.88)}}
@keyframes noodleL{0%,100%{transform:rotate(-30deg)}30%{transform:rotate(60deg)}60%{transform:rotate(-10deg)}}
@keyframes noodleR{0%,100%{transform:rotate(30deg)}30%{transform:rotate(-60deg)}60%{transform:rotate(10deg)}}
@keyframes shimmy{0%,100%{transform:translateX(-1px) rotate(-3deg)}50%{transform:translateX(1px) rotate(3deg)}}
@keyframes lightHi{0%,100%{opacity:0}8%,18%{opacity:.45}26%{opacity:0}}
@keyframes eqC{0%,100%{transform:scaleY(.6)}25%{transform:scaleY(1)}75%{transform:scaleY(.2)}}
`

const MOTION: Record<Mood, { pet: string; shadow: string; arms?: [string, string] }> = {
  idle: { pet: 'bob 1.4s steps(1) infinite', shadow: 'bobShadow 1.4s steps(1) infinite' },
  working: {
    pet: 'bob .6s steps(1) infinite',
    shadow: 'bobShadow .6s steps(1) infinite',
    arms: ['waveL .6s steps(2) infinite', 'waveR .6s steps(2) infinite .3s'],
  },
  happy: {
    pet: 'hop 1s ease-in-out infinite',
    shadow: 'hopShadow 1s ease-in-out infinite',
    arms: ['waveL .5s ease-in-out infinite', 'waveR .5s ease-in-out infinite'],
  },
  sad: { pet: 'droop 2.4s ease-in-out infinite', shadow: 'bobShadow 2.4s ease-in-out infinite' },
  sleepy: { pet: 'breathe 3s ease-in-out infinite', shadow: 'bobShadow 3s ease-in-out infinite' },
  loved: {
    pet: 'wiggle .8s ease-in-out infinite',
    shadow: 'bobShadow .8s steps(1) infinite',
    arms: ['waveL .8s ease-in-out infinite', 'waveR .8s ease-in-out infinite'],
  },
  // Two beats a second: sway left, bounce, sway right, bounce, pointing up
  // with one arm and then the other.
  vibing: {
    pet: 'groove 1s ease-in-out infinite',
    shadow: 'grooveShadow 1s ease-in-out infinite',
    arms: ['discoL 1s steps(1) infinite', 'discoR 1s steps(1) infinite'],
  },
}

function effects(mood: Mood): string {
  const fx = (g: Grid, x: number, y: number, anim: string) =>
    group('fx', rects(g, x, y), `animation:${anim}`)
  switch (mood) {
    case 'idle':
      return fx(SPARK, 26, 8, 'twinkle 3s ease-in-out infinite 1s')
    case 'working':
      return (
        fx(BUBBLE, 3, 30, 'riseSway 2.2s linear infinite') +
        fx(SMALL_BUBBLE, 35, 30, 'rise 1.8s linear infinite .6s') +
        fx(BUBBLE, 33, 28, 'riseSway 2.6s linear infinite 1.3s') +
        fx(SMALL_BUBBLE, 6, 26, 'rise 2s linear infinite 1.7s')
      )
    case 'happy':
      return (
        fx(SPARK, 4, 10, 'twinkle 1.2s ease-in-out infinite') +
        fx(SPARK, 33, 14, 'twinkle 1.2s ease-in-out infinite .4s') +
        fx(SPARK, 30, 4, 'twinkle 1.2s ease-in-out infinite .8s') +
        fx(SPARK, 2, 24, 'twinkle 1.2s ease-in-out infinite .6s')
      )
    case 'loved':
      return (
        fx(HEART, 2, 18, 'riseSway 2s linear infinite') +
        fx(HEART, 33, 16, 'riseSway 2.2s linear infinite .7s') +
        fx(HEART, 28, 6, 'riseSway 2.4s linear infinite 1.4s')
      )
    case 'sad':
      return (
        group('fx', rects(CLOUD, 13, 0), 'animation:cloudBob 2s steps(1) infinite') +
        fx(DROP, 16, 6, 'fall .9s linear infinite') +
        fx(DROP, 20, 6, 'fall .9s linear infinite .3s') +
        fx(DROP, 23, 6, 'fall .9s linear infinite .6s')
      )
    case 'sleepy':
      return (
        fx(ZED, 27, 9, 'drift 3s ease-out infinite') +
        fx(ZED_BIG, 30, 5, 'drift 3s ease-out infinite 1.5s')
      )
    case 'vibing':
      return (DANCES[0]!).effects()
  }
}

// ---------------------------------------------------------------- the dances
//
// While Apple Music plays, the overlay switches between these every 10 to 15
// seconds. Each has the disco shades, its own mouth, moves and effects.

type Dance = {
  name: string
  mouth: Grid
  motion: { pet: string; shadow: string; arms: [string, string] }
  /** Where Plip turns about, when not its feet. */
  origin?: string
  /** Coloured light over Plip's body; the ball's slow wash when left out. */
  wash?: () => string
  /** Drawn behind Plip. */
  backdrop?: () => string
  /** Drawn in front of Plip. */
  effects: () => string
}

const fx = (g: Grid, x: number, y: number, anim: string, cls = 'fx') =>
  group(cls, rects(g, x, y), `animation:${anim}`)

const ball = () => rects(BALL, 16, 0) + fx(BALL_TURN, 16, 0, 'spin .5s steps(1) infinite')

const floor = (beat: number) =>
  FLOOR_COLORS.map((color, i) => fx(TILE(color), 10 + i * 4, 42, `flash ${beat}s steps(1) infinite ${(i % 2) * (beat / 2)}s`)).join('')

const DANCES: readonly Dance[] = [
  {
    // Sway left, bounce, sway right, bounce, pointing up with one arm and
    // then the other; notes float up and the floor flashes.
    name: 'groove',
    mouth: MOUTH_GRIN,
    motion: {
      pet: 'groove 1s ease-in-out infinite',
      shadow: 'grooveShadow 1s ease-in-out infinite',
      arms: ['discoL 1s steps(1) infinite', 'discoR 1s steps(1) infinite'],
    },
    effects: () =>
      floor(0.5) +
      ball() +
      fx(GLEAM(C.discoPink), 9, 2, 'twinkle .5s ease-in-out infinite') +
      fx(GLEAM(C.discoCyan), 34, 6, 'twinkle .5s ease-in-out infinite .25s') +
      fx(GLEAM(C.discoLime), 30, 1, 'twinkle .5s ease-in-out infinite .12s') +
      fx(GLEAM(C.discoPurple), 2, 13, 'twinkle .5s ease-in-out infinite .37s') +
      fx(NOTE_PINK, 33, 22, 'riseSway 2s linear infinite') +
      fx(NOTE_CYAN, 2, 26, 'riseSway 2.2s linear infinite .7s') +
      fx(NOTE_YELLOW, 35, 30, 'riseSway 2.4s linear infinite 1.4s'),
  },
  {
    // A twirl on the spot, arms flapping, while spotlights sweep down from
    // the ball and sparkles pop.
    name: 'twirl',
    mouth: MOUTH_OOH,
    motion: {
      pet: 'twirl 1.4s ease-in-out infinite',
      shadow: 'twirlShadow 1.4s ease-in-out infinite',
      arms: ['flapL .35s ease-in-out infinite', 'flapR .35s ease-in-out infinite'],
    },
    backdrop: () =>
      [C.discoPink, C.discoCyan, C.discoYellow]
        .map((color, i) =>
          group(
            'beam',
            `<polygon points="19.5,5 13,44 26,44" fill="${color}" opacity=".2"/>`,
            `animation:sweep ${2.4 + i * 0.5}s ease-in-out infinite alternate ${-i * 0.9}s`,
          ),
        )
        .join(''),
    effects: () =>
      ball() +
      fx(SPARK, 3, 12, 'twinkle .7s ease-in-out infinite') +
      fx(SPARK, 34, 16, 'twinkle .7s ease-in-out infinite .35s') +
      fx(SPARK, 31, 3, 'twinkle .7s ease-in-out infinite .2s') +
      fx(SPARK, 5, 30, 'twinkle .7s ease-in-out infinite .55s') +
      fx(SPARK, 35, 32, 'twinkle .7s ease-in-out infinite .1s'),
  },
  {
    // Big jumps with both arms pumping, confetti pouring down and the floor
    // flashing double time.
    name: 'jump',
    mouth: MOUTH_WOO,
    motion: {
      pet: 'jump .55s ease-in-out infinite',
      shadow: 'jumpShadow .55s ease-in-out infinite',
      arms: ['pumpL .55s ease-in-out infinite', 'pumpR .55s ease-in-out infinite'],
    },
    effects: () =>
      floor(0.27) +
      ball() +
      [3, 9, 14, 25, 30, 36, 6, 33, 20, 11, 28, 1]
        .map((x, i) =>
          fx(CONFETTI(PARTY[i % PARTY.length]!), x, (i * 3) % 7, `confetti ${1.6 + (i % 4) * 0.25}s linear infinite ${(i * 0.37) % 2}s`),
        )
        .join(''),
  },
  {
    // The robot: a side-step slide across and back, a beat per step, arms
    // snapping up and down, with equalizer bars bouncing either side.
    name: 'robot',
    mouth: MOUTH_SMIRK,
    motion: {
      pet: 'slide 4s steps(1) infinite',
      shadow: 'slideShadow 4s steps(1) infinite',
      arms: ['robotL 1s steps(1) infinite', 'robotR 1s steps(1) infinite'],
    },
    effects: () =>
      ball() +
      [0, 2, 4, 35, 37, 39]
        .map((x, i) =>
          fx(EQ_BAR(PARTY[i % PARTY.length]!), x, 30, `${['eqA', 'eqB', 'eqC'][i % 3]} ${0.5 + (i % 2) * 0.25}s ease-in-out infinite`, 'fx eq'),
        )
        .join('') +
      fx(NOTE_PINK, 31, 14, 'riseSway 2.2s linear infinite') +
      fx(NOTE_CYAN, 6, 12, 'riseSway 2.6s linear infinite 1.1s'),
  },
  {
    // Rock out: fast head-banging with devil horns up, lightning flashing and
    // red stage lights pulsing from the floor.
    name: 'headbang',
    mouth: MOUTH_TONGUE,
    motion: {
      pet: 'headbang .4s ease-in-out infinite',
      shadow: 'bobShadow .4s ease-in-out infinite',
      arms: ['hornsL .4s ease-in-out infinite', 'hornsR .4s ease-in-out infinite'],
    },
    backdrop: () =>
      [
        ['0,44 9,44 22,0', C.discoRed, 0],
        ['31,44 40,44 18,0', C.discoOrange, 0.4],
      ]
        .map(([points, color, delay]) =>
          group('fx', `<polygon points="${points}" fill="${color}"/>`, `opacity:.1;animation:stage .8s ease-in-out infinite ${delay}s`),
        )
        .join(''),
    effects: () =>
      fx(BOLT(C.discoYellow), 3, 6, 'zap 1.6s linear infinite') +
      fx(BOLT(C.discoYellow), 33, 10, 'zap 1.6s linear infinite .8s') +
      fx(BOLT(C.shine), 30, 1, 'zap 2.1s linear infinite .3s') +
      fx(STAR(C.discoOrange), 4, 28, 'twinkle .4s ease-in-out infinite') +
      fx(STAR(C.discoRed), 33, 30, 'twinkle .4s ease-in-out infinite .2s'),
  },
  {
    // The moonwalk: gliding backwards across the floor, turning at each end,
    // through drifting fog under twinkling stars.
    name: 'moonwalk',
    mouth: MOUTH_OOH,
    motion: {
      pet: 'moonwalk 4s linear infinite',
      shadow: 'moonShadow 4s linear infinite',
      arms: ['glideL 1s ease-in-out infinite', 'glideR 1s ease-in-out infinite'],
    },
    effects: () =>
      ball() +
      fx(STAR(C.discoCyan), 4, 4, 'twinkle 1.6s ease-in-out infinite') +
      fx(STAR(C.discoPurple), 31, 8, 'twinkle 1.6s ease-in-out infinite .8s') +
      fx(SPARK, 9, 14, 'twinkle 1.2s ease-in-out infinite .4s') +
      fx(FOG, 2, 39, 'fogDrift 3s linear infinite') +
      fx(FOG, 14, 40, 'fogDrift 3.4s linear infinite 1s') +
      fx(FOG, 26, 39, 'fogDrift 2.8s linear infinite 2s'),
  },
  {
    // Breakdance: a full windmill spin, speed lines whooshing past and stars
    // spinning off.
    name: 'windmill',
    mouth: MOUTH_WOO,
    origin: '50% 60%',
    motion: {
      pet: 'windmill 1.2s linear infinite',
      shadow: 'windShadow .6s ease-in-out infinite',
      arms: ['flapL .3s ease-in-out infinite', 'flapR .3s ease-in-out infinite'],
    },
    effects: () =>
      floor(0.3) +
      fx(STREAK(C.discoCyan), 2, 16, 'streak .5s linear infinite') +
      fx(STREAK(C.discoPink), 1, 26, 'streak .5s linear infinite .25s') +
      fx(STREAK(C.discoLime), 34, 20, 'streakR .5s linear infinite .12s') +
      fx(STREAK(C.discoYellow), 35, 30, 'streakR .5s linear infinite .37s') +
      fx(STAR(C.discoYellow), 4, 4, 'twinkle .6s ease-in-out infinite') +
      fx(STAR(C.discoPink), 31, 3, 'twinkle .6s ease-in-out infinite .3s'),
  },
  {
    // Party with friends: two tiny droplets hop along on either side, a beat
    // apart, while Plip side-hops between them.
    name: 'buddies',
    mouth: MOUTH_GRIN,
    motion: {
      pet: 'sideHop .8s ease-in-out infinite',
      shadow: 'grooveShadow .8s ease-in-out infinite',
      arms: ['discoL .8s steps(1) infinite', 'discoR .8s steps(1) infinite'],
    },
    effects: () =>
      floor(0.4) +
      ball() +
      fx(BUDDY(C.discoPink), 0, 33, 'buddyHop .8s ease-in-out infinite') +
      fx(BUDDY(C.discoLime), 33, 33, 'buddyHop .8s ease-in-out infinite .4s') +
      fx(NOTE_YELLOW, 3, 18, 'riseSway 2s linear infinite .5s') +
      fx(NOTE_CYAN, 34, 16, 'riseSway 2.2s linear infinite 1.2s'),
  },
  {
    // Jelly: a full-body wobble, arms going noodly, rainbow bubbles rising.
    name: 'jelly',
    mouth: MOUTH_SMIRK,
    motion: {
      pet: 'jelly 1.1s ease-in-out infinite',
      shadow: 'jellyShadow 1.1s ease-in-out infinite',
      arms: ['noodleL 1.1s ease-in-out infinite', 'noodleR 1.1s ease-in-out infinite'],
    },
    effects: () =>
      ball() +
      PARTY.map((color, i) =>
        fx(RAINBOW_BUBBLE(color), [2, 34, 6, 31, 18][i]!, 32 - (i % 2) * 4, `riseSway ${2 + i * 0.3}s linear infinite ${i * 0.45}s`),
      ).join(''),
  },
  {
    // Rainbow mode: a fast shimmy under rainbow arcs while every colour of the
    // party washes over Plip in turn.
    name: 'rainbow',
    mouth: MOUTH_WOO,
    motion: {
      pet: 'shimmy .3s ease-in-out infinite',
      shadow: 'bobShadow .3s ease-in-out infinite',
      arms: ['waveL .3s ease-in-out infinite', 'waveR .3s ease-in-out infinite .15s'],
    },
    wash: () => wash([...PARTY, C.discoOrange], 1.2, 'lightHi'),
    backdrop: () =>
      [C.discoRed, C.discoOrange, C.discoYellow, C.discoLime, C.discoCyan, C.discoPurple]
        .map((color, i) => {
          const r = 19 - i * 2
          return `<path d="M${20 - r},44 A${r},${r} 0 0 1 ${20 + r},44" fill="none" stroke="${color}" stroke-width="2" opacity=".45"/>`
        })
        .join(''),
    effects: () =>
      fx(STAR(C.discoYellow), 3, 3, 'twinkle .6s ease-in-out infinite') +
      fx(STAR(C.discoPink), 32, 5, 'twinkle .6s ease-in-out infinite .3s') +
      fx(GLEAM(C.discoCyan), 18, 1, 'twinkle .6s ease-in-out infinite .15s'),
  },
]

/** How many dances `petSvg('vibing', size, dance)` knows. */
export const DANCE_COUNT = DANCES.length

/** Colours flooding Plip's body one after another, `period` seconds round. */
function wash(colors: readonly string[], period: number, keyframes: string): string {
  return colors
    .map((color, i) =>
      group('fx', rects(lightOn(color), OX, OY), `opacity:0;animation:${keyframes} ${period}s linear infinite ${(i * period) / colors.length}s`),
    )
    .join('')
}

function discoLights(): string {
  return wash(LIGHT_COLORS, 1.5, 'light')
}

/** Plip in a mood; for 'vibing', `dance` picks one of DANCE_COUNT dances. */
export function petSvg(mood: Mood, size: number, dance = 0): string {
  const moves = mood === 'vibing' ? DANCES[dance % DANCES.length] : undefined
  const face = moves ? { ...FACES.vibing, mouth: moves.mouth } : FACES[mood]
  const motion = moves ? moves.motion : MOTION[mood]
  const armL = group('armL', rects(arm(-1), OX, OY), motion.arms ? `animation:${motion.arms[0]}` : '')
  const armR = group('armR', rects(arm(1), OX, OY), motion.arms ? `animation:${motion.arms[1]}` : '')
  const eyes = group('eyes', rects(face.eyes, OX, OY), mood === 'idle' || mood === 'working' ? '' : 'animation:none')
  const pet = group(
    'pet',
    armL + armR + rects(FEET, OX, OY) + rects(BODY, OX, OY) + rects(BLUSH, OX, OY) + (moves ? (moves.wash ?? discoLights)() : '') + eyes + rects(face.mouth, OX, OY) + (face.extra ? rects(face.extra, OX, OY) : ''),
    `animation:${motion.pet}${moves?.origin ? `;transform-origin:${moves.origin}` : ''}`,
  )
  const shadow = group(
    'shadow',
    `<ellipse cx="${OX + 16}" cy="${OY + 32.6}" rx="9" ry="1.4" fill="#3d93d6" opacity=".28"/>`,
    `animation:${motion.shadow}`,
  )
  const h = Math.round((size * H) / W)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${size}" height="${h}" shape-rendering="crispEdges">` +
    `<style>${CSS}</style>` +
    (moves?.backdrop?.() ?? '') +
    shadow +
    pet +
    (moves ? moves.effects() : effects(mood)) +
    `</svg>`
  )
}

export const PET_ASPECT = H / W

// ---------------------------------------------------------------- terminal
//
// The terminal has no SVG, but it draws a Raster: a grid of cells, each a
// character with a foreground and a background color. With the upper half
// block, one cell holds two pixels stacked, so the 40 x 44 canvas becomes
// 40 columns by 22 rows. Animation is a frame counter: each frame is drawn
// whole and blitted over the last.

export const RASTER_COLUMNS = W
export const RASTER_ROWS = H / 2

const SHADOW_COLOR = '#22405f'

function layer(into: Grid, g: Grid, dx: number, dy: number): void {
  for (const [k, color] of g) {
    const [x = 0, y = 0] = k.split(',').map(Number)
    into.set(key(x + dx, y + dy), color)
  }
}

function closedEyes(): Grid {
  return FACES.sleepy.eyes
}

function frameOf(mood: Mood, t: number): Grid {
  const canvas: Grid = new Map()
  const hop = [0, -2, -4, -2, 0, 0]
  const wiggle = [-1, 0, 1, 0]
  const dy =
    mood === 'happy' ? (hop[t % hop.length] ?? 0)
    : mood === 'sad' ? t % 4 < 2 ? 0 : 1
    : mood === 'sleepy' ? 0
    : mood === 'loved' ? 0
    : mood === 'vibing' ? t % 2 === 0 ? 0 : -2
    : t % 2 === 0 ? 0 : -1
  const dx = mood === 'loved' ? (wiggle[t % wiggle.length] ?? 0) : mood === 'vibing' ? (t % 4 < 2 ? -1 : 1) : 0
  const isWaving = mood === 'working' || mood === 'happy' || mood === 'loved' || mood === 'vibing'
  const blinks = (mood === 'idle' || mood === 'working') && t % 10 === 9

  // The shadow shrinks while Plip is up in the air.
  const rx = dy <= -3 ? 5 : dy < 0 ? 8 : 9
  for (let x = -rx; x < rx; x++) canvas.set(key(OX + 16 + x, OY + 33), SHADOW_COLOR)

  const px = OX + dx
  const py = OY + dy
  layer(canvas, arm(-1), px, py + (isWaving && t % 2 === 0 ? -2 : 0))
  layer(canvas, arm(1), px, py + (isWaving && t % 2 === 1 ? -2 : 0))
  layer(canvas, FEET, px, py)
  layer(canvas, BODY, px, py)
  layer(canvas, BLUSH, px, py)
  layer(canvas, blinks ? closedEyes() : FACES[mood].eyes, px, py)
  layer(canvas, FACES[mood].mouth, px, py)
  const extra = FACES[mood].extra
  if (extra) layer(canvas, extra, px, py)

  const rise = (period: number, offset: number) => ((t + offset) % period) * 2
  switch (mood) {
    case 'idle':
      if (t % 6 < 3) layer(canvas, SPARK, 26, 8)
      break
    case 'working':
      layer(canvas, BUBBLE, 3 + (t % 4 < 2 ? 0 : 1), 32 - rise(11, 0))
      layer(canvas, SMALL_BUBBLE, 35, 32 - rise(9, 4))
      layer(canvas, BUBBLE, 33 + (t % 4 < 2 ? 1 : 0), 30 - rise(12, 7))
      break
    case 'happy':
      if (t % 2 === 0) layer(canvas, SPARK, 4, 10)
      if (t % 2 === 1) layer(canvas, SPARK, 33, 14)
      if (t % 3 === 0) layer(canvas, SPARK, 30, 4)
      if (t % 3 === 1) layer(canvas, SPARK, 2, 24)
      break
    case 'loved':
      layer(canvas, HEART, 2 + (t % 4 < 2 ? 0 : 1), 22 - rise(10, 0))
      layer(canvas, HEART, 33 - (t % 4 < 2 ? 0 : 1), 20 - rise(10, 5))
      break
    case 'sad':
      layer(canvas, CLOUD, 13, 0)
      for (const [x, off] of [[16, 0], [20, 1], [23, 2]] as const) {
        layer(canvas, DROP, x, 6 + ((t + off) % 3) * 2)
      }
      break
    case 'sleepy':
      layer(canvas, ZED, 27 + (t % 8) / 2, 9 - (t % 8))
      if (t % 8 >= 4) layer(canvas, ZED_BIG, 30, 2)
      break
    case 'vibing':
      FLOOR_COLORS.forEach((color, i) => {
        if ((i + t) % 2 === 0) layer(canvas, TILE(color), 10 + i * 4, 42)
      })
      layer(canvas, BALL, 16, 0)
      if (t % 2 === 1) layer(canvas, BALL_TURN, 16, 0)
      layer(canvas, NOTE_PINK, 33, 22 - rise(10, 0))
      layer(canvas, NOTE_CYAN, 2, 26 - rise(10, 5))
      if (t % 2 === 0) layer(canvas, GLEAM(C.discoPink), 9, 2)
      if (t % 2 === 1) layer(canvas, GLEAM(C.discoCyan), 34, 6)
      break
  }
  return canvas
}

const DEFAULT_COLOR = 0x01000000
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584

function rgb(color: string | undefined): number | undefined {
  return color === undefined ? undefined : parseInt(color.slice(1), 16)
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += b === undefined ? '=' : B64[(n >> 6) & 63]!
    out += c === undefined ? '=' : B64[n & 63]!
  }
  return out
}

/** One frame of Plip as a Raster's `cells`, RASTER_COLUMNS x RASTER_ROWS. */
export function petCells(mood: Mood, t: number): string {
  const canvas = frameOf(mood, t)
  const words = new Uint32Array(RASTER_COLUMNS * RASTER_ROWS * 3)
  let i = 0
  for (let row = 0; row < RASTER_ROWS; row++) {
    for (let x = 0; x < RASTER_COLUMNS; x++) {
      const top = rgb(canvas.get(key(x, row * 2)))
      const bottom = rgb(canvas.get(key(x, row * 2 + 1)))
      if (top === undefined && bottom === undefined) {
        words.set([0x20, DEFAULT_COLOR, DEFAULT_COLOR], i)
      } else if (top === undefined) {
        words.set([LOWER_HALF, bottom!, DEFAULT_COLOR], i)
      } else {
        words.set([UPPER_HALF, top, bottom ?? DEFAULT_COLOR], i)
      }
      i += 3
    }
  }
  // Uint32Array stores in the platform's byte order, little-endian everywhere
  // this runs; the Raster wants little-endian.
  return base64(new Uint8Array(words.buffer))
}
