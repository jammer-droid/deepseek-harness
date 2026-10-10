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

`prepare:types` 构建官方 Host 产物、生成的 Remote 声明和引用的 Client 声明。上游 API 变更后重新运行。Host 和 Client 使用独立检查，继承官方编译器基础配置并引用官方项目。`watch` 仅重新构建 Studio JavaScript；需另行运行 `pnpm --dir studio run typecheck`。

## 包

- `packages/shell`：侧边栏页面和 profile 启用开关。
- `packages/demo`：可释放的 Client 计时器。
- `packages/bundle`：工作区 bundle；演示功能默认禁用。

修改 `src/`，不要修改生成的 JavaScript。原生 Plugin Manager 持久化启用状态；计时器状态属于各个 Client 实例。框架类型来自官方 Cordis 和 DSH 包。

## 安装

先运行 `pnpm --dir studio run build`，再运行 `pnpm --dir studio run pack:bundle`。打包将 manifest 暂存于 `dist/bundle`，不会修改工作区元数据。bundle 引用组件 tarball 的绝对路径：需保留 `dist`，移动检出目录后重新打包。此格式用于本地安装，不用于公开分发。

使用独立的开发 profile 和匹配的 DSH 运行时。未经兼容性验证，不得用 fork 的 alpha 版本产物替换旧版 Desktop 安装。Studio watch 和官方 Web watcher 都不会自动更新已安装的 tarball。实际浏览器渲染和冷启动行为需要手动验证。
