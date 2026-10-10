# Issue 跟踪器：GitHub

[English](issue-tracker.md) | 中文

在 `jammer-droid/deepseek-harness` 的 GitHub Issues 中跟踪工作。使用 `gh` CLI（命令行界面）时显式传入 `--repo jammer-droid/deepseek-harness` 参数；不要根据 upstream 远端推断跟踪器。

## Skill 操作

当 skill 要求发布工单时，在此仓库创建 issue。当 skill 要求获取工单时，读取其标题、正文、标签和评论。链接其他仓库的 issue 时，保留带仓库限定的信息。

使用 GitHub sub-issues 表达父子关系；平台支持时，使用原生 issue 依赖关系表达阻塞项。否则，在 issue 正文中明确记录父项和阻塞项引用。

发布 issue、评论或其他跟踪器变更需要当前任务的授权；此配置本身不授权这些操作。

## 分流

使用[分流标签](triage-labels.zh.md)中的角色映射。

**将 PR（Pull Request）用作请求入口：否。**

## 实现规格

遵循所调用 skill 的发布规则。特别是，`refine-issue` 将实现规格保留在本地仓库中，不修改跟踪器。
