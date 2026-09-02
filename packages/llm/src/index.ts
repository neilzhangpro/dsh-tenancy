import type { Tenant, TenantContext, TenantId } from '@dsh-tenancy/core'

declare const credentialRefBrand: unique symbol
export type CredentialRef = string & { readonly [credentialRefBrand]: true }

export function CredentialRef(value: string): CredentialRef {
  const normalized = value.trim()
  if (!normalized) throw new TypeError('credential reference must not be empty')
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) throw new TypeError('credential reference contains control characters')
  return normalized as CredentialRef
}

export interface TenantLlmProfile {
  readonly provider: string
  readonly model: string
  readonly credentialRef: CredentialRef
  readonly version: string
  readonly baseURL?: string
  readonly maxConcurrency?: number
}

export interface TenantLlmResolver { resolve(tenant: Tenant): Promise<TenantLlmProfile> }
export interface TenantCredentialResolver { resolve(reference: CredentialRef, tenant: Tenant): Promise<string> }

export class TenantLlmProfileNotFoundError extends Error {
  constructor(tenantId: string) { super(`no LLM profile is configured for tenant "${tenantId}"`); this.name = new.target.name }
}
export class TenantCredentialNotFoundError extends Error {
  constructor(reference: string, tenantId: string) {
    super(`credential "${reference}" is unavailable for tenant "${tenantId}"`); this.name = new.target.name
  }
}

export class MemoryTenantLlmResolver implements TenantLlmResolver {
  #profiles = new Map<TenantId, TenantLlmProfile>()
  set(tenantId: TenantId, profile: TenantLlmProfile): void { this.#profiles.set(tenantId, Object.freeze({ ...profile })) }
  async resolve(tenant: Tenant): Promise<TenantLlmProfile> {
    const profile = this.#profiles.get(tenant.id)
    if (!profile) throw new TenantLlmProfileNotFoundError(tenant.id)
    return profile
  }
}

export class MemoryTenantCredentialResolver implements TenantCredentialResolver {
  #secrets = new Map<string, string>()
  set(tenantId: TenantId, reference: CredentialRef, secret: string): void {
    this.#secrets.set(`${tenantId}\u0000${reference}`, secret)
  }
  async resolve(reference: CredentialRef, tenant: Tenant): Promise<string> {
    const secret = this.#secrets.get(`${tenant.id}\u0000${reference}`)
    if (!secret) throw new TenantCredentialNotFoundError(reference, tenant.id)
    return secret
  }
}

export interface TenantLlmCall<Client, Result> {
  readonly createClient: (profile: TenantLlmProfile, secret: string) => Client
  readonly execute: (client: Client, profile: TenantLlmProfile) => Promise<Result>
  readonly disposeClient?: (client: Client) => void | Promise<void>
}

export class TenantLlmRouter<Client> {
  #clients = new Map<string, { client: Client; dispose?: (client: Client) => void | Promise<void> }>()
  constructor(
    private readonly profiles: TenantLlmResolver,
    private readonly credentials: TenantCredentialResolver,
  ) {}

  async call<Result>(ctx: TenantContext, call: TenantLlmCall<Client, Result>): Promise<Result> {
    const profile = await this.profiles.resolve(ctx.tenant)
    const secret = await this.credentials.resolve(profile.credentialRef, ctx.tenant)
    const key = [ctx.tenant.id, profile.provider, profile.model, profile.version, profile.credentialRef].join('\u0000')
    let entry = this.#clients.get(key)
    if (!entry) {
      entry = { client: call.createClient(profile, secret) }
      if (call.disposeClient) entry.dispose = call.disposeClient
      this.#clients.set(key, entry)
    }
    return call.execute(entry!.client, profile)
  }

  async evictTenant(tenantId: TenantId): Promise<void> {
    const evicted = [...this.#clients].filter(([key]) => key.startsWith(`${tenantId}\u0000`))
    evicted.forEach(([key]) => this.#clients.delete(key))
    const results = await Promise.allSettled(
      evicted.map(([, entry]) => entry.dispose?.(entry.client)),
    )
    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason)
    if (failures.length) throw new AggregateError(failures, `tenant ${tenantId} client cleanup failed`)
  }
}
