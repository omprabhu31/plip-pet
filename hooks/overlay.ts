// The bridge to Plip's desktop overlay (overlay/PlipOverlay.swift), a small
// macOS app that floats Plip above every window. Nothing here draws: each
// session writes what Plip feels to ~/.plip, and the overlay reads it.
//
//   ~/.plip/sessions/<session id>.json  this session's mood, line and stats
//   ~/.plip/sprites/<mood>.svg          the art, so the overlay draws today's Plip
//   ~/.plip/sprites/vibing-<n>.svg      each dance, which the overlay switches between
//   ~/.plip/inbox/pet-*                 pets given on the overlay, claimed here
//   ~/.plip/overlay-installed           written by overlay/install.sh
//   ~/.plip/overlay-disabled            the overlay is turned off (`/plip overlay off`)

import type { EngineInterface } from 'claude-code'

import type { Mood } from '../types'
import { DANCE_COUNT } from './sprite'

export type Snapshot = { mood: Mood; line: string; pets: number; splashes: number; tools: number }

// 'vibing' is the overlay's own: it plays while Apple Music does.
const MOODS: readonly Mood[] = ['idle', 'working', 'happy', 'sad', 'sleepy', 'loved', 'vibing']
const SPRITE_SIZE = 160
// The overlay's login item (a launchd agent), as overlay/install.sh adds it.
const LABEL = 'com.omprabhu31.plip-overlay'

const bridge = {
  home: undefined as string | undefined,
  dir: undefined as string | undefined,
  sessionFile: undefined as string | undefined,
  isOn: false,
  isPending: false,
  lastError: undefined as string | undefined,
  snapshot: undefined as (() => Promise<Snapshot>) | undefined,
}

export function overlayStatus() {
  return {
    dir: bridge.dir ?? 'off (not macOS, or not started)',
    isOn: bridge.isOn,
    sessionFile: bridge.sessionFile,
    lastError: bridge.lastError,
  }
}

async function homeDir($: EngineInterface): Promise<string | undefined> {
  const os = await $.process.run(['/usr/bin/uname', '-s'], { timeoutMs: 5000 })
  if (os.stdout.trim() !== 'Darwin') return undefined
  const home = await $.process.run(['/bin/sh', '-c', 'cd ~ && pwd -P'], { timeoutMs: 5000 })
  const path = home.stdout.trim()
  return home.exitCode === 0 && path.startsWith('/') ? path : undefined
}

export async function startOverlayBridge(
  $: EngineInterface,
  snapshot: () => Promise<Snapshot>,
  svgFor: (mood: Mood, size: number, dance?: number) => string,
): Promise<{ isOn: boolean }> {
  try {
    const home = await homeDir($)
    if (home === undefined) return { isOn: false }
    const dir = `${home}/.plip`
    bridge.home = home
    bridge.dir = dir
    bridge.snapshot = snapshot
    bridge.sessionFile = `${dir}/sessions/${await $.session.id()}.json`
    bridge.isOn = (await overlayState($)) === 'on'
    for (const m of MOODS) await $.fs.write(`${dir}/sprites/${m}.svg`, svgFor(m, SPRITE_SIZE))
    for (let n = 0; n < DANCE_COUNT; n++) {
      await $.fs.write(`${dir}/sprites/vibing-${n}.svg`, svgFor('vibing', SPRITE_SIZE, n))
    }
    await write($)
  } catch (err) {
    bridge.lastError = String(err)
  }
  return { isOn: bridge.isOn }
}

type OverlayState = 'on' | 'off' | 'not installed' | 'not macOS'

async function overlayState($: EngineInterface): Promise<OverlayState> {
  if (bridge.dir === undefined) return 'not macOS'
  if (!(await $.fs.exists(`${bridge.dir}/overlay-installed`))) return 'not installed'
  return (await $.fs.exists(`${bridge.dir}/overlay-disabled`)) ? 'off' : 'on'
}

async function launchctl($: EngineInterface, ...args: string[]) {
  return $.process.run(['/bin/launchctl', ...args], { timeoutMs: 10_000 }).catch(err => ({
    exitCode: 1,
    stdout: '',
    stderr: String(err),
  }))
}

