import { readFile, writeFile, unlink } from 'node:fs/promises'

const body = await readFile(new URL('../dist/client.cjs', import.meta.url), 'utf8')
const wrapped = `window.__ModuleLoader__.load({\n  id: "dsh-plugin-tenancy-suite",\n  factory: (require) => {\n    var module = { exports: {} };\n${body.split('\n').map(line => `    ${line}`).join('\n')}\n    return module.exports;\n  },\n});\n`
await writeFile(new URL('../dist/client.js', import.meta.url), wrapped)
await unlink(new URL('../dist/client.cjs', import.meta.url))
