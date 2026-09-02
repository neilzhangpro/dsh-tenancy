export class TenancyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class InvalidTenantIdError extends TenancyError {}
export class TenantContextRequiredError extends TenancyError {}
export class TenantDisposedError extends TenancyError {}
export class TenantPluginRejectedError extends TenancyError {}
export class SessionOwnershipError extends TenancyError {}
export class LegacySessionOwnershipError extends SessionOwnershipError {}
