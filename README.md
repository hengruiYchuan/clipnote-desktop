# 未定稿

面向非技术创作者的 AI 产品驻留计划。当前纵向切片已打通品牌首页、七页选题访谈、结构化诊断、Day 1–7 创作流程、公开授权和第 001 期数字特刊。

## 本地运行

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

打开 `http://127.0.0.1:3000`。默认 `AI_PROVIDER=demo`，不需要 API 密钥，页面会明确标记演示诊断。

完整演示路径：

```text
/apply → /diagnosis → /studio/day-1 … /studio/day-7 → /publication/001
```

申请、诊断和七日稿件保存在当前标签页的 `sessionStorage` 中，可以刷新恢复。Day 3 与 Day 6 只记录用户从现实反馈者处获得的内容；Day 7 明确授权后，作品说明才会出现在本地特刊中。当前演示不包含账户、数据库、支付、多人协作或真实部署发布。

## OpenAI 诊断

在 `.env.local` 中设置：

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_DIAGNOSIS_MODEL=gpt-5.6-terra
```

业务和页面只依赖 `DiagnosisProvider` 接口。OpenAI 适配器使用 Responses API 与 Zod Structured Outputs；供应商特有参数不会进入诊断业务层。

官方参考：[Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) · [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) · [模型选择](https://developers.openai.com/api/docs/guides/latest-model)

## 验证

```powershell
npm run check
npm run test:e2e
npm run build
```
