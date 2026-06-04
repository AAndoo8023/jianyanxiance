# Prompt 文档说明

本目录存放平台全部 LLM Prompt，方法论来源：**proposal-writing 社情民意信息撰写技能**。

运行时由 `src/lib/prompts.ts` 加载并替换占位符。

## 文件一览

| 文件 | 角色 | 调用时机 |
|------|------|----------|
| `system-instruction.md` | 主报告 System Prompt | 生成报告（流式/非流式） |
| `user-report.template.md` | 主报告 User Prompt 模板 | 生成报告 |
| `topic-validation.md` | 选题审核 System Prompt | 用户提交选题后 |
| `topic-validation-user.template.md` | 选题审核 User Prompt 模板 | 用户提交选题后 |
| `follow-up.md` | 撰写人调研备忘 System Prompt | 主报告完成后第二轮调用 |
| `follow-up-user.template.md` | 调研备忘 User Prompt 模板 | 主报告完成后 |

## 方法论索引（proposal-writing 技能）

| 要点 | 所在文件 |
|------|----------|
| 核心结论（小切口、能驾驭、有价值） | `system-instruction.md` |
| 撰写意义与价值 | `system-instruction.md` |
| 选题三大原则 + 三大类型 | `system-instruction.md`、`topic-validation.md` |
| 三段论（问题—分析—建议） | `system-instruction.md` |
| 倒金字塔 / 白菜炖肉 | `system-instruction.md` |
| 800～2000 字、标题技巧 | `system-instruction.md` |
| 常见误区（内容/表达/思维） | `system-instruction.md` |
| 数据纪律、用语规范、终稿禁止项 | `system-instruction.md` |
| 参考示例 | `system-instruction.md` |
| 选题审核标准 | `topic-validation.md` |
| 撰写人调研备忘视角 | `follow-up.md` |

## 占位符

| 占位符 | 来源 | 说明 |
|--------|------|------|
| `{{MARK_ANALYSIS}}` 等 | `src/lib/parseReport.ts` | 输出分区标记，须与解析逻辑一致 |
| `{{TOPIC}}` | 用户输入 | 选题与初步想法 |
| `{{PARTY}}` 等 | 用户表单 | 报送人信息 |
| `{{FINAL_DRAFT}}` | 生成结果 | 终稿全文 |

## 修改建议

1. **改撰写逻辑**：编辑 `system-instruction.md`（与 proposal-writing 技能保持同步）
2. **改选题标准**：编辑 `topic-validation.md`
3. **改调研备忘**：编辑 `follow-up.md`
4. **改单次请求上下文**：编辑对应的 `*.template.md`
