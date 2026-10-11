# Studio 浏览器验收

[English](README.md) | 中文

浏览器测试通过现有 Web 测试支架，用 Playwright 操作实际的 Studio 侧边栏。测试支架使用隔离的 profile 和临时端口，不会替换现有 GUI。源码测试辅助模块通过真实 Loader 组合已构建的 Host/Client 包和 Studio 包导出，包括自动发现 `./typert`。编辑器仅含头部的测试样本提供不发起调用的回放提供者目录。委派样本包含完整的 V4 父子调用：真实工具执行经过公共激活服务和回放适配器，不需要凭据或在线提供者。

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

委派验收覆盖捕获的指令和实际请求强度、独立周期、早期设置不可变、模型发起调用的日志回执与工具定义快照、包含 Agent 自有工具的父子执行器拒绝、不受管正向对照、冷受管恢复拒绝、发布前持久化预留、未知准入阻止重试，以及准入等待中或执行中的释放。释放测试重新打开存储域并检查持久化结果。Agents 浏览器测试先选择受管预设再创建根任务，操作真实会话标签和完整地址子任务，将英语切换为中文，并比较导航前后的完整子任务持久化日志。

审查验收通过真实执行器使用子任务自有的原生结构化提交：覆盖全新设置和证据输入快照、其他父任务的周期归属、重叠准入或完成拒绝、写入/Shell/委派/PTC/设置及任意子任务自有工具拒绝，并验证搜索和提交可用。结果录制覆盖通过、需要修改、无法判断、等待额外验证、无效结论和缺失提交。只有不附加验证请求的通过结论之后，显式完成才会关闭周期；计数的同标识返工之后允许复审。有界操作测试覆盖自然卸载、常驻审查者重复的操作专属提交、并发唤醒拒绝、两次计数验证唤醒、第三次拒绝、设置和指令不变、适配器默认推理强度及旧通过拒绝。Chrome 用英语和中文显示通过、未通过、无法判断和无效结果，并验证浏览任一子任务不增加模型调用。

Fork 验收通过真实激活提供者验证两个角色：已完成父轮次前缀相等、首轮空继承及单独记录的当前证据、排除继承 catalog，以及同一标识返工和复审时保留上下文、设置与继承事件数。这些是无需密钥的回放检查，不是实时提供者缓存测量。

验证前代兼容性时，在运行时变量之外设置 `DSH_TEST_PREDECESSOR_STUDIO=/path/to/built-ticket9/studio`，并运行 `studio/test/predecessor-reopen.browser.test.ts`；未设置时跳过该测试。真实前代 Loader 写入旁路存储后，当前插件重新打开同一后端并检查标识和设置不变；这是插件及存储域重新打开，不是进程重启或恢复执行权限。应使用经过核验的 ticket9 构建产物，不能使用解析到当前 Studio 的路径。

使用 `DSH_TEST_RUNTIME_ROOT=/path/to/runtime-checkout node studio/test/typecheck.mjs` 严格检查集成测试。它使用所选运行时的官方 Host 引用和服务声明，但检查当前工作树的 Studio 源码与测试，不写出含机器路径的配置。产品 Host/Client 产物检查仍属于 `build`。
