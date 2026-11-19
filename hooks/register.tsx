import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mood, Stats } from '../types'
import { petCells, petSvg, RASTER_COLUMNS, RASTER_ROWS } from './sprite'
import { claimOverlayPets, overlayCommand, overlayStatus, publish, startOverlayBridge, stopOverlayBridge } from './overlay'

const PANE = 'plip'
const SLEEP_AFTER_MS = 5 * 60 * 1000

const mood = atom({ plugin: 'plip-pet', key: 'mood' } as const, 'idle')
const stats = atom({ plugin: 'plip-pet', key: 'stats' } as const, { pets: 0, splashes: 0 })
const tools = atom({ plugin: 'plip-pet', key: 'tools' } as const, 0)

const LINES: Record<Mood, readonly string[]> = {
  idle: ['blub blub ♪', 'floating around~', 'stay hydrated!', '*bobs happily*'],
  working: ['splish splash…', 'on it!', 'swimming through code…'],
  happy: ['all done! ✨', 'ta-da!', 'yay, splash!'],
  sad: ['oh no… a little drizzle', 'that one went sploosh…', '*sniffle*'],
  sleepy: ['zzz…', 'dreaming of rain…', 'zzz… puddles…'],
  loved: ['hehe, that tickles! ♥', '♥ ♥ ♥', 'more pets please!'],
  vibing: ['♪ vibing ♪', 'disco time!', '*grooves*'],
}

// Terminal fallback: the terminal has no Svg, so Plip is drawn in text.
const FACE: Record<Mood, string> = {
  idle: '( •ᴗ• )',
  working: '( •o• )',
  happy: '( ^▽^ )',
  sad: '( ;︵; )',
  sleepy: '( -ᴗ- )',
  loved: '( ♥ᴗ♥ )',
  vibing: '(⌐■ᴗ■)',
}

const live = { isTurnRunning: false, lastActivity: 0, seq: 0, frame: 0, isRasterMounted: false, lastOpen: 'not opened yet', renders: [] as string[] }

export function lineFor(now: Mood, s: Stats, n: number): string {
  const lines = LINES[now]
  if (now === 'working' && n > 0) return `splish splash… ${n} tool call${n === 1 ? '' : 's'}`
  return lines[(s.splashes + s.pets) % lines.length] ?? ''
}

function baseMood(): Mood {
  return live.isTurnRunning ? 'working' : 'idle'
}

// Sets a mood; with `holdMs`, Plip drifts back to the base mood afterwards
// unless something newer changed it first.
async function feel($: EngineInterface, next: Mood, holdMs?: number): Promise<void> {
  const mine = ++live.seq
  live.lastActivity = await $.clock.now()
  await update($, mood, () => next)
  publish($)
  if (holdMs !== undefined) {
    $.clock.after(holdMs, () => {
      if (live.seq === mine) void update($, mood, () => baseMood()).then(() => publish($))
    })
  }
}

async function openPlip($: EngineInterface, asWidget: boolean): Promise<void> {
  const opened = await $.ui.open(
    asWidget
      ? { id: PANE, title: 'Plip', placement: 'widget', rows: RASTER_ROWS + 4, columns: RASTER_COLUMNS + 4 }
      : { id: PANE, title: 'Plip', rows: RASTER_ROWS + 4, columns: RASTER_COLUMNS + 4 },
  )
  live.lastOpen = opened.isPlaced ? 'placed' : `not placed: ${opened.reason}`
}

