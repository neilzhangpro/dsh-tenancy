import { createElement, useState, useSyncExternalStore, type ReactElement } from 'react'
import tenancyRemoteContribution from 'dsh-plugin-tenancy/remote'

export const inject = ['slots', 'layout', 'locale', 'remote', 'sessions']

export interface TenantSummary { readonly id: string; readonly name: string; readonly color?: string }
export interface TenantAgentUiService {
  listTenants(): readonly TenantSummary[]
  activeTenant(): string | undefined
  switchTenant(tenantId: string): void
  create(tenantId: string): Promise<{ sessionId: string }>
  open(sessionId: string): void
}
interface ClientContext {
  readonly slots: { inject(name: string, callback: () => unknown): void; register(spec: Record<string, unknown>, component: unknown): unknown }
  readonly layout: { toggleSidebar(): void }
  readonly get?: (name: string) => unknown
  readonly remote?: { $mount(contribution: unknown): Promise<() => Promise<void>> }
  readonly sessions?: { refresh(): Promise<void>; open(sessionId: string): void; clear(): void }
  effect<T>(effect: () => T, name?: string): T
}
interface ActionProps { readonly wide?: boolean; readonly ui?: TenantAgentUiService }

let currentTenant = 'acme'
const tenantListeners = new Set<() => void>()
const tenantStore = {
  getSnapshot: () => currentTenant,
  subscribe: (listener: () => void) => { tenantListeners.add(listener); return () => tenantListeners.delete(listener) },
}
function selectTenant(id: string): void {
  if (id === currentTenant) return
  currentTenant = id
  for (const listener of tenantListeners) listener()
}

function TenantSwitcher({ ui }: { ui: TenantAgentUiService }): ReactElement {
  const tenant = useSyncExternalStore(tenantStore.subscribe, tenantStore.getSnapshot, tenantStore.getSnapshot)
  return createElement('select', {
    'aria-label': 'Switch tenant',
    value: tenant,
    onChange: (event: { currentTarget: HTMLSelectElement }) => { ui.switchTenant(event.currentTarget.value) },
    style: { width: '100%', boxSizing: 'border-box', background: '#17252b', color: '#e8edf2', border: '1px solid #36535a', borderRadius: 8, padding: 8, fontSize: 13 },
  }, ui.listTenants().map(item => createElement('option', { key: item.id, value: item.id }, item.name)))
}

