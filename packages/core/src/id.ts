import { InvalidTenantIdError } from './errors.js'

declare const tenantIdBrand: unique symbol
export type TenantId = string & { readonly [tenantIdBrand]: true }

const MAX_TENANT_ID_LENGTH = 128
const FORBIDDEN = /[\u0000-\u001f\u007f/\\]/u

export function TenantId(value: string): TenantId {
  if (typeof value !== 'string') throw new InvalidTenantIdError('tenant id must be a string')
  const normalized = value.normalize('NFKC').trim()
  if (!normalized) throw new InvalidTenantIdError('tenant id must not be empty')
  if (normalized.length > MAX_TENANT_ID_LENGTH) {
    throw new InvalidTenantIdError(`tenant id must not exceed ${MAX_TENANT_ID_LENGTH} characters`)
  }
  if (FORBIDDEN.test(normalized)) {
    throw new InvalidTenantIdError('tenant id must not contain control characters or path separators')
  }
  return normalized as TenantId
}
