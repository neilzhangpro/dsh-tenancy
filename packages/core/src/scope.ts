import { TenantDisposedError } from './errors.js'

export type ScopeKey = string & { readonly __scopeKey: unique symbol }
export type Cleanup = () => void | Promise<void>

export interface Scope {
  readonly key: ScopeKey
  readonly parent?: Scope
  readonly disposed: boolean
  register<T>(name: string, value: T): Cleanup
  get<T>(name: string): T | undefined
  own(cleanup: Cleanup): void
  dispose(): Promise<void>
}

export interface ScopeAdapter {
  readonly root: Scope
  create(kind: 'tenant' | 'agent', parent: Scope): Scope
}

let nextScopeId = 0

class MemoryScope implements Scope {
  readonly key: ScopeKey
  readonly parent?: Scope
  #disposed = false
  #values = new Map<string, unknown>()
  #cleanups: Cleanup[] = []

  constructor(kind: 'root' | 'tenant' | 'agent', parent?: Scope) {
    this.key = `${kind}:${++nextScopeId}` as ScopeKey
    if (parent) this.parent = parent
  }

  get disposed(): boolean { return this.#disposed }

  register<T>(name: string, value: T): Cleanup {
    this.#assertLive()
    this.#values.set(name, value)
    let active = true
    const unregister = () => {
      if (active && this.#values.get(name) === value) this.#values.delete(name)
      active = false
    }
    this.own(unregister)
    return unregister
  }

  get<T>(name: string): T | undefined {
    this.#assertLive()
    if (this.#values.has(name)) return this.#values.get(name) as T
    return this.parent?.get<T>(name)
  }

  own(cleanup: Cleanup): void {
    this.#assertLive()
    this.#cleanups.push(cleanup)
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return
    this.#disposed = true
    const failures: unknown[] = []
    for (const cleanup of this.#cleanups.reverse()) {
      try { await cleanup() } catch (error) { failures.push(error) }
    }
    this.#cleanups.length = 0
    this.#values.clear()
    if (failures.length) throw new AggregateError(failures, `scope ${this.key} cleanup failed`)
  }

  #assertLive(): void {
    if (this.#disposed) throw new TenantDisposedError(`scope ${this.key} has been disposed`)
  }
}

export function createMemoryScopeAdapter(): ScopeAdapter {
  const root = new MemoryScope('root')
  return { root, create: (kind, parent) => new MemoryScope(kind, parent) }
}
