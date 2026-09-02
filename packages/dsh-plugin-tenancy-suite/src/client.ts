import { createElement, useEffect, useState, type ReactElement } from 'react'

export const inject = ['slots', 'tenantAgentUi']

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
  readonly tenantAgentUi: TenantAgentUiService
}
interface ActionProps { readonly wide?: boolean; readonly ui: TenantAgentUiService }

function TenantNewAgentAction({ wide = true, ui }: ActionProps): ReactElement {
  const tenants = ui.listTenants()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [selected, setSelected] = useState(ui.activeTenant() ?? tenants[0]?.id ?? '')
  useEffect(() => { if (!selected && tenants[0]) setSelected(tenants[0].id) }, [selected, tenants])
  async function create(): Promise<void> {
    if (!selected) return
    setBusy(true); setError(undefined)
    try { ui.open((await ui.create(selected)).sessionId); setOpen(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'agent creation failed') }
    finally { setBusy(false) }
  }
  return createElement('div', { style: { position: 'relative' } },
    createElement('button', { type: 'button', 'aria-expanded': open, onClick: () => setOpen(!open), style: { border: '1px solid #36535a', background: '#102329', color: '#b9fff2', padding: '8px 10px', cursor: 'pointer', fontWeight: 700 } }, wide ? '＋ New tenant agent' : '＋'),
    open && createElement('div', { style: { position: 'absolute', zIndex: 10, bottom: 'calc(100% + 8px)', right: 0, width: 230, padding: 14, display: 'grid', gap: 10, background: '#0d171c', border: '1px solid #36535a', boxShadow: '0 14px 35px #0008' }, role: 'dialog', 'aria-label': 'Choose tenant' },
      createElement('strong', null, 'Choose tenant'),
      createElement('select', { value: selected, onChange: (event: { target: { value: string } }) => setSelected(event.target.value), style: { background: '#17252b', color: '#e8edf2', border: '1px solid #36535a', padding: 8 } }, tenants.map((tenant) => createElement('option', { key: tenant.id, value: tenant.id }, tenant.name))),
      createElement('button', { type: 'button', disabled: busy || !selected, onClick: create, style: { background: '#f5b84b', color: '#17120a', border: 0, padding: 9, cursor: 'pointer', fontWeight: 700 } }, busy ? 'Creating…' : 'Create isolated agent'),
      error && createElement('small', { role: 'alert' }, error)
    )
  )
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('root', () => ctx.slots.register({
    name: 'sidebar',
    children: {
      'sidebar.brand.mark': { kind: 'single', scope: 'root' },
      'sidebar.brand.name': { kind: 'single', scope: 'root' },
      'sidebar.workspaces': { kind: 'single', scope: 'root' },
      'sidebar.settings': { kind: 'single', scope: 'root' },
      'sidebar.footer.action': { kind: 'list', scope: 'root' },
    },
    inject: () => ({ toggleSidebar: () => ctx.layout.toggleSidebar(), ui: ctx.tenantAgentUi }),
  }, TenantSidebar))
}

function TenantSidebar({ collapsed = false, width = 280, renderSlot = () => null, toggleSidebar = () => undefined, ui }: {
  readonly collapsed?: boolean; readonly width?: number
  readonly renderSlot?: (name: string, owner?: unknown) => unknown
  readonly toggleSidebar?: () => void; readonly ui: TenantAgentUiService
}): ReactElement {
  const wide = !collapsed
  const create = () => {
    const tenant = ui.activeTenant() ?? ui.listTenants()[0]?.id
    if (tenant) void ui.create(tenant).then(({ sessionId }) => ui.open(sessionId))
  }
  return createElement('aside', { style: { width: wide ? width : 56, height: '100%', display: 'flex', flexDirection: 'column', background: '#0b1217', color: '#e8edf2', borderRight: '1px solid #26323d', overflow: 'hidden', transition: 'width 150ms ease' } },
    createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottom: '1px solid #26323d' } },
      wide && createElement('button', { type: 'button', onClick: create, style: { border: 0, background: 'transparent', color: '#f5b84b', fontWeight: 800, fontSize: 16, cursor: 'pointer' } }, 'Tenant Lab'),
      createElement('button', { type: 'button', onClick: toggleSidebar, 'aria-label': wide ? 'Collapse sidebar' : 'Open sidebar', style: { border: 0, background: 'transparent', color: '#84909d', fontSize: 18, cursor: 'pointer' } }, wide ? '‹' : '›')
    ),
    createElement('div', { style: { padding: wide ? '12px 14px' : '12px 8px', borderBottom: '1px solid #26323d' } }, createElement(TenantNewAgentAction, { wide, ui })),
    createElement('div', { style: { minHeight: 0, flex: 1, overflow: 'auto' } }, renderSlot('sidebar.workspaces', { wide, expandSidebar: () => { if (collapsed) toggleSidebar() } })),
    createElement('div', { style: { borderTop: '1px solid #26323d', padding: wide ? 10 : 6 } }, renderSlot('sidebar.footer.action', { wide }), renderSlot('sidebar.settings', { wide }))
  )
}