function TenantSessionBrowser({ wide, useSessions, open }: {
  wide: boolean
  useSessions: (selector: (state: { ids: readonly string[]; byId: Record<string, { title?: string; name?: string; cwd?: string }> }) => unknown) => unknown
  open(sessionId: string): void
}): ReactElement {
  const tenant = useSyncExternalStore(tenantStore.subscribe, tenantStore.getSnapshot, tenantStore.getSnapshot)
  const list = useSessions(state => state) as { ids: readonly string[]; byId: Record<string, { title?: string; name?: string; cwd?: string }> }
  const tenantIds = list.ids.filter(id => id.startsWith(`tenant-${tenant}-`))
  const ids = tenantIds.filter(id => list.byId[id]?.cwd !== undefined)
  return createElement('section', { style: { display: 'grid', gap: 8, padding: wide ? '14px 12px' : 8, overflow: 'auto' } },
    createElement('div', { style: { color: '#91a5ab', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' } }, `${tenant} sessions`),
    ids.length === 0
      ? createElement('div', { style: { color: '#91a5ab', fontSize: 13, padding: '12px 0' } }, tenantIds.length > 0 ? 'Older sessions need a workspace. Create a new agent.' : 'No sessions for this tenant yet.')
      : ids.map(id => createElement('button', {
        key: id,
        type: 'button',
        onClick: () => open(id),
        style: { textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: 0, borderRadius: 8, padding: '9px 10px', background: list.byId[id]?.title ? '#17252b' : 'transparent', color: '#e8edf2', cursor: 'pointer' },
      }, list.byId[id]?.title ?? list.byId[id]?.name ?? id)),
  )
}

function TenantNewAgentAction({ wide = true, ui }: ActionProps): ReactElement {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const activeTenant = useSyncExternalStore(tenantStore.subscribe, tenantStore.getSnapshot, tenantStore.getSnapshot)
  const tenants = ui?.listTenants() ?? []
  const selected = ui?.activeTenant() ?? activeTenant ?? tenants[0]?.id ?? ''
  return createElement('div', { style: { position: 'relative' } },
    ui && createElement(TenantSwitcher, { ui }),
    createElement('details', null,
      createElement('summary', { style: { listStyle: 'none' } }, createElement('span', { role: 'button', style: { border: '1px solid #36535a', background: '#102329', color: '#b9fff2', display: 'inline-block', padding: '8px 10px', cursor: ui ? 'pointer' : 'not-allowed', fontWeight: 700 } }, wide ? (ui ? '＋ New tenant agent' : 'Tenant service unavailable') : '＋')),
      ui && createElement('div', { style: { position: 'fixed', zIndex: 1000, inset: 0, display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box', background: '#0009' }, role: 'presentation' },
        createElement('div', { style: { width: 'min(360px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', overflow: 'auto', boxSizing: 'border-box', padding: 20, display: 'grid', gap: 14, background: '#0d171c', color: '#e8edf2', border: '1px solid #36535a', borderRadius: 14, boxShadow: '0 24px 70px #000b' }, role: 'dialog', 'aria-label': 'Choose tenant' },
          createElement('div', { style: { display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 } },
            createElement('div', null,
              createElement('strong', { style: { display: 'block', fontSize: 16 } }, 'New tenant agent'),
              createElement('span', { style: { display: 'block', marginTop: 5, color: '#91a5ab', fontSize: 12 } }, 'Choose where this conversation belongs.'),
            ),
            createElement('button', { type: 'button', 'aria-label': 'Close', onClick: (event: { currentTarget: HTMLElement }) => { event.currentTarget.closest('details')?.removeAttribute('open') }, style: { border: 0, background: 'transparent', color: '#91a5ab', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 0 } }, '×'),
          ),
          createElement('label', { style: { display: 'grid', gap: 7, color: '#b9fff2', fontSize: 12, fontWeight: 700 } }, 'Tenant',
            createElement('select', { value: selected, onChange: (event: { currentTarget: HTMLSelectElement }) => { ui.switchTenant(event.currentTarget.value) }, style: { width: '100%', boxSizing: 'border-box', background: '#17252b', color: '#e8edf2', border: '1px solid #36535a', borderRadius: 8, padding: 10, fontSize: 14 } }, tenants.map((tenant) => createElement('option', { key: tenant.id, value: tenant.id }, tenant.name))),
          ),
          error && createElement('div', { role: 'alert', style: { color: '#ffb4ab', fontSize: 12 } }, error),
          createElement('button', { type: 'button', disabled: !selected || busy, onClick: async (event: { currentTarget: HTMLElement }) => {
            if (busy) return
            const id = (event.currentTarget.parentElement?.querySelector('select') as HTMLSelectElement | null)?.value ?? selected
            const details = event.currentTarget.closest('details')
            setBusy(true)
            setError(undefined)
            try {
              const result = await ui.create(id)
              details?.removeAttribute('open')
              ui.open(result.sessionId)
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : String(cause))
            } finally {
              setBusy(false)
            }
          }, style: { background: '#f5b84b', color: '#17120a', border: 0, borderRadius: 8, padding: 11, cursor: busy ? 'wait' : 'pointer', fontWeight: 700, fontSize: 14 } }, busy ? 'Creating…' : 'Create isolated agent')
        )
      )
    )
  )
}

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const officialNewSessionStyle = typeof document === 'undefined' ? undefined : document.createElement('style')
  if (officialNewSessionStyle) {
    officialNewSessionStyle.textContent = 'button[aria-label="New session"],button[aria-label="新建会话"]{display:none!important}'
    document.head.append(officialNewSessionStyle)
  }
  const disposeRemote = await ctx.remote?.$mount(tenancyRemoteContribution)
  const tenantRemote = ctx.get?.('remote.tenant') as { create(request: { tenantId: string }): Promise<{ ok: true; value: { sessionId: string } } | { ok: false; error: { message: string } }> } | undefined
  const ui: TenantAgentUiService | undefined = tenantRemote && ctx.sessions ? {
    listTenants: () => [{ id: 'acme', name: 'Acme', color: '#f5b84b' }, { id: 'globex', name: 'Globex', color: '#8de1d0' }],
    activeTenant: () => currentTenant,
    switchTenant: (tenantId) => { selectTenant(tenantId); ctx.sessions!.clear() },
    create: async (tenantId) => {
      const result = await tenantRemote.create({ tenantId })
      if (!result.ok) throw new Error(result.error.message)
      await ctx.sessions!.refresh()
      return result.value
    },
    open: (sessionId) => ctx.sessions!.open(sessionId),
  } : undefined
  ctx.slots.inject('sidebar.footer.action', () => {
    return ctx.slots.register(
      { name: 'sidebar.footer.action', id: 'dsh-tenancy-suite', order: 100 },
      ({ wide }: { wide?: boolean }) => createElement(TenantNewAgentAction, { wide, ui: ui ?? ctx.get?.('tenantAgentUi') as TenantAgentUiService | undefined }),
    )
  })
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register(
    { name: 'sidebar.workspaces', id: 'dsh-tenancy-sessions', priority: -100, inject: () => ({ open: (sessionId: string) => ctx.sessions!.open(sessionId) }) },
    TenantSessionBrowser,
  ))
  return async () => {
    officialNewSessionStyle?.remove()
    if (disposeRemote) await disposeRemote()
  }
}
