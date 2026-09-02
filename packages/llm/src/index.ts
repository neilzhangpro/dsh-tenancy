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
}

export class TenantLlmRouter<Client> {
  #clients = new Map<string, Client>()
  constructor(
    private readonly profiles: TenantLlmResolver,
    private readonly credentials: TenantCredentialResolver,
  ) {}

  async call<Result>(ctx: TenantContext, call: TenantLlmCall<Client, Result>): Promise<Result> {
    const profile = await this.profiles.resolve(ctx.tenant)
    const secret = await this.credentials.resolve(profile.credentialRef, ctx.tenant)
    const key = [ctx.tenant.id, profile.provider, profile.model, profile.version, profile.credentialRef].join('\u0000')
    let client = this.#clients.get(key)
    if (!client) {
      client = call.createClient(profile, secret)
      this.#clients.set(key, client)
    }
    return call.execute(client, profile)
  }

  evictTenant(tenantId: TenantId): void {
    for (const key of this.#clients.keys()) if (key.startsWith(`${tenantId}\u0000`)) this.#clients.delete(key)
  }
}
