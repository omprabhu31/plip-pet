// The bridge to Plip's desktop overlay (overlay/PlipOverlay.swift), a small
// macOS app that floats Plip above every window. Nothing here draws: each
// session writes what Plip feels to ~/.plip, and the overlay reads it.
//
//   ~/.plip/sessions/<session id>.json  this session's mood, line and stats
//   ~/.plip/sprites/<mood>.svg          the art, so the overlay draws today's Plip
//   ~/.plip/sprites/vibing-<n>.svg      each dance, which the overlay switches between
//   ~/.plip/inbox/pet-*                 pets given on the overlay, claimed here
//   ~/.plip/overlay-installed           written by overlay/install.sh

import type { EngineInterface } from 'claude-code'

import type { Mood } from '../types'
import { DANCE_COUNT } from './sprite'

export type Snapshot = { mood: Mood; line: string; pets: number; splashes: number; tools: number }

// 'vibing' is the overlay's own: it plays while Apple Music does.
const MOODS: readonly Mood[] = ['idle', 'working', 'happy', 'sad', 'sleepy', 'loved', 'vibing']
const SPRITE_SIZE = 160

const bridge = {
  dir: undefined as string | undefined,
  sessionFile: undefined as string | undefined,
  isInstalled: false,
  isPending: false,
  lastError: undefined as string | undefined,
  snapshot: undefined as (() => Promise<Snapshot>) | undefined,
}

export function overlayStatus() {
  return {
    dir: bridge.dir ?? 'off (not macOS, or not started)',
    isInstalled: bridge.isInstalled,
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
): Promise<{ isInstalled: boolean }> {
  try {
    const home = await homeDir($)
    if (home === undefined) return { isInstalled: false }
    const dir = `${home}/.plip`
    bridge.dir = dir
    bridge.snapshot = snapshot
    bridge.sessionFile = `${dir}/sessions/${await $.session.id()}.json`
    bridge.isInstalled = await $.fs.exists(`${dir}/overlay-installed`)
    for (const m of MOODS) await $.fs.write(`${dir}/sprites/${m}.svg`, svgFor(m, SPRITE_SIZE))
    for (let n = 0; n < DANCE_COUNT; n++) {
      await $.fs.write(`${dir}/sprites/vibing-${n}.svg`, svgFor('vibing', SPRITE_SIZE, n))
    }
    await write($)
  } catch (err) {
    bridge.lastError = String(err)
  }
  return { isInstalled: bridge.isInstalled }
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
