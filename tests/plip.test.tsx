import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'plip-pet',
  component: 'Pane',
  requestId: 'plip',
  props: {
    title: 'Plip',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('Plip shows up, works with Claude and loves pets', async ($, on) => {
  on('command.register', () => ({ value: { command: 'plip' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('tool.register', () => ({ value: { tool: 'mcp__plip-pet__status' } }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('clock.now', () => ({ value: 0 }))
  on('store.get', () => ({ value: { pets: 41, splashes: 7 } }))
  on('store.set', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop', 'mobile', 'vscode'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Plip/ })).toBeTruthy()
    await ui.unmount()
  }

  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await term.find({ type: 'Raster' })).toBeTruthy()
  await term.unmount()

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'pet' })
  expect((await ui.find({ type: 'Text', text: /pets/ }))?.text).toContain('42 pets')
  await ui.unmount()

  const widget = await $.ui.mount({
    ...PANE,
    surface: 'desktop',
    props: { ...PANE.props, placement: 'widget', anchoredEdges: ['bottom', 'right'] },
  })
  expect(await widget.find({ type: 'Svg' })).toBeTruthy()
  await widget.unmount()
})

test('the desktop overlay hears moods, and pets given on it count once', async ($, on) => {
  const files = new Map<string, string>()
  const inbox = new Set(['pet-1', 'pet-2'])
  let opened = 0
  const clock = mock.clock(on, { now: 1_000 })
  mock.store(on, { stats: { pets: 1, splashes: 2 } })
  on('command.register', () => ({ value: { command: 'plip' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__plip-pet__status' } }))
  on('ui.open', () => ((opened += 1), { value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'abc' }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('fs.exists', (_, e) => ({ value: e.path === '/Users/u/.plip/overlay-installed' }))
  on('fs.write', (_, e) => (files.set(e.path, e.text), { value: undefined }))
  on('fs.list', () => ({ value: [...inbox].map(name => ({ name, kind: 'file', size: 0, mtimeMs: 0, isLink: false })) }))
  on('process.run', (_, e) => {
    const [cmd, ...args] = e.argv
    const out = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (cmd === '/usr/bin/uname') return out('Darwin\n')
    if (cmd === '/bin/sh') return out('/Users/u\n')
    if (cmd === '/bin/rm') {
      const name = args[args.length - 1]?.split('/').pop() ?? ''
      return out('', inbox.delete(name) || args[0] === '-f' ? 0 : 1)
    }
    return out('', 1)
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.settle()

  const state = () => JSON.parse(files.get('/Users/u/.plip/sessions/abc.json') ?? '{}')
  expect(files.has('/Users/u/.plip/sprites/working.svg')).toBe(true)
  expect(files.get('/Users/u/.plip/sprites/vibing.svg')).toContain('groove') // the disco
  for (const [n, move] of ['groove', 'twirl', 'jump', 'slide', 'headbang', 'moonwalk', 'windmill', 'buddyHop', 'jelly', 'shimmy'].entries()) {
    expect(files.get(`/Users/u/.plip/sprites/vibing-${n}.svg`)).toContain(move) // each dance
  }
  expect(state().mood).toBe('idle')
  expect(opened).toBe(0) // the overlay shows Plip, so the app's corner stays clear

  await $.prompt.submit({ text: 'hi' } as Parameters<typeof $.prompt.submit>[0])
  await clock.advance(200)
  expect(state().mood).toBe('working')

  await clock.advance(1_000)
  expect(inbox.size).toBe(0)
  await clock.advance(200)
  expect(state().pets).toBe(3)
  expect(state().mood).toBe('working') // the overlay draws its own hearts
})
