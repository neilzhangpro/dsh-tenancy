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
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'dsh-tenant-new-agent', inject: () => ({ ui: ctx.tenantAgentUi })
  }, TenantNewAgentAction))
}
