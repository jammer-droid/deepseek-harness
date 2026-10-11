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

`studioRoles.capture(role)` 仅供 Host 调用，返回独立的创建时设置快照。之后的 Apply 不会修改该捕获值。子任务创建、执行、恢复以及请求配置和实际调用配置的记录由后续委派功能负责；本功能不会创建或更改已有子任务。

`generate-roles.mjs` 在隔离的声明工作区中调用公共 Typert 生成器，输出 Host 反射以及 Client Remote JS/DTS。`build` 执行生成、两侧严格编译检查和打包，并将公共 Host 导入保留为外部依赖。针对性验证位于 `test/`；Loader 测试显式注册生成的反射。安装包反射自动发现、真实浏览器 Slot 挂载以及冷进程持久化后端重启需要单独的集成验证。

## 安装

先运行 `pnpm --dir studio run build`，再运行 `pnpm --dir studio run pack:bundle`。打包将 manifest 暂存于 `dist/bundle`，不会修改工作区元数据。bundle 引用组件 tarball 的绝对路径：需保留 `dist`，移动检出目录后重新打包。此格式用于本地安装，不用于公开分发。

使用独立的开发 profile 和匹配的 DSH 运行时。未经兼容性验证，不得用 fork 的 alpha 版本产物替换旧版 Desktop 安装。Studio watch 和官方 Web watcher 都不会自动更新已安装的 tarball。实际浏览器渲染和冷启动行为需要手动验证。
