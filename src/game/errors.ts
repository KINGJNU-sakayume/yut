/** A rule violation the UI can show to the player (the state is left unchanged). */
export class EngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EngineError'
  }
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new EngineError(message)
}
