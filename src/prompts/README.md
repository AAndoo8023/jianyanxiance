# Prompt 文档说明

本目录存放平台全部 LLM Prompt，运行时由 `src/lib/prompts.ts` 加载并替换占位符。

## 文件一览

| 文件 | 角色 | 调用时机 |
|------|------|----------|
| `system-instruction.md` | 主报告 System Prompt | 生成报告（流式/非流式） |
| `user-report.template.md` | 主报告 User Prompt 模板 | 生成报告 |
| `topic-validation.md` | 选题审核 System Prompt | 用户提交选题后 |
| `topic-validation-user.template.md` | 选题审核 User Prompt 模板 | 用户提交选题后 |
| `follow-up.md` | 后续建议 System Prompt | 主报告完成后第二轮调用 |
| `follow-up-user.template.md` | 后续建议 User Prompt 模板 | 主报告完成后 |

## 占位符

模板文件（`*.template.md`）及 `system-instruction.md` 支持 `{{变量名}}` 占位符：

| 占位符 | 来源 | 说明 |
|--------|------|------|
| `{{MARK_ANALYSIS}}` 等 | `src/lib/parseReport.ts` | 输出分区标记，**须与解析逻辑保持一致** |
| `{{TOPIC}}` | 用户输入 | 选题与初步想法 |
| `{{PARTY}}` `{{TITLE}}` 等 | 用户表单 | 报送人信息，空则填默认占位符 |
| `{{FINAL_DRAFT}}` | 生成结果 | 终稿全文（截断至 12000 字） |

修改 `parseReport.ts` 中的标记常量时，无需改 `.md` 文件——加载时会自动注入。

## 修改建议

1. **改撰写逻辑**：优先编辑 `system-instruction.md`
2. **改选题标准**：编辑 `topic-validation.md`
3. **改后续建议角度**：编辑 `follow-up.md`
4. **改单次请求附加上下文**：编辑对应的 `*.template.md`

修改后保存，开发模式下 Vite 热更新即可生效（需刷新页面重新触发请求）。

## 方法论索引（罗道全经验）

| 要点 | 所在文件 | 位置 |
|------|----------|------|
| 选题决定成败、小切口 | `system-instruction.md` | 选题与类型 |
| 三大类型（建议/监督/时事） | `system-instruction.md` | 选题与类型 |
| 精华靠前、三段论 | `system-instruction.md` | Format Rules |
| 800～2000 字 | `system-instruction.md` | Format Rules |
| 常见误区 | `system-instruction.md` | 常见误区 |
| 选题审核标准 | `topic-validation.md` | 全文 |

## 注意事项

- `.md` 中的 Markdown 语法会原样发给 LLM，请谨慎使用标题层级
- 终稿输出仍须遵守「禁用 Markdown 列表」等规则——这些约束写在 `system-instruction.md` 的 Format Rules 中
- `src/lib/llm.ts` 仅负责 API 调用，不再内嵌 Prompt 正文
