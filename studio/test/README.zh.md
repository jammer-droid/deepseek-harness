# Studio 浏览器验收

[English](README.md) | 中文

浏览器测试通过现有 Web 测试支架，用 Playwright 操作实际的 Studio 侧边栏。测试支架使用隔离的 profile 和临时端口，不会替换现有 GUI。源码测试辅助模块通过真实 Loader 组合已构建的 Host/Client 包和 Studio 包导出，包括自动发现 `./typert`。仅含头部的测试样本提供不发起调用的回放提供者目录。这不是在线模型测试。

先构建 Studio 以及所选运行时的 Host 包、Client bundle 和 Web 分发产物。通过仓库的常规设置安装已声明的浏览器测试依赖；本测试不安装依赖或浏览器。默认使用缓存的 Playwright Chromium；`DSH_TEST_BROWSER_CHANNEL=chrome` 使用已安装的 Chrome。在仓库根目录运行：

```sh
npm --prefix studio run test:browser
```

工作树可以使用版本匹配、已构建的运行时检出目录，无需更改该目录的依赖：

```sh
DSH_TEST_RUNTIME_ROOT=/path/to/runtime-checkout DSH_TEST_BROWSER_CHANNEL=chrome npm --prefix studio run test:browser
```

可选的 `DSH_TEST_SCREENSHOT=/absolute/path/accepted.png` 记录最终确认状态的编辑器。截图包含动态快照标识，仅作为验收证据，不提交为像素基线。

测试覆盖两个固定角色、仅改变草稿且可由重新查询丢弃的编辑、保存与应用快照标识一致的显式 Apply、浏览器刷新和重新查询后保留已保存值，以及 HTTP 读取失败时禁用 Apply 但保留重试操作。浏览器刷新不是 Host 进程重启；重启和存储失败行为由 Host 测试覆盖。
