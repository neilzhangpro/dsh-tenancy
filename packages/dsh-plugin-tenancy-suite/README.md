# dsh-plugin-tenancy-suite

按 DSH 官方 UI 插件方式实现的多租户 Sidebar：Bundle 层禁用官方 `ui-sidebar`，
再注册同一份 `sidebar` shell；创建流程先选租户，再由 `tenantAgentUi.create()`
调用后端的 `tenantAgents.create`，最后打开返回的 session。官方的 workspace、
settings、footer 子 slot 仍由原插件提供。

本地 tarball 安装：

```bash
dsh plugin --profile web add ./dsh-plugin-tenancy-0.3.0.tgz
dsh plugin --profile web add ./dsh-plugin-tenancy-suite-0.3.0.tgz
```

宿主提供浏览器侧 `tenantAgentUi` service：

```ts
const tenantAgentUi = {
  listTenants: () => tenants,
  activeTenant: () => currentTenant,
  create: (tenantId) => remote.tenantAgents.create({ tenantId }),
  open: (sessionId) => sessions.open(sessionId),
}
```

`create` 的服务端实现必须先校验 JWT、claim session，再调用
`TenantDshAgentBridge.create()`；UI 插件不在浏览器伪造租户隔离。

DSH 的 patch 是按 id 覆盖整行配置，因此 `ui-sidebar: disabled: true` 是官方支持
的替换方式；不需要改 DSH 核心，也不使用 DOM monkey-patch。当前 DSH 没有独立的
remove 操作，但禁用官方行的效果等价于从该 profile 移除它。
