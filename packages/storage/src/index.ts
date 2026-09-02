import type { TenantContext } from '@dsh-tenancy/core'

export interface TenantNamespace {
  namespace(ctx: TenantContext, domain: string, parts?: readonly string[]): readonly string[]
}

function segment(value: string, label: string): string {
  const normalized = value.normalize('NFKC').trim()
  if (!normalized || normalized === '.' || normalized === '..' || /[\u0000-\u001f\u007f/\\]/u.test(normalized)) {
    throw new TypeError(`${label} contains an unsafe namespace segment`)
  }
  return normalized
}

export class DefaultTenantNamespace implements TenantNamespace {
  namespace(ctx: TenantContext, domain: string, parts: readonly string[] = []): readonly string[] {
    if (!ctx?.tenant?.id) throw new TypeError('a tenant context is required')
    return Object.freeze(['tenant', segment(ctx.tenant.id, 'tenant id'), segment(domain, 'domain'), ...parts.map((part) => segment(part, 'part'))])
  }
}

export class MemoryTenantStorage<Value = unknown> {
  #values = new Map<string, Value>()
  constructor(private readonly namespaces: TenantNamespace = new DefaultTenantNamespace()) {}
  set(ctx: TenantContext, domain: string, parts: readonly string[], value: Value): void {
    this.#values.set(this.#key(ctx, domain, parts), value)
  }
  get(ctx: TenantContext, domain: string, parts: readonly string[]): Value | undefined {
    return this.#values.get(this.#key(ctx, domain, parts))
  }
  delete(ctx: TenantContext, domain: string, parts: readonly string[]): boolean {
    return this.#values.delete(this.#key(ctx, domain, parts))
  }
  list(ctx: TenantContext, domain: string): readonly Value[] {
    const prefix = `${JSON.stringify(this.namespaces.namespace(ctx, domain))}:`
    return [...this.#values].filter(([key]) => key.startsWith(prefix)).map(([, value]) => value)
  }
  #key(ctx: TenantContext, domain: string, parts: readonly string[]): string {
    const root = JSON.stringify(this.namespaces.namespace(ctx, domain))
    return `${root}:${JSON.stringify(parts.map((part) => segment(part, 'part')))}`
  }
}
