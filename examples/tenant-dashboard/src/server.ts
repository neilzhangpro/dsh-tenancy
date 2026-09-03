import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { TenantId, type Tenant, type TenantId as TenantIdType } from '@dsh-tenancy/core'
import { createTenantHttpMiddleware, tenantIdFromVerifiedClaims, verifyJwtClaims } from '@dsh-tenancy/integrations'
import { createServices } from 'dsh-plugin-tenancy'

const JWT_SECRET = process.env.DSH_DEMO_JWT_SECRET ?? 'local-demo-only-change-me'
const services = createServices()
const mounted = new Map<TenantIdType, { tenant: Tenant; dispose: () => Promise<void> }>()
const tenantMeta = {
  acme: { name: 'Acme Studio', color: '#f5b84b', tool: 'acme-crm' },
  globex: { name: 'Globex Labs', color: '#64d8cb', tool: 'globex-erp' },
} as const
type TenantName = keyof typeof tenantMeta

function issueToken(tenantId: TenantIdType): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({ tenant_id: tenantId, sub: 'demo-user', exp: Math.floor(Date.now() / 1000) + 3600 })
  const input = `${header}.${payload}`
  return `${input}.${createHmac('sha256', JWT_SECRET).update(input).digest('base64url')}`
}

async function verifyLocalToken(token: string): Promise<Readonly<Record<string, unknown>>> {
  const [rawHeader, rawPayload, rawSignature] = token.split('.')
  if (!rawHeader || !rawPayload || !rawSignature) throw new Error('malformed JWT')
  const header = JSON.parse(Buffer.from(rawHeader, 'base64url').toString('utf8')) as { alg?: string; typ?: string }
  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('unsupported JWT header')
  const expected = createHmac('sha256', JWT_SECRET).update(`${rawHeader}.${rawPayload}`).digest()
  const actual = Buffer.from(rawSignature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('invalid JWT signature')
  const claims = JSON.parse(Buffer.from(rawPayload, 'base64url').toString('utf8')) as Record<string, unknown>
  if (typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000) throw new Error('expired JWT')
  return claims
}

const tenantMiddleware = createTenantHttpMiddleware(services.tenants, async (request: IncomingMessage) => {
  const token = (request.headers.authorization ?? '').replace(/^Bearer\s+/u, '')
  return tenantIdFromVerifiedClaims(await verifyJwtClaims(token, verifyLocalToken))
})

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ''
  for await (const chunk of request) raw += chunk
  return raw ? JSON.parse(raw) as Record<string, unknown> : {}
}

async function mountTenant(value: TenantIdType | string): Promise<Tenant> {
  const id = TenantId(value); const existing = mounted.get(id)
  if (existing) return existing.tenant
  const tenant = services.tenants.resolve(id); const meta = tenantMeta[id as TenantName]
  const fiber = await services.tenants.mount(tenant, {
    name: `dashboard-${id}`, tenancy: { awareness: 'tenant', protocol: 1 },
    apply(ctx) { ctx.scope.register('dashboard-tool', meta?.tool ?? `tool-${id}`); return () => undefined },
  }, undefined)
  mounted.set(id, { tenant, dispose: () => fiber.dispose() }); return tenant
}

async function unmountTenant(value: string): Promise<void> {
  const id = TenantId(value); if (!mounted.has(id)) return
  await services.tenants.dispose(id); mounted.delete(id)
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(value))
}

function state(tenant: Tenant) {
  const meta = tenantMeta[tenant.id as TenantName]; const tool = tenant.ctx.scope.get<string>('dashboard-tool')
  return { tenant: { id: tenant.id, name: meta?.name ?? tenant.id, color: meta?.color ?? '#f5b84b' }, scope: { key: tenant.key, mounted: mounted.has(tenant.id) }, tools: ['global-search', ...(tool ? [tool] : [])] }
}

