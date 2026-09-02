import { TenantId, type Tenant, type TenantId as TenantIdType, type TenantRuntime } from '@dsh-tenancy/core'

export type TenantRequestHandler<Request, Response> = (request: Request, tenant: Tenant) => Response | Promise<Response>
export type TenantIdResolver<Request> = (request: Request) => TenantIdType | string | Promise<TenantIdType | string>

export function createTenantHttpMiddleware<Request, Response>(
  runtime: TenantRuntime,
  resolveTenantId: TenantIdResolver<Request>,
) {
  return async (request: Request, next: TenantRequestHandler<Request, Response>): Promise<Response> => {
    const tenantId = TenantId(await resolveTenantId(request))
    return runtime.run(tenantId, (tenant) => next(request, tenant))
  }
}
