---
name: build-routing
description: Route a confirmed design to implement or to-spec. Use when another skill needs to choose the next build step from task scale and context durability.
---

# Build Routing

输入是已经由用户确认的共享理解。输出只包含一个后续建议和最关键的理由；本技能只提供后续提醒，不自动调用 `/implement` 或 `/to-spec`。

默认建议直接进入 `/implement`。这是一个可在当前上下文内完成并验证的单一工作单元时，不要把 `/to-spec` 当作所有实施工作的必经门。

只有满足以下至少一项时，才建议先进入 `/to-spec`：

- 工作明显需要多个会话才能完成；
- 存在多个可独立实施、验证或并行推进的功能切片；
- 关键决策、验收标准或上下文需要持久化，供新的上下文窗口继续使用；
- 当前上下文接近推理质量边界，继续实施容易丢失已确认结论；
- 用户明确要求持久 spec、拆票或跨会话交接。

使用以下输出之一：

```text
后续建议：`/implement`
理由：这是一个可在当前上下文内完成并验证的单一工作单元，不需要持久 spec 或拆票。
```

```text
后续建议：`/to-spec`
理由：工作跨多个会话或包含多个独立切片，需要先固化访谈结论；spec 完成后再用 `/to-tickets` 拆分，并逐票 `/implement`。
```

路由证据不明确时采用轻量默认：建议 `/implement`，同时指出若工作扩展成多会话或多切片，应切换到 `/to-spec`。
