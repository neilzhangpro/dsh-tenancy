import { createElement, type ReactElement } from 'react'
import tenancyRemoteContribution from 'dsh-plugin-tenancy/remote'

export const inject = ['slots', 'layout', 'locale', 'remote', 'sessions']

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
  readonly remote?: { $mount(contribution: unknown): Promise<() => Promise<void>>; tenant?: { create(request: { tenantId: string }): Promise<{ sessionId: string }> } }
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
            createElement('select', { defaultValue: selected, style: { width: '100%', boxSizing: 'border-box', background: '#17252b', color: '#e8edf2', border: '1px solid #36535a', borderRadius: 8, padding: 10, fontSize: 14 } }, tenants.map((tenant) => createElement('option', { key: tenant.id, value: tenant.id }, tenant.name))),
          ),
          createElement('button', { type: 'button', disabled: !selected, onClick: async (event: { currentTarget: { parentElement: HTMLElement | null } }) => { const id = (event.currentTarget.parentElement?.querySelector('select') as HTMLSelectElement | null)?.value ?? selected; ui.open((await ui.create(id)).sessionId) }, style: { background: '#f5b84b', color: '#17120a', border: 0, borderRadius: 8, padding: 11, cursor: 'pointer', fontWeight: 700, fontSize: 14 } }, 'Create isolated agent')
        )
      )
    )
  )
}

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote?.$mount(tenancyRemoteContribution)
  const tenantRemote = ctx.get?.('remote.tenant') as { create(request: { tenantId: string }): Promise<{ sessionId: string }> } | undefined
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
  return async () => { if (disposeRemote) await disposeRemote() }
}
