# dsh-message-rollback

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的消息编辑与回滚插件：在你发出的每条消息气泡下方、复制按钮左边加一个 **编辑** 和 **删除**，删除会连带这条消息之后的所有对话，并可选把那一轮产生/修改/删除的文件一起回滚。

> A DSH plugin that adds **edit** and **delete** to your own message bubbles. Deleting truncates every following turn and can optionally roll the recorded file changes back.

---

## 功能

- **编辑并重发**：直接改已发送的消息内容，然后以修改后的内容重新开始这一段对话。
- **删除**：删掉这条消息及其后的全部对话。
- **可选文件回滚**：如果被删除的对话里有文件改动，弹窗会让你选「只回滚消息」还是「同时回滚消息和文件」。
- **保留后路**：回滚前的完整记录会被归档（可恢复），或按你的选择彻底删除。
- 纯文本消息可编辑；带附件的消息只能删不能改；有未结束的轮次时会被拒绝，避免和正在跑的 turn 抢写。

## 安装

### 从 npm 安装（推荐）

包名 `@cube007/dsh-message-rollback`（[npm](https://www.npmjs.com/package/@cube007/dsh-message-rollback)）。

1. 在 profile 的 `package.json` 里加依赖（`~/.dsh/profiles/<profile>/package.json`）：

   ```json
   {
     "dependencies": {
       "@cube007/dsh-message-rollback": "^1.0.0"
     }
   }
   ```

2. 在 profile 的 `cordis.patch.yml` 里挂上这一行：

   ```yaml
   - insert:
       - id: message-rollback
         name: '@cube007/dsh-message-rollback'
   ```

3. 在 profile 目录执行 `pnpm install`，然后重启 DSH（或在「设置 → 插件」里启用）。

### 从源码安装（开发/魔改用）

```bash
git clone https://github.com/xCube007/dsh-message-rollback.git D:/Code/dsh-message-rollback
```

把上面第 1 步的依赖换成链接形式，其余步骤相同：

```json
"@cube007/dsh-message-rollback": "link:D:/Code/dsh-message-rollback"
```

装好后 `dsh` 启动日志里应出现 `message-rollback` 这一行且状态为 active；刷新页面后，自己发的消息气泡下方会出现「编辑 / 删除 / 复制」三个按钮。


## 使用

| 操作 | 效果 |
| --- | --- |
| 点铅笔 | 弹出编辑框，改完点「保存并重发」 |
| 点垃圾桶 | 确认后删除该消息及其后所有对话 |
| 弹窗里选「同时回滚消息和文件」 | 把那一轮改动过的文件恢复到这条消息之前的内容 |

## 设计说明：为什么每次回滚都会换一个会话

这是 DSH 的存储模型决定的，不是实现偷懒：

- 会话日志（`session.v4.jsonl.zstd`）是**只追加**的，`sessionPersistence` 只提供 `create / open / flush / stat / list`，`truncate` 仅用于崩溃后修复残尾（按字节）。
- 日志格式里唯一能「少掉一段历史」的表达是 `surfaceOp: { op: 'replace', start, end }`，但携带该 op 的事件本身会被渲染 —— 只能「替换成另一条消息」，不能「替换成空」。
- 因此能截断历史的原语只有 `sessionController.fork({ atSeq })`。

所以插件的做法是：fork 出截断后的分支 → 打开它 → 把原会话归档（或按设置彻底删除其日志目录），让侧边栏始终只有一条同名对话。代价是底层 SessionId 会变；原记录要么留在归档里可恢复，要么被删掉。

## 已知限制

- **文件回滚依赖 recorder 快照**，以下情况回不来（都会明确报错，不会静默跳过）：
  - 二进制文件（`workspaceChanges.diff()` 只提供文本 hunk）；
  - 工作区**不在 Git 仓库内**时，只记录 DSH 自己的文件工具（write/edit）动过的文件，shell 命令删除/修改的文件无法记录 —— 在该目录 `git init` 后可完整记录；
  - 会话重启或释放后 recorder 的内存记录已失效（弹窗提示「部分文件改动快照已不可用」）。
- 文件在记录之后又被外部修改过时，回滚会**拒绝**而不是覆盖。
- 带附件的消息只能删除、不能编辑。
- 有未结束的轮次、或还有排队中的消息时，操作会被拒绝/提示。

## 实现要点

- **通信不走自定义 Typert Remote**：第三方插件声明自定义命名空间不会自动生成远端绑定，客户端会一直 `pending`，把 web boot 拖死。
- **也不走 `connection.rpc.handle()`**：Cordis 的服务代理只在**方法调用**时把 `this.ctx` 绑到调用方上下文，而 `connection.rpc` 是 getter，闭包里捕获的是 connection 插件自己的 ctx —— 它没有 `inject: webServer`，注册时会抛 `cannot get property "webServer" without inject`。
- 最终做法：`ctx.webServer.register({ kind: 'prefix', path: '/message-rollback' })` 自建路由，手写 `client-request` / `server-response` 信封，鉴权复用 `ctx.connection.admit(request)`；客户端用官方的 `ctx.connection.rpc.call(channel, endpoint, payload)` 调用，两端信封天然对齐。
- UI 侧替换 `conversation.chat.node` 的 `user` 键渲染器（该 slot 的 `replaceRisk` 就是 `shadows-shipped-ui`），并复用 `@deepseek-ai/dsh-client-ui-primitives` 的图标与 Tooltip，气泡内容仍由官方 `conversation.chat.user.content` 工厂渲染，保证视觉一致。

## 目录结构

```
index.js            Host 端：路由、鉴权、inspect/execute/purge、会话 fork 与清理
rollback.js         纯函数：切点计算、反向应用 diff、重建 diff 某一侧
files.js            文件回滚：计划（只读校验）→ 落盘 → 失败自动撤销
client.js           浏览器端：消息气泡actions、确认/编辑弹窗
locale/{zh,en}.json 插件显示名与描述
cordis.patch.yml    bundle patch
*.test.js           自检（node 直接跑，无测试框架依赖）
```

## 开发与自检

无外部依赖，Node 直接运行：

```bash
node rollback.test.js   # 切点 / diff 逆向数学
node files.test.js      # 文件回滚：新建、删除、修改、无结尾换行、冲突拒绝、跨轮回卷、undo
node client.test.js     # 客户端：用 stub React 跑完整交互（渲染按钮 → 编辑 → inspect → execute → purge）
```

改了 `index.js` 后在「设置 → 插件」里把插件关掉再打开即可热重载；改了 `client.js` 后客户端会通过 `/plugins/events` 收到 bundle 变更并重新 import，必要时刷新一次页面。

## 发布到 npm（维护者备忘）

```bash
npm login                     # 浏览器授权一次
npm publish                   # publishConfig.access=public 已固化，scoped 包免加 --access
```

发新版：

```bash
npm version patch             # 或 minor / major，自动改版本并打 tag
git push --follow-tags
npm publish
```

两个必须遵守的约束：

1. **`package.json` 的 `name` 必须与 `client.js` 里 `window.__ModuleLoader__.load({ id })` 完全一致** —— 宿主按包名把客户端 bundle 挂进 boot roster，不一致会导致该 entry 永远 pending、web boot 失败。
2. scoped 包默认私有，必须 `access: public`（已写进 `publishConfig`，不要删）。

发布前用 `npm pack --dry-run` 确认 tarball 只含运行所需文件。

## License

MIT
