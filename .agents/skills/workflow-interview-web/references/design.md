# 单页设计约束

页面由 `scripts/web/index.html`、`style.css`、`app.mjs` 组成，零第三方依赖。结构对照来自该 issue
确认版 `2-prototype/mock.html`，不是像素规范。

## 固定信息结构

- 顶栏：技能身份、三阶段面包屑、访谈/契约视图切换、开放歧义数、连接状态。
- 访谈主列：只读任务陈述、按 round 累积的提问区、默认区、确认区、附件 iframe、提交/锁定态。
- 右栏：已锁定结论与来源 round。
- 契约视图：分节正文、依据溯源、确认与需修改自由文本。

ask 选项保留三段信息（覆盖、好处、代价）与 pct/推荐标记。Other 与普通选项互斥。默认项
不操作即 accept；confirm 必须明确确认或翻掉。提交后整个 round 只读。

## 本地恢复与断线

未提交答案以 slug+round 为键写 localStorage；刷新继续编辑，成功提交后删除草稿。网络失败时
把整轮 payload 写本机离线队列，WS 重连后顺序补发；409 视为已被首次提交吸收。WS 重连从
500ms 指数退避，上限 30s。

附件 iframe 使用空 sandbox，不能执行附件脚本。server 同时给附件收紧 CSP；附件只用于查看
确认版对照物。

## 中文与视觉

普通 UI 文案使用中文，Provider/Prompt/Skill、路径、命令、字段与技术标识保留原样。视觉采用
暖纸背景、深墨文本、陶橙动作色与鼠尾草绿确认色；衬线标题和无衬线正文构成层级。移动端把
双栏折成单栏，不能隐藏问题、代价、已锁定结论或契约确认。

## 来源与许可证

WS 基础形态与本地视觉 companion 的早期参考来自 Jesse Vincent 的 Superpowers 项目；许可
文本见 [SUPERPOWERS-LICENSE.txt](SUPERPOWERS-LICENSE.txt)。当前 runtime 已改写为 `.mjs`、
声明式 state 与双向 submission 协议；来源声明不表示运行时依赖或要求安装 Superpowers。