async function bump($: EngineInterface, field: keyof Stats): Promise<void> {
  await update($, stats, s => ({ ...s, [field]: s[field] + 1 }))
  await $.store.set('stats', await read($, stats))
  publish($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('stats')) as Partial<Stats> | undefined
    if (saved) {
      await update($, stats, () => ({ pets: saved.pets ?? 0, splashes: saved.splashes ?? 0 }))
    }
    live.lastActivity = await $.clock.now()
    await $.command.register({
      name: 'plip',
      description: 'Bring back Plip, your water droplet pet; `overlay on|off` turns its desktop overlay on or off',
      argumentHint: '[overlay on|off]',
    })
    const snapshot = async () => {
      const [m, s, n] = [await read($, mood), await read($, stats), await read($, tools)]
      return { mood: m, line: lineFor(m, s, n), pets: s.pets, splashes: s.splashes, tools: n }
    }
    // With the desktop overlay installed, Plip lives on the screen instead of
    // in the app's corner; a terminal session still gets its pane.
    void startOverlayBridge($, snapshot, petSvg)
      .then(async overlay => {
        const surfaces = overlay.isOn ? await $.session.surfaces() : []
        if (!overlay.isOn || surfaces.includes('terminal')) await openPlip($, true)
      })
      .catch(() => openPlip($, true))
    await $.tool.register({
      name: 'status',
      description: 'Plip diagnostics: open panes, attached surfaces, the last open result and recent draws. Pass reopen: true to open the pane again.',
      inputSchema: { type: 'object', properties: { reopen: { type: 'boolean' } } },
    })

    // The terminal's pixel Plip animates by repainting its Raster in place.
    $.clock.every(450, async () => {
      live.frame += 1
      if (!live.isRasterMounted) return
      try {
        const cells = petCells(await read($, mood), live.frame)
        const blitted = await $.ui.blit({ requestId: PANE, key: 'plip', cells })
        if ('deny' in blitted && blitted.deny) live.isRasterMounted = false
      } catch {
        live.isRasterMounted = false
      }
    })

    $.clock.every(30_000, async () => {
      const now = await $.clock.now()
      if (!live.isTurnRunning && now - live.lastActivity > SLEEP_AFTER_MS && (await read($, mood)) === 'idle') {
        await update($, mood, () => 'sleepy')
      }
      publish($)
    })

    // Pets given to the overlay arrive as files; each session claims its own.
    // They only count: the overlay shows its hearts while the pointer is on
    // Plip, and a mood from here would linger after it left.
    $.clock.every(1000, async () => {
      const claimed = await claimOverlayPets($)
      for (let i = 0; i < claimed; i++) await bump($, 'pets')
    })

    return next(e)
  })

  on('tool.run', { tool: 'mcp__plip-pet__status' }, async ($, e) => {
    if ((e as unknown as { reopen?: boolean }).reopen === true) await openPlip($, false)
    const info = {
      lastOpen: live.lastOpen,
      overlay: overlayStatus(),
      panes: await $.ui.panes(),
      surfaces: await $.session.surfaces(),
      recentRenders: live.renders,
    }
    return { result: JSON.stringify(info, null, 2) }
  })

  on('session.end', async ($, e, next) => {
    await stopOverlayBridge($).catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'plip' }, async ($, e) => {
    const [sub, wanted] = e.args.trim().toLowerCase().split(/\s+/)
    if (sub === 'overlay') {
      const reply = await overlayCommand($, wanted)
      // With the overlay off, Plip goes back to the app's corner straight away.
      if (reply.isOff && wanted === 'off') await openPlip($, true)
      return { text: reply.text }
    }

    await openPlip($, false)
    await feel($, 'happy', 3000)

    return { text: 'Plip splashed back in! 💧' }
  })

  on('prompt.submit', async ($, e, next) => {
    live.isTurnRunning = true
    // Plip's reactions never hold up the prompt: fire and forget.
    void update($, tools, () => 0)
      .then(() => feel($, 'working'))
      .then(() => publish($))
      .catch(() => undefined)

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const isOops = ran.isError === true || ran.deny !== undefined
    void update($, tools, n => n + 1)
      .then(() => publish($))
      .then(() => (isOops ? feel($, 'sad', 3500) : $.clock.now().then(t => void (live.lastActivity = t))))
      .catch(() => undefined)

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    live.isTurnRunning = false
    const react =
      e.reason === 'answer'
        ? bump($, 'splashes').then(() => feel($, 'happy', 6000))
        : e.reason === 'aborted'
          ? feel($, 'idle')
          : feel($, 'sad', 6000)
    void react.catch(() => undefined)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    live.renders = [...live.renders, `${e.surface}/${e.props.placement}`].slice(-8)
    const now = await read($, mood)
    const s = await read($, stats)
    const n = await read($, tools)
    const line = lineFor(now, s, n)

    const petMe = () => {
      void bump($, 'pets').catch(() => undefined)
      void feel($, 'loved', 4000).catch(() => undefined)
    }

    if (e.surface === 'terminal') {
      const { Box, Text, Button, Raster } = $.ui.resolve(e)
      const hasRoom = e.props.bodyColumns >= RASTER_COLUMNS
      live.isRasterMounted = hasRoom
      return (
        <Box flexDirection="column" alignItems="center">
          {hasRoom ? (
            <Raster
              key="plip"
              columns={RASTER_COLUMNS}
              rows={RASTER_ROWS}
              cells={petCells(now, live.frame)}
            />
          ) : (
            <Box flexDirection="column" alignItems="center">
              <Text color="cyan">   ,</Text>
              <Text color="cyan">  / \</Text>
              <Text color="cyan">{FACE[now]}</Text>
              <Text color="cyan"> `---´</Text>
            </Box>
          )}
          <Text>
            <Text bold color="cyan">Plip</Text>
            <Text dimColor>: {line}</Text>
          </Text>
          <Text dimColor>
            💧 {s.splashes} splashes · ♥ {s.pets} pets
          </Text>
          <Button key="pet" hotkey="p" onPress={petMe}>
            Pet Plip ♥
          </Button>
        </Box>
      )
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const alt = `Plip the water droplet, feeling ${now}`

    if (e.props.placement === 'widget') {
      return (
        <Box flexDirection="column" alignItems="center">
          <Svg source={petSvg(now, 96)} alt={alt} width={96} />
          <Text dimColor>{line}</Text>
        </Box>
      )
    }

    const size = Math.max(96, Math.min(180, e.props.bodyColumns * 6))
    return (
      <Box flexDirection="column" alignItems="center" gap={1}>
        <Svg source={petSvg(now, size)} alt={alt} width={size} />
        <Text bold>Plip</Text>
        <Text>{line}</Text>
        <Text dimColor>
          💧 {s.splashes} splashes · ♥ {s.pets} pets
        </Text>
        <Button key="pet" hotkey="p" onPress={petMe}>
          Pet Plip ♥
        </Button>
      </Box>
    )
  })
}
