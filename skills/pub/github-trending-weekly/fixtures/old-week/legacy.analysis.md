## 本周看点

本周（2026-W36，首个采集周）榜单最显著的信号是 **agent skill / plugin 生态屠榜**：20 个上榜项目里至少 7 个直接处于 Claude Code 插件、agent skills、MCP、agent 记忆这个生态位（archify、claude-plugins-community、cursor/plugins、scientific-agent-skills、garden-skills、claude-mem、awesome-mcp-servers），再加上 FreeLLMAPI（免费模型聚合）和 Apache Maka（agent 工作台）这类基建，"给 coding agent 造配件"已经是当前开源最热的品类。其次是本地优先/隐私优先工具（OpenLogi、OpenMAIC、ai-job-search），共同卖点是数据不出本机。

## 新晋仓库（详写周增前 8）

### tt-a1i/archify —— agent 用的架构图生成技能

- **是什么**：一个 agent skill，让 coding agent 生成可验证的架构图、工作流图、时序图、数据流图，产出自包含 HTML（带动效、可导出）。4 月创建，半年 4.1 万星。
- **为什么现在火**：本周 +22,095，是第二名的近两倍。踩中了 agent skill 生态爆发的窗口，"diagram as code + agent 自动生成"直击写文档/画架构图这个高频刚需。
- **值得关注吗**：有实用价值。如果你在维护技能库，这是"技能作为独立分发物"这个趋势的标杆样本。

### freestylefly/awesome-gpt-image-2 —— GPT-Image2 提示词工程库

- **是什么**：Prompt as Code 理念的 GPT-Image2 工业级提示词引擎：530+ 逆向工程案例、20+ 模板，并已提炼成可直接复用的 Skills。中文项目。
- **为什么现在火**：+11,711。GPT-Image2 发布后的提示词需求井喷，"案例库 + 可执行模板"比散落教程好用得多。
- **值得关注吗**：图像生成重度用户直接可用；对观察"提示词资产化"方法论有参考价值。

### omacom/omarchy —— opinionated 的 Linux 发行版

- **是什么**："Beautiful, Modern & Opinionated Linux"，基于 Arch 的一站式桌面方案，装完即用、品味统一。
- **为什么现在火**：+6,382，2025 年 6 月创建已 3.6 万星，长线项目持续发酵。
- **值得关注吗**：信号意义大于实用（除非你正好想换发行版）；代表"开箱即用、有品味的桌面 Linux"这条线的持续热度。

### K-Dense-AI/scientific-agent-skills —— 科研向 agent 技能库

- **是什么**：165+ 个经过验证的科学领域 agent skills（生物信息、化学信息等），口号"把任意 AI agent 变成 AI Scientist"。
- **为什么现在火**：+6,248。agent skill 从编程场景向专业领域扩散的标志性项目。
- **值得关注吗**：做科研自动化的人直接可用；对技能库建设者来说是"垂直领域技能集"的设计参照。

### MadsLorentzen/ai-job-search —— 本机运行的 AI 求职框架

- **是什么**：基于 Claude Code 的求职申请框架：简历、cover letter、投递管理全部在本机跑，数据不上云。
- **为什么现在火**：+5,463。"local-first" + "用 agent 干脏活"两个热点叠加，求职季放大传播。
- **值得关注吗**：正在找工作的人实用；作为"agent 跑真实工作流"的案例比工具本身更有参考价值。

### THU-MAIC/OpenMAIC —— 一键多智能体课堂

- **是什么**：清华 MAIC 的开源版"多智能体交互课堂"：一键拉起沉浸式多 agent 学习体验。
- **为什么现在火**：+5,014。AI+教育赛道 + 高校背书，README 直连飞书文档，国内传播路径明显。
- **值得关注吗**：教育产品方向的人值得看；本质是把"一人一 AI 导师团"产品化的早期尝试。

### rohitg00/ai-engineering-from-scratch —— AI 工程学习资源

- **是什么**：从零学 AI 工程的课程式仓库（agents、CV 等全栈主题），"Learn it. Build it. Ship it."
- **为什么现在火**：+3,735，5.1 万总星。学习清单类仓库常青，AI 工程是当下最热的转岗方向。
- **值得关注吗**：系统自学 AI 工程的高质量入口之一。

### tashfeenahmed/freellmapi —— 34 家免费 LLM 聚合网关

- **是什么**：把 34 个免费 LLM 供应商、635 个免费端点聚合到一个 OpenAI 兼容的 `/v1` 端点，智能路由 + 故障转移，月吞吐号称 74 亿 token，密钥加密存储。
- **为什么现在火**：+3,640。免费薅模型 + 统一接口是个人开发者的硬需求。
- **值得关注吗**：个人项目和原型开发直接可用；生产环境别依赖免费配额。

## 其余新晋（一句话清单）

- **every-app/open-seo**：开源 Semrush/Ahrefs 替代，带 GSC 集成的 SEO 工具链
- **OpenCut-app/OpenCut**：开源剪映替代，8.8 万星的长跑项目
- **AprilNEA/OpenLogi**：Rust 写的罗技 Options+ 替代，本地优先外设管理
- **abi/screenshot-to-code**：截图转代码经典项目，7.6 万星常青
- **apache/maka**：Apache 孵化中的本地优先 agent 工作台
- **anthropics/claude-plugins-community**：Claude 插件社区市场（官方镜像）
- **cursor/plugins**：Cursor 插件规范与官方插件
- **p-e-w/heretic**：全自动 LLM"去审查"工具（abliteration 技术）
- **ConardLi/garden-skills**：国内开发者的 web 设计/图像生成技能集
- **thedotmack/claude-mem**：agent 跨会话持久记忆，9.2 万星
- **punkpeye/awesome-mcp-servers**：MCP server 大全，清单常青
- **google/googletest**：老牌 C++ 测试框架，常驻型上榜（+471）

## 数字速览

- 本周榜首：tt-a1i/archify（+22,095）
- 新晋 20 · 常驻 0 · 回锅 0（首周基线，下周起分类生效）
