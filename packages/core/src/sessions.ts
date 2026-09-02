import { LegacySessionOwnershipError, SessionOwnershipError, TenantContextRequiredError } from './errors.js'
import type { TenantContext } from './runtime.js'
import type { TenantId } from './id.js'

export interface SessionOwner { readonly tenantId: TenantId; readonly sessionId: string }
export type SessionOwnershipRecord = SessionOwner | 'legacy'

export interface SessionOwnershipProvider {
  get(sessionId: string): Promise<SessionOwnershipRecord | undefined>
  claimIfAbsent(owner: SessionOwner): Promise<SessionOwnershipRecord>
  migrateLegacy(owner: SessionOwner): Promise<SessionOwnershipRecord>
}

export class MemorySessionOwnershipProvider implements SessionOwnershipProvider {
  #records = new Map<string, SessionOwnershipRecord>()
  async get(sessionId: string) { return this.#records.get(sessionId) }
  async claimIfAbsent(owner: SessionOwner): Promise<SessionOwnershipRecord> {
    const existing = this.#records.get(owner.sessionId)
    if (existing) return existing
    this.#records.set(owner.sessionId, Object.freeze({ ...owner }))
    return this.#records.get(owner.sessionId)!
  }
  async migrateLegacy(owner: SessionOwner): Promise<SessionOwnershipRecord> {
    const existing = this.#records.get(owner.sessionId)
    if (existing !== 'legacy') return existing ?? this.claimIfAbsent(owner)
    this.#records.set(owner.sessionId, Object.freeze({ ...owner }))
    return this.#records.get(owner.sessionId)!
  }
  markLegacy(sessionId: string): void { this.#records.set(sessionId, 'legacy') }
}

export class TenantSessionRegistry {
  constructor(private readonly provider: SessionOwnershipProvider) {}

  async claim(ctx: TenantContext, sessionId: string): Promise<SessionOwner> {
    const tenantId = this.#tenantId(ctx)
    const owner = await this.provider.claimIfAbsent({ tenantId, sessionId: this.#sessionId(sessionId) })
    return this.#verify(owner, tenantId, sessionId)
  }

  async requireOwner(ctx: TenantContext, sessionId: string): Promise<SessionOwner> {
    const tenantId = this.#tenantId(ctx)
    const owner = await this.provider.get(this.#sessionId(sessionId))
    if (!owner) throw new SessionOwnershipError(`session "${sessionId}" has no ownership record`)
    return this.#verify(owner, tenantId, sessionId)
  }

  async migrateLegacy(ctx: TenantContext, sessionId: string): Promise<SessionOwner> {
    const tenantId = this.#tenantId(ctx)
    const owner = await this.provider.migrateLegacy({ tenantId, sessionId: this.#sessionId(sessionId) })
    return this.#verify(owner, tenantId, sessionId)
  }

  #tenantId(ctx: TenantContext): TenantId {
    if (!ctx?.tenant?.id) throw new TenantContextRequiredError('a tenant context is required for session access')
    return ctx.tenant.id
  }
  #sessionId(value: string): string {
    const id = value.trim()
    if (!id) throw new SessionOwnershipError('session id must not be empty')
    return id
  }
  #verify(record: SessionOwnershipRecord, tenantId: TenantId, sessionId: string): SessionOwner {
    if (record === 'legacy') throw new LegacySessionOwnershipError(`session "${sessionId}" has no tenant owner metadata`)
    if (record.tenantId !== tenantId) {
      throw new SessionOwnershipError(`session "${sessionId}" belongs to another tenant`)
    }
    return record
  }
}
