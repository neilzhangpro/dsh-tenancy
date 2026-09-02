# dsh-plugin-tenancy-suite

兼容版 DSH UI 套件：侧边栏提供 “New tenant agent”，创建流程先选租户，再由
`tenantAgentUi.create()` 调用后端的 `tenantAgents.create`，最后打开返回的 session。

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

DSH `0.1.1-rc.2` 的官方 sidebar 是 single slot，公开 API 不能替换其内部 New
Session 按钮。因此套件使用官方 `sidebar.footer.action` 接管租户新建入口，不改
DSH 核心，也不使用脆弱的 DOM monkey-patch。若要字面替换官方按钮，需要 DSH
暴露 sidebar shell 的 `startSession` placement 回调。