export function createDashboardServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (request.method === 'GET' && url.pathname === '/') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(PAGE); return }
      if (request.method === 'POST' && url.pathname === '/auth/token') {
        const input = await readBody(request); const id = TenantId(String(input.tenant_id ?? ''))
        if (!(id in tenantMeta)) return sendJson(response, 400, { error: 'unknown demo tenant' })
        await mountTenant(id); return sendJson(response, 200, { token: issueToken(id), tenant_id: id, expires_in: 3600 })
      }
      if (request.method === 'POST' && url.pathname === '/api/tenant/mount') { const input = await readBody(request); return sendJson(response, 200, state(await mountTenant(String(input.tenant_id ?? '')))) }
      if (request.method === 'POST' && url.pathname === '/api/tenant/unmount') { const input = await readBody(request); await unmountTenant(String(input.tenant_id ?? '')); return sendJson(response, 200, { mounted: false }) }
      if (request.method === 'GET' && url.pathname === '/api/state') return await tenantMiddleware(request, (_request, tenant) => sendJson(response, 200, state(tenant)))
      if (request.method === 'POST' && url.pathname === '/api/session/claim') return await tenantMiddleware(request, async (req, tenant) => { const input = await readBody(req); const owner = await services.tenantSessions.claim(tenant.ctx, String(input.session_id ?? 'demo-session-1')); return sendJson(response, 200, { session_id: owner.sessionId, tenant_id: owner.tenantId }) })
      sendJson(response, 404, { error: 'not found' })
    } catch (error) { sendJson(response, 401, { error: error instanceof Error ? error.message : 'request failed' }) }
  })
}

export async function startDashboard(port = Number(process.env.PORT ?? 4173)) {
  await mountTenant('acme'); await mountTenant('globex'); const server = createDashboardServer()
  await new Promise<void>((resolve) => server.listen(port, resolve)); return server
}

if (import.meta.url === `file://${process.argv[1]}`) { const server = await startDashboard(); console.log(`Tenant Lab running at http://localhost:${(server.address() as { port: number }).port}`) }

