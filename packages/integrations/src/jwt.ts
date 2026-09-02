import { TenantId, type TenantId as TenantIdType } from '@dsh-tenancy/core'

declare const verifiedClaimsBrand: unique symbol
export type VerifiedJwtClaims = Readonly<Record<string, unknown>> & { readonly [verifiedClaimsBrand]: true }
export type JwtVerifier = (token: string) => Promise<Readonly<Record<string, unknown>>>

export async function verifyJwtClaims(token: string, verifier: JwtVerifier): Promise<VerifiedJwtClaims> {
  if (!token.trim()) throw new TypeError('JWT must not be empty')
  return Object.freeze(await verifier(token)) as VerifiedJwtClaims
}

export function tenantIdFromVerifiedClaims(claims: VerifiedJwtClaims, claim = 'tenant_id'): TenantIdType {
  const value = claims[claim]
  if (typeof value !== 'string') throw new TypeError(`verified JWT claim "${claim}" must be a string`)
  return TenantId(value)
}
