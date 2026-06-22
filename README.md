# AI 洞察 · 用户小镇

这是一个可部署到 Vercel 的巴基斯坦手机用户小镇。网页公开访问，任何拿到网址的人都可以选择居民单聊，或让全镇居民一起回答问题。

## 目录

```text
api/                 Vercel Serverless API
data/processed/      居民、访谈证据和市场知识数据
lib/                 用户小镇核心逻辑
public/              Vercel 公开网页
scripts/             数据导入脚本
DEPLOY.md            Vercel 部署说明
```

## Vercel 环境变量

在 Vercel Project Settings -> Environment Variables 添加：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-chat
API_TOKEN=一个长一点的私密 token
```

`DEEPSEEK_API_KEY` 用于网页聊天。`API_TOKEN` 只用于保护外部系统接口 `/api/brain/:resident_id`。

## 部署

1. 把整个项目上传到 GitHub 私有仓库，不要只上传 `DEPLOY.md`。
2. 在 Vercel 点击 `New Project`。
3. 导入该 GitHub 仓库。
4. `Framework Preset` 选择 `Other`。
5. 添加环境变量。
6. 点击 `Deploy`。

部署完成后访问首页即可进入用户小镇。

## 检查

```text
/api/health
```

如果返回 `ok: true`，说明 API 正常。`has_deepseek_key: true` 表示 DeepSeek API Key 已经配置。
