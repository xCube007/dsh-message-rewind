# 开发与发布

面向改代码、发版的人。用法和安装看 [README.md](README.md)。

## 本地开发

```bash
git clone https://github.com/xCube007/dsh-message-rewind.git
```

在 profile 里用链接方式装（`"dsh-message-rewind": "link:D:/Code/dsh-message-rewind"`），然后：

- 改了 `index.js`：在「设置 → 插件」里把插件关掉再打开即热重载。
- 改了 `client.js`：客户端会通过 `/plugins/events` 收到 bundle 变更并重新 import，必要时刷新一次页面。

无外部依赖，Node 直接跑自检：

```bash
node rewind.test.js   # 切点 / diff 逆向数学
node files.test.js    # 文件回滚：新建、删除、修改、无结尾换行、BOM、冲突拒绝、跨轮回卷、undo
node index.test.js    # Host 端：会话目录定位与越权路径拒绝（purge 的前置保护）
node client.test.js   # 客户端：用 stub React 跑主交互（渲染按钮 → 编辑 → inspect → execute → purge → 错误本地化）
```

`npm test` 会依次跑这四个文件。

## 目录结构

```
index.js            Host 端：路由、鉴权、inspect/execute/purge、会话 fork 与清理
rewind.js           纯函数：切点计算、反向应用 diff、重建 diff 某一侧
files.js            文件回滚：计划（只读校验）→ 落盘 → 失败自动撤销
client.js           浏览器端：消息气泡 actions、确认/编辑弹窗
locale/{zh,en}.json 插件显示名与描述
cordis.patch.yml    bundle patch
*.test.js           自检（node 直接跑，无测试框架依赖）
```

## 设计说明：为什么每次回滚都会换一个会话

这是 DSH 的存储模型决定的，不是实现偷懒：

- 会话日志（`session.v4.jsonl.zstd`）是**只追加**的，`sessionPersistence` 只提供 `create / open / flush / stat / list`，`truncate` 仅用于崩溃后修复残尾（按字节）。
- 日志格式里唯一能「少掉一段历史」的表达是 `surfaceOp: { op: 'replace', start, end }`，但携带该 op 的事件本身会被渲染 —— 只能「替换成另一条消息」，不能「替换成空」。
- 因此能截断历史的原语只有 `sessionController.fork({ atSeq })`。

所以插件的做法是：fork 出截断后的分支 → 打开它 → 把原会话归档（并尽力删除其日志目录），让侧边栏始终只有一条同名对话。代价是底层 SessionId 会变；原记录通常被删除，只有日志目录被占用删不掉时才留在归档里可恢复。

## 实现要点

- **通信不走自定义 Typert Remote**：第三方插件声明自定义命名空间不会自动生成远端绑定，客户端会一直 `pending`，把 web boot 拖死。
- **也不走 `connection.rpc.handle()`**：Cordis 的服务代理只在**方法调用**时把 `this.ctx` 绑到调用方上下文，而 `connection.rpc` 是 getter，闭包里捕获的是 connection 插件自己的 ctx —— 它没有 `inject: webServer`，注册时会抛 `cannot get property "webServer" without inject`。
- 最终做法：`ctx.webServer.register({ kind: 'prefix', path: '/message-rewind' })` 自建路由，手写 `client-request` / `server-response` 信封，鉴权复用 `ctx.connection.admit(request)`；客户端用官方的 `ctx.connection.rpc.call(channel, endpoint, payload)` 调用，两端信封天然对齐。
- **purge 的删除目标必须自己证明安全**：`sessionId` 先按 `session-<uuid>` 形状校验，再用 `realpath` 把命中目录限定在 sessions root 内（只认 `root/<id>` 与 `root/<slug>/<id>` 两层），绝不把拼接结果直接交给 `fs.rm`。归档失败时直接放弃删除，避免留下“侧边栏里还在、日志已没了”的会话。
- Host 侧的失败都带 `rewindCode`，客户端按 code 查 zh/en 字典，拿不到词条才回退到 Host 的原文。
- UI 侧替换 `conversation.chat.node` 的 `user` 键渲染器（该 slot 的 `replaceRisk` 就是 `shadows-shipped-ui`）：气泡内容仍由官方 `conversation.chat.user.content` 工厂渲染，图标/剪切板兜底是插件自己的 `dmr-` 前缀实现，不再 require `@deepseek-ai/dsh-client-ui-primitives`（官方 practices 明确不要依赖 Client 包）。
- 对话弹窗只允许在 `loading` 阶段取消；inspect/execute 都带 30s 超时，过期的响应按 token 丢弃，不会把已关闭的弹窗重新拉起来。

## 发布到 npm

```bash
npm login                     # 浏览器授权一次
npm publish                   # publishConfig.access=public 已固化
```

发新版：

```bash
npm version patch             # 或 minor / major，自动改版本并打 tag
git push --follow-tags
npm publish
```

打 GitHub Release（也可以用 `gh`）：

```bash
git tag -a v1.1.0 -m "dsh-message-rewind v1.1.0" && git push origin v1.1.0
gh release create v1.1.0 --title v1.1.0 --notes-file notes.md
```

注意：`npm version patch` 已经会创建 tag，不要再手动 `git tag` 同名 tag（会报 already exists）；用 `npm version patch --no-git-tag-version` 则需要自己补 `git tag`。

两个必须遵守的约束：

1. **`package.json` 的 `name` 必须与 `client.js` 里 `window.__ModuleLoader__.load({ id })` 完全一致** —— 宿主按包名把客户端 bundle 挂进 boot roster，不一致会导致该 entry 永远 pending、web boot 失败。
2. 当前发布的是非 scoped 的 `dsh-message-rewind`；`access: public` 对它是 no-op，保留是为了以后改回 scoped 包时不出错。

发布前 `npm test` 和 `npm pack --dry-run` 都必须过（`prepublishOnly` 已自动跑测试；CI 在 `.github/workflows/test.yml` 里跑 Node 20/22/24 × Linux/Windows）。