const PAGE = String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tenant Lab</title><style>
:root{color-scheme:dark;--ink:#e8edf2;--muted:#84909d;--panel:#111820;--line:#26323d;--bg:#080d12;--amber:#f5b84b;--teal:#64d8cb;--red:#ff7b72;font-family:Inter,ui-sans-serif,system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 70% 0,#17242a 0,#080d12 48%);color:var(--ink);min-height:100vh}body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.09;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,#000,transparent 70%)}main{max-width:1180px;margin:auto;padding:34px 24px 60px}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:24px}.eyebrow{color:var(--amber);font:700 11px ui-monospace,monospace;letter-spacing:.18em}.brand{font:800 clamp(32px,5vw,62px);letter-spacing:-.065em;line-height:.95;margin:12px 0}.lede{color:var(--muted);max-width:510px;margin:16px 0 0;font-size:15px;line-height:1.6}.badge{border:1px solid #35504d;color:var(--teal);padding:9px 12px;font:700 11px ui-monospace,monospace;letter-spacing:.08em}.grid{display:grid;grid-template-columns:240px 1fr 250px;gap:16px;margin-top:24px}.panel{background:#111820eb;border:1px solid var(--line);padding:18px;box-shadow:0 16px 50px #0003}.panel h2{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 16px}.tenant{width:100%;display:flex;gap:11px;text-align:left;background:transparent;color:var(--ink);border:1px solid transparent;padding:13px 10px;cursor:pointer}.tenant:hover,.tenant.active{border-color:var(--line);background:#1a252d}.dot{width:10px;height:10px;border-radius:50%;margin-top:4px;box-shadow:0 0 14px currentColor}.tenant strong{display:block;font-size:14px}.tenant small{color:var(--muted);display:block;margin-top:4px}.hero{min-height:330px;display:flex;flex-direction:column;justify-content:space-between}.hero h1{font-size:clamp(30px,5vw,54px);letter-spacing:-.06em;margin:8px 0}.hero p{color:var(--muted);line-height:1.6;max-width:520px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:24px}.metric{border-top:1px solid var(--line);padding-top:12px}.metric b{display:block;font:700 17px ui-monospace,monospace}.metric span{display:block;color:var(--muted);font-size:11px;margin-top:5px}.actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid var(--line);background:#18232b;color:var(--ink);padding:11px 13px;cursor:pointer;font-weight:700;font-size:12px}.btn:hover{border-color:var(--teal)}.btn.primary{background:var(--amber);border-color:var(--amber);color:#17120a}.btn.danger{color:var(--red)}pre{white-space:pre-wrap;word-break:break-word;color:#b9c6d0;font:12px/1.6 ui-monospace,monospace;margin:0}.token{max-height:86px;overflow:hidden;color:#778692}.log{margin-top:16px;border-top:1px solid var(--line);padding-top:14px;color:var(--muted);font:11px/1.7 ui-monospace,monospace}.ok{color:var(--teal)}.warn{color:var(--amber)}@media(max-width:900px){.grid{grid-template-columns:1fr 1fr}.hero{grid-column:span 2}}@media(max-width:620px){main{padding:24px 14px}.top{display:block}.badge{display:inline-block;margin-top:20px}.grid{display:block}.panel{margin-top:12px}.hero{min-height:280px}.metrics{grid-template-columns:1fr 1fr}}
</style></head><body><main><header class="top"><div><div class="eyebrow">DSH TENANCY / LOCAL CONTROL ROOM</div><div class="brand">Tenant Lab<span style="color:var(--amber)">.</span></div><p class="lede">One local DSH process. Two tenants. Watch the boundary hold while JWTs, scopes, tools and sessions move through the same runtime.</p></div><div class="badge">● LIVE / LOCAL ONLY</div></header><section class="grid"><aside class="panel"><h2>Tenants</h2><div id="tenants"></div><div class="log" id="log">booting runtime…</div></aside><section class="panel hero"><div><div class="eyebrow" id="scopeLabel">TENANT SCOPE</div><h1 id="title">Select a tenant</h1><p id="summary">The page will request a signed demo token, then use it to enter the selected tenant context.</p></div><div><div class="metrics"><div class="metric"><b id="scope">—</b><span>scope generation</span></div><div class="metric"><b id="mounted">—</b><span>plugin lifecycle</span></div><div class="metric"><b id="session">—</b><span>session owner</span></div></div><div class="actions" style="margin-top:20px"><button class="btn primary" id="mount">Mount tenant plugin</button><button class="btn danger" id="unmount">Unmount tenant</button><button class="btn" id="claim">Claim demo session</button></div></div></section><aside class="panel"><h2>Issued JWT</h2><pre class="token" id="token">No token yet.</pre><h2 style="margin-top:28px">Visible tools</h2><pre id="tools">—</pre><div class="log" id="event">Waiting for a tenant.</div></aside></section></main><script>
const ids=['acme','globex'];let selected='acme',token='',session='unclaimed';const $=id=>document.getElementById(id);const meta={acme:{name:'Acme Studio',color:'#f5b84b',tool:'acme-crm'},globex:{name:'Globex Labs',color:'#64d8cb',tool:'globex-erp'}};function log(message,kind=''){ $('log').innerHTML='<span class="'+kind+'">'+message+'</span>' }async function request(path,options={}){const headers={'content-type':'application/json',...(options.headers||{})};if(token)headers.authorization='Bearer '+token;const r=await fetch(path,{...options,headers});const data=await r.json();if(!r.ok)throw Error(data.error||'request failed');return data}async function select(id){selected=id;const issued=await request('/auth/token',{method:'POST',body:JSON.stringify({tenant_id:id})});token=issued.token;$('token').textContent=token;const data=await request('/api/state');render(data);log('JWT verified · '+id,'ok');$('event').textContent='JWT → verifier → TenantRuntime.run()'}function render(data){const m=meta[selected];ids.forEach(id=>document.querySelector('[data-id="'+id+'"]')?.classList.toggle('active',id===selected));$('title').textContent=m.name;$('title').style.color=m.color;$('scopeLabel').textContent='TENANT SCOPE / '+data.tenant.id.toUpperCase();$('scope').textContent=data.scope.key;$('mounted').textContent=data.scope.mounted?'MOUNTED':'UNMOUNTED';$('mounted').className=data.scope.mounted?'ok':'warn';$('session').textContent=session;$('tools').textContent=data.tools.join('\n');$('summary').textContent=data.scope.mounted?'This request entered the tenant scope. The tool list is resolved from its private registration plus the global baseline.':'The tenant scope exists, but its tenant plugin is currently unloaded.'}async function action(fn){try{await fn()}catch(e){log(e.message,'warn');$('event').textContent='Request rejected: '+e.message}}ids.forEach(id=>{const b=document.createElement('button');b.className='tenant';b.dataset.id=id;b.innerHTML='<i class="dot" style="color:'+meta[id].color+';background:'+meta[id].color+'"></i><span><strong>'+meta[id].name+'</strong><small>'+id+' · isolated scope</small></span>';b.onclick=()=>action(()=>select(id));$('tenants').append(b)});$('mount').onclick=()=>action(async()=>{const d=await request('/api/tenant/mount',{method:'POST',body:JSON.stringify({tenant_id:selected})});render(d);log('plugin mounted · cleanup registered','ok')});$('unmount').onclick=()=>action(async()=>{await request('/api/tenant/unmount',{method:'POST',body:JSON.stringify({tenant_id:selected})});session='unclaimed';const d=await request('/api/state');render(d);log('tenant disposed · old generation invalid','ok')});$('claim').onclick=()=>action(async()=>{const d=await request('/api/session/claim',{method:'POST',body:JSON.stringify({session_id:'demo-session-1'})});session=d.tenant_id;$('session').textContent=session;$('event').textContent='session demo-session-1 owned by '+d.tenant_id});action(()=>select(selected));
</script></body></html>`
