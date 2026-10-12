---
kind: upgrade-guide
description: "Studio 工作流草稿使用版本 3 角色引用和异步模型验证。"
---

# Studio 工作流角色

[English](guide.md) | 中文

## 变更

Studio 工作流草稿使用 `documentVersion: 3`、`roles` 数组和 `mainRoleId`，替代版本 2 的内联 `mainRole`。每个角色可独立选择模型。`studioWorkflows.validate()` 返回 Promise，并检查 DSH 公布的模型及推理选项。此变更影响本地 Studio 插件用户及其生成 Remote API 的调用方，不影响现有 General 或固定角色设置。

## 迁移

1. 升级前备份 Studio 草稿存储。读取旧格式或版本 2 草稿时，会保留 revision 和数据，不重写存储。现有主角色获得确定性 ID，不会自动分配模型。
2. 打开草稿，明确选择初始模型并检查角色选择。首次选择会复制到现有角色，并作为新角色的初始值；之后各角色的编辑相互独立。
3. 明确保存以写入版本 3。确认重新打开草稿后，角色名称、组件、连接和模型选择保持不变。无效模型选择仍可保存，并显示诊断。
4. 更新自定义 Remote 调用方，使其发送版本 3 文档并等待 `validate()`。同时重新构建生成的客户端和 Host。不要用旧版 Studio 读取新保存的版本 3 草稿；不支持降级。如需回退，请恢复升级前的备份。
