export type Mood = 'idle' | 'working' | 'happy' | 'sad' | 'sleepy' | 'loved' | 'vibing'
export type Stats = { pets: number; splashes: number }

declare module 'claude-code' {
  interface PluginState {
    'plip-pet': { mood: Mood; stats: Stats; tools: number }
  }
}
