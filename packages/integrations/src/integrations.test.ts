import assert from 'node:assert/strict'
import test from 'node:test'
import { TenantRuntime, TenantSessionRegistry, createMemoryScopeAdapter } from '@dsh-tenancy/core'
import {
  PostgresSessionOwnershipProvider, TenantMcpRouteNotFoundError, TenantMcpRouter,
  createTenantHttpMiddleware, tenantIdFromVerifiedClaims, verifyJwtClaims,
  type SqlClient,
} from './index.js'

test('HTTP middleware establishes async tenant context from authenticated identity', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const middleware = createTenantHttpMiddleware<{ authenticatedTenantId: string }, string>(runtime, (req) => req.authenticatedTenantId)
  const result = await middleware({ authenticatedTenantId: 'acme' }, async (_request, tenant) => {
    await Promise.resolve()
    return `${tenant.id}:${runtime.require().id}`
  })
  assert.equal(result, 'acme:acme')
})

test('JWT claim mapping requires verifier output and rejects missing claim', async () => {
  const verified = await verifyJwtClaims('signed-token', async () => ({ tenant_id: 'acme', sub: 'user-1' }))
  assert.equal(tenantIdFromVerifiedClaims(verified), 'acme')
  await assert.rejects(verifyJwtClaims('', async () => ({})), /must not be empty/)
  assert.throws(() => tenantIdFromVerifiedClaims(verified, 'organization_id'), /must be a string/)
})

test('MCP routes are tenant partitioned and have no global fallback', () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter()); const router = new TenantMcpRouter(runtime)
  const acme = runtime.resolve('acme'); const globex = runtime.resolve('globex')
  router.register(acme.ctx, { name: 'github', endpoint: 'https://mcp.acme.invalid' })
  router.register(globex.ctx, { name: 'github', endpoint: 'https://mcp.globex.invalid' })
  assert.equal(router.resolve(acme.ctx, 'github').endpoint, 'https://mcp.acme.invalid')
  assert.equal(router.resolve(globex.ctx, 'github').endpoint, 'https://mcp.globex.invalid')
  assert.throws(() => router.resolve(acme.ctx, 'unconfigured'), TenantMcpRouteNotFoundError)
})

test('MCP routes do not leak into a replacement tenant generation', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter()); const router = new TenantMcpRouter(runtime)
  const old = runtime.resolve('acme')
  router.register(old.ctx, { name: 'github', endpoint: 'https://old.invalid' })
  await runtime.dispose(old.id)
  const replacement = runtime.resolve('acme')
  assert.throws(() => router.resolve(replacement.ctx, 'github'), TenantMcpRouteNotFoundError)
})

class FakePostgres implements SqlClient {
  records = new Map<string, string | null>()
  async query<Row extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
    const sessionId = values[0] as string | undefined; const tenantId = values[1] as string | undefined
    if (sql.startsWith('INSERT')) {
      if (sessionId && !this.records.has(sessionId)) { this.records.set(sessionId, tenantId!); return { rows: [{ session_id: sessionId, tenant_id: tenantId }] as unknown as Row[] } }
      return { rows: [] as Row[] }
    }
    if (sql.startsWith('SELECT')) {
      if (!sessionId || !this.records.has(sessionId)) return { rows: [] as Row[] }
      return { rows: [{ session_id: sessionId, tenant_id: this.records.get(sessionId) }] as unknown as Row[] }
    }
    if (sql.startsWith('UPDATE')) {
      if (sessionId && this.records.get(sessionId) === null) { this.records.set(sessionId, tenantId!); return { rows: [{ session_id: sessionId, tenant_id: tenantId }] as unknown as Row[] } }
      return { rows: [] as Row[] }
    }
    return { rows: [] as Row[] }
  }
}

test('PostgreSQL provider enforces atomic immutable ownership and legacy migration', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter()); const db = new FakePostgres()
  const sessions = new TenantSessionRegistry(new PostgresSessionOwnershipProvider(db))
  const acme = runtime.resolve('acme'); const globex = runtime.resolve('globex')
  const claims = await Promise.allSettled([sessions.claim(acme.ctx, 's1'), sessions.claim(globex.ctx, 's1')])
  assert.equal(claims.filter((result) => result.status === 'fulfilled').length, 1)
  db.records.set('legacy', null)
  await assert.rejects(sessions.claim(acme.ctx, 'legacy'), /no tenant owner metadata/)
  assert.equal((await sessions.migrateLegacy(acme.ctx, 'legacy')).tenantId, acme.id)
  await assert.rejects(sessions.migrateLegacy(globex.ctx, 'legacy'), /belongs to another tenant/)
})

test('PostgreSQL table names are constrained identifiers', () => {
  assert.throws(() => new PostgresSessionOwnershipProvider(new FakePostgres(), 'owners; DROP TABLE users'), /unsafe SQL identifier/)
})
