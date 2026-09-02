# Security

> This project provides application-level tenant scoping and admission controls.
> It is not a sandbox and does not make arbitrary Node.js plugins safe to execute
> in a shared process.

> 本项目提供应用级租户作用域和插件准入控制，不是代码沙箱，也不会让任意
> Node.js 插件在共享进程中自动变得安全。

Report vulnerabilities privately to the repository maintainers. Do not include
live credentials or tenant data in a report. The supported line is v0.1.x.

The security boundary covers contexts, registrations, lifecycle, admission, and
session ownership handled through this library. It does not cover direct access
to `process.env`, globals, the filesystem, subprocesses, or native modules.
