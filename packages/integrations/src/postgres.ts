import {
  TenantId, type SessionOwner, type SessionOwnershipProvider,
  type SessionOwnershipRecord,
} from '@dsh-tenancy/core'

export interface SqlQueryResult<Row> { readonly rows: readonly Row[] }
export interface SqlClient { query<Row extends Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<SqlQueryResult<Row>> }
interface OwnerRow extends Record<string, unknown> { tenant_id: string | null; session_id: string }

function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/u.test(value)) throw new TypeError(`unsafe SQL identifier "${value}"`)
  return value
}

export class PostgresSessionOwnershipProvider implements SessionOwnershipProvider {
  readonly table: string
  constructor(private readonly client: SqlClient, table = 'dsh_tenant_session_owners') { this.table = identifier(table) }

  async initialize(): Promise<void> {
    await this.client.query(`CREATE TABLE IF NOT EXISTS ${this.table} (
      session_id TEXT PRIMARY KEY,
      tenant_id TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      migrated_at TIMESTAMPTZ NULL
    )`)
  }

  async get(sessionId: string): Promise<SessionOwnershipRecord | undefined> {
    const result = await this.client.query<OwnerRow>(
      `SELECT session_id, tenant_id FROM ${this.table} WHERE session_id = $1`, [sessionId],
    )
    return this.#record(result.rows[0])
  }

  async claimIfAbsent(owner: SessionOwner): Promise<SessionOwnershipRecord> {
    const inserted = await this.client.query<OwnerRow>(
      `INSERT INTO ${this.table} (session_id, tenant_id) VALUES ($1, $2)
       ON CONFLICT (session_id) DO NOTHING RETURNING session_id, tenant_id`,
      [owner.sessionId, owner.tenantId],
    )
    return this.#record(inserted.rows[0]) ?? (await this.get(owner.sessionId)) ?? 'legacy'
  }

  async migrateLegacy(owner: SessionOwner): Promise<SessionOwnershipRecord> {
    const updated = await this.client.query<OwnerRow>(
      `UPDATE ${this.table} SET tenant_id = $2, migrated_at = NOW()
       WHERE session_id = $1 AND tenant_id IS NULL RETURNING session_id, tenant_id`,
      [owner.sessionId, owner.tenantId],
    )
    return this.#record(updated.rows[0]) ?? (await this.get(owner.sessionId)) ?? this.claimIfAbsent(owner)
  }

  #record(row: OwnerRow | undefined): SessionOwnershipRecord | undefined {
    if (!row) return undefined
    if (row.tenant_id === null) return 'legacy'
    return Object.freeze({ sessionId: row.session_id, tenantId: TenantId(row.tenant_id) })
  }
}
