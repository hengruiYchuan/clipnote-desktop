# 未定稿

面向非技术创作者的 AI 产品驻留计划。当前纵向切片包含品牌首页、七页选题访谈和结构化选题诊断。

## 本地运行

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

打开 `http://127.0.0.1:3000`。默认 `AI_PROVIDER=demo`，不需要 API 密钥，页面会明确标记演示诊断。

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
