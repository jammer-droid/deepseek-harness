# DSH Studio

[English](README.md) | 中文

Studio 是 fork 内的工作区，提供侧边栏页面和可独立启用的演示计时器。详细的本地操作说明见[韩文开发指南](development.ko.md)。

## 开发

在仓库根目录运行，使用仓库要求的 Node 和 pnpm 版本：

```sh
pnpm install
pnpm --dir studio run prepare:types
pnpm --dir studio test
pnpm --dir studio run watch
```

`prepare:types` 构建官方 Host 产物、生成的 Remote 声明和引用的 Client 声明。上游 API 变更后重新运行。Host 和 Client 分别采用严格的产物层检查，继承官方编译器基础配置，清除源码别名并使用公共包声明；检查 Studio 前必须先生成所需产物。`watch` 仅重新构建 Studio JavaScript；需另行运行 `pnpm --dir studio run typecheck`。

## 包

- `packages/shell`：侧边栏页面和 profile 启用开关。
- `packages/demo`：可释放的 Client 计时器。
- `packages/roles`：profile 持久化的实现者/审查者设置、生成的 Remote 和按语言提供文案的编辑器。
- `packages/bundle`：工作区 bundle；演示功能默认禁用。

修改 `src/`，不要修改生成的 JavaScript。原生 Plugin Manager 持久化启用状态；计时器状态属于各个 Client 实例。框架类型来自官方 Cordis 和 DSH 包。

## 固定角色设置

Studio 仅拥有实现者和审查者两个角色。指令、提供者和模型为必填项；可选的推理强度必须由所选目录模型支持。留空表示请求适配器默认值，并不冻结实际推理强度。编辑不会执行角色，也不会自动保存。Apply 先验证两个角色并核对所观察的进程、revision 和快照标识，再持久化整个角色对，最后重新验证激活状态。发生冲突时需重新查询后再试。显式重新查询替换草稿；重连后的查询保留草稿。语言和 Client 订阅随插件一起释放。

编辑器区分未配置、已应用、已保存但未应用三种状态，分别显示持久化保存标识、已应用标识和进程内 revision。验证或持久化失败时保留原快照。保存后激活失败会阻止新的捕获，需修复模型可用性或设置后再次应用。传输失败意味着结果未知，应先重新查询再重试。关闭 Studio 页面不影响 Host 存储；设置使用 profile 公共 Storage Domain 持久化，而非浏览器存储。

`studioRoles.capture(role)` 仅供 Host 调用，返回独立的创建时设置快照。之后的 Apply 不会修改该捕获值。捕获不会创建、恢复或更改子任务；消费者负责子任务执行以及请求配置和实际调用配置的记录。

`generate-roles.mjs` 在隔离的声明工作区中调用公共 Typert 生成器，输出 Host 反射以及 Client Remote JS/DTS。`build` 执行生成、两侧严格编译检查和打包，并将公共 Host 导入保留为外部依赖。[针对性测试](test/README.zh.md)覆盖生成的 Remote 调度、自动发现反射的真实浏览器 Slot 渲染以及冷进程磁盘持久化。

## 受管委派

创建根会话前，先将 Studio 设为新任务 Agent 预设。其协调者仅提供规划、读取工具和 `studio_delegate`，不提供通用子任务、工作流、Shell/写入、插件或目标管理。执行器守卫也会拒绝 Agent 自有但不在允许列表内的能力。不受管预设保持不变；恢复的受管会话或缺少实时预留的子任务不能从持久化记录重新取得执行权限。

开始周期时，向 `studio_delegate` 提交 `initial`（角色必须为 `implementer`，任务提示非空，可选上下文为 `fresh`）；仅含 `status` 的请求用于读取已记录进度。Initial 捕获已应用的指令、提供者、模型和推理强度，持久化 Host 生成的周期、操作和子任务标识，再启动一个真实的全新实现者。立即写入日志的回执标明已接受的消息；status 仅读取记录的输出和终态，不唤醒子任务。准入结果未知时，该实时协调者不能重试。模型或工具覆盖、分叉、返工和恢复均被拒绝。每次独立 initial 使用新周期；首次实现的返工计数为零。两个 Agent 共用工作区：全新上下文并非文件系统隔离。

会话的 Agents 标签位于 Trajectory 旁，分别显示捕获的设置和指令、从持久化请求观察到的实际配置，以及任务、输出、成员标识和状态。重新加载需显式操作。状态读取和使用完整地址浏览子任务不会唤醒子任务；打开父会话可能激活普通会话，但不会启动模型轮次。推理强度留空时使用适配器默认值，不继承父任务请求的其他强度。之后修改设置不会改变已有捕获。预留和结果使用 Studio 自有的 Storage Domain 记录，不修改 Session 格式；冷记录只提供事实，不授予执行权限。

### 审查与显式完成

实现者完成后，`review` 接受所属周期的 `cycleId` 及 `evidence`：非空的 `requirements` 和 `summary`、`changedFiles`、包含 `command`/`result` 的 `validations`、`failures` 和未执行的 `unrun` 检查。它使用独立捕获的当前审查者设置创建一个全新审查者。证据和实现者输出写入审查者输入日志；它们是待检查的声明，不是执行命令的授权。审查者只能读取、搜索和提交原生结构化输出。实际执行器仍拒绝 Shell、写入、通用委派、工作流、PTC、设置修改和任意 Agent 自有工具。

每次激活的有效结论为 `pass`、`needs-changes` 或 `unable-to-judge`，并包含解释、证据和请求的 `additionalVerification`。缺失或无效输出绝不视为通过；运行失败或中断与审查结论分开记录。`complete` 要求周期归属正确、有效结论为通过且没有额外验证请求。实现完成或审查通过均不会自动关闭周期。目前不支持重复审查、同周期额外实现或返工。状态和 Agents 标签显示结论及显式完成事实，不唤醒子任务。旧的旁路存储记录仍可读取；缺少审查或完成字段表示未记录对应事实。

## 安装

先运行 `pnpm --dir studio run build`，再运行 `pnpm --dir studio run pack:bundle`。打包将 manifest 暂存于 `dist/bundle`，不会修改工作区元数据：源码依赖使用 `workspace:*`；暂存的原生依赖使用各自工作区 manifest 中的精确版本，Studio 组件则使用本地 tarball。bundle 引用组件 tarball 的绝对路径：需保留 `dist`，移动检出目录后重新打包。此格式用于本地安装，不用于公开分发。

使用独立的开发 profile 和匹配的 DSH 运行时。未经兼容性验证，不得用 fork 的 alpha 版本产物替换旧版 Desktop 安装。Studio watch 和官方 Web watcher 都不会自动更新已安装的 tarball。集成测试使用隔离且版本匹配的 Web 运行时，不验证现有安装的 GUI 或其他运行时版本的兼容性。
