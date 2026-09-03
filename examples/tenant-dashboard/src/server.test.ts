import assert from 'node:assert/strict'
import test from 'node:test'
import { startDashboard } from './server.js'

test('dashboard issues tenant JWTs and protects state by tenant context', async () => {
  const server = await startDashboard(0)
  const port = (server.address() as { port: number }).port
  const url = `http://127.0.0.1:${port}`
  try {
    const tokenResponse = await fetch(`${url}/auth/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tenant_id: 'acme' }) })
    assert.equal(tokenResponse.status, 200)
    const { token } = await tokenResponse.json() as { token: string }
    const stateResponse = await fetch(`${url}/api/state`, { headers: { authorization: `Bearer ${token}` } })
    const state = await stateResponse.json() as { tenant: { id: string }; tools: string[] }
    assert.equal(state.tenant.id, 'acme')
    assert.deepEqual(state.tools, ['global-search', 'acme-crm'])
    const denied = await fetch(`${url}/api/state`)
    assert.equal(denied.status, 401)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