/**
 * `/plip overlay [on|off]`: turns the desktop overlay on or off, login item
 * included, or says which it is. Resolves the reply, and whether Plip now
 * belongs back in the app's corner.
 */
export async function overlayCommand($: EngineInterface, wanted: string | undefined): Promise<{ text: string; isOff: boolean }> {
  const state = await overlayState($)
  if (state === 'not macOS') return { text: 'Plip\'s desktop overlay is for macOS only.', isOff: true }
  if (state === 'not installed') {
    return {
      text: 'Plip Overlay isn\'t installed yet. Install it from your copy of the plip-pet repository with `overlay/install.sh` (the README has the steps).',
      isOff: true,
    }
  }
  if (wanted !== 'on' && wanted !== 'off') {
    const how = state === 'on' ? 'Turn it off with `/plip overlay off`.' : 'Turn it on with `/plip overlay on`.'
    return { text: `Plip's desktop overlay is ${state}. ${how}`, isOff: state === 'off' }
  }

  const id = await $.process.run(['/usr/bin/id', '-u'], { timeoutMs: 5000 })
  const service = `gui/${id.stdout.trim()}/${LABEL}`
  const disabled = `${bridge.dir}/overlay-disabled`

  if (wanted === 'off') {
    await $.fs.write(disabled, '')
    await launchctl($, 'disable', service) // no start at the next login
    await launchctl($, 'bootout', service) // and closed now
    await $.process.run(['/usr/bin/pkill', '-x', 'PlipOverlay'], { timeoutMs: 5000 }).catch(() => undefined)
    bridge.isOn = false
    return {
      text: 'Plip Overlay is off: it\'s closed and won\'t start at login, so Plip is back in the app\'s corner. Turn it on again with `/plip overlay on`.',
      isOff: true,
    }
  }

  await $.process.run(['/bin/rm', '-f', disabled], { timeoutMs: 5000 })
  await launchctl($, 'enable', service)
  // Loads the login item when it isn't (fails harmlessly when it is), then
  // starts it.
  await launchctl($, 'bootstrap', service.slice(0, service.lastIndexOf('/')), `${bridge.home}/Library/LaunchAgents/${LABEL}.plist`)
  const started = await launchctl($, 'kickstart', service)
  bridge.isOn = true
  if (started.exitCode !== 0) {
    return {
      text: `Plip Overlay is turned on and will start at your next login, but it didn't start now (${started.stderr.trim() || `launchctl exit ${started.exitCode}`}). Running \`overlay/install.sh\` again sets it up afresh.`,
      isOff: false,
    }
  }
  return { text: 'Plip Overlay is on: Plip is back on your desktop and starts at login again.', isOff: false }
}

async function write($: EngineInterface): Promise<void> {
  if (bridge.sessionFile === undefined || bridge.snapshot === undefined) return
  const snap = await bridge.snapshot()
  const doc = { ...snap, updatedAt: await $.clock.now() }
  await $.fs.write(bridge.sessionFile, JSON.stringify(doc))
}

// Coalesces a burst of changes (a mood, a stat, a tool count) into one write.
export function publish($: EngineInterface): void {
  if (bridge.sessionFile === undefined || bridge.isPending) return
  bridge.isPending = true
  $.clock.after(150, () => {
    bridge.isPending = false
    void write($).catch(err => void (bridge.lastError = String(err)))
  })
}

// Each pet is its own file; removing it is the claim, so with several
// sessions open every pet is counted once.
export async function claimOverlayPets($: EngineInterface): Promise<number> {
  if (bridge.dir === undefined) return 0
  const inbox = `${bridge.dir}/inbox`
  const entries = await $.fs.list(inbox).catch(() => [])
  let claimed = 0
  for (const entry of entries) {
    if (!entry.name.startsWith('pet-')) continue
    const rm = await $.process.run(['/bin/rm', `${inbox}/${entry.name}`], { timeoutMs: 5000 }).catch(() => undefined)
    if (rm?.exitCode === 0) claimed += 1
  }
  return claimed
}

export async function stopOverlayBridge($: EngineInterface): Promise<void> {
  if (bridge.sessionFile === undefined) return
  await $.process.run(['/bin/rm', '-f', bridge.sessionFile], { timeoutMs: 5000 })
  bridge.sessionFile = undefined
}
