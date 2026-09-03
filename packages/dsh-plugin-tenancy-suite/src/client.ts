import { createElement, type ReactElement } from 'react'

export const inject = ['slots', 'layout', 'locale', 'remote', 'remote.tenant', 'sessions']

export interface TenantSummary { readonly id: string; readonly name: string; readonly color?: string }
export interface TenantAgentUiService {
  listTenants(): readonly TenantSummary[]
  activeTenant(): string | undefined
  create(tenantId: string): Promise<{ sessionId: string }>
  open(sessionId: string): void
}
interface ClientContext {
  readonly slots: { inject(name: string, callback: () => unknown): void; register(spec: Record<string, unknown>, component: unknown): unknown }
  readonly layout: { toggleSidebar(): void }
  readonly get?: (name: string) => unknown
  readonly remote?: { tenant?: { create(request: { tenantId: string }): Promise<{ sessionId: string }> } }
  readonly sessions?: { open(sessionId: string): void }
  effect<T>(effect: () => T, name?: string): T
}
interface ActionProps { readonly wide?: boolean; readonly ui?: TenantAgentUiService }

function TenantNewAgentAction({ wide = true, ui }: ActionProps): ReactElement {
  const tenants = ui?.listTenants() ?? []
  const selected = ui?.activeTenant() ?? tenants[0]?.id ?? ''
  return createElement('div', { style: { position: 'relative' } },
    createElement('details', null,
      createElement('summary', { style: { listStyle: 'none' } }, createElement('span', { role: 'button', style: { border: '1px solid #36535a', background: '#102329', color: '#b9fff2', display: 'inline-block', padding: '8px 10px', cursor: ui ? 'pointer' : 'not-allowed', fontWeight: 700 } }, wide ? (ui ? '＋ New tenant agent' : 'Tenant service unavailable') : '＋')),
      ui && createElement('div', { style: { position: 'absolute', zIndex: 10, bottom: 'calc(100% + 8px)', right: 0, width: 230, padding: 14, display: 'grid', gap: 10, background: '#0d171c', border: '1px solid #36535a', boxShadow: '0 14px 35px #0008' }, role: 'dialog', 'aria-label': 'Choose tenant' },
        createElement('strong', null, 'Choose tenant'),
        createElement('select', { defaultValue: selected, style: { background: '#17252b', color: '#e8edf2', border: '1px solid #36535a', padding: 8 } }, tenants.map((tenant) => createElement('option', { key: tenant.id, value: tenant.id }, tenant.name))),
        createElement('button', { type: 'button', disabled: !selected, onClick: async (event: { currentTarget: { parentElement: HTMLElement | null } }) => { const id = (event.currentTarget.parentElement?.querySelector('select') as HTMLSelectElement | null)?.value ?? selected; ui.open((await ui.create(id)).sessionId) }, style: { background: '#f5b84b', color: '#17120a', border: 0, padding: 9, cursor: 'pointer', fontWeight: 700 } }, 'Create isolated agent')
      )
    )
  )
}

export function apply(ctx: ClientContext): void {
  const tenantRemote = ctx.remote?.tenant
  const ui: TenantAgentUiService | undefined = tenantRemote && ctx.sessions ? {
    listTenants: () => [{ id: 'acme', name: 'Acme', color: '#f5b84b' }, { id: 'globex', name: 'Globex', color: '#8de1d0' }],
    activeTenant: () => 'acme',
    create: (tenantId) => tenantRemote.create({ tenantId }),
    open: (sessionId) => ctx.sessions!.open(sessionId),
  } : undefined
  ctx.slots.inject('sidebar.footer.action', () => {
    return ctx.slots.register(
      { name: 'sidebar.footer.action', id: 'dsh-tenancy-suite', order: 100 },
      ({ wide }: { wide?: boolean }) => createElement(TenantNewAgentAction, { wide, ui: ui ?? ctx.get?.('tenantAgentUi') as TenantAgentUiService | undefined }),
    )
  })
}
