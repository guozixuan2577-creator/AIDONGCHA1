# Vercel 上线说明

这个文件只是部署说明，不是 Vercel 的部署入口。Vercel 需要导入整个 GitHub 仓库，仓库里至少要包含 `api/`、`data/`、`lib/`、`public/`、`package.json` 和 `vercel.json`。

## 1. 上传到 GitHub

把整个项目文件夹上传到你的 GitHub 私有仓库，而不是只上传 `DEPLOY.md`。

## 2. 在 Vercel 导入项目

1. 打开 Vercel Dashboard。
2. 点击 `New Project`。
3. 选择你的 GitHub 仓库。
4. `Framework Preset` 选择 `Other`。
5. 添加环境变量。
6. 点击 `Deploy`。

## 3. 环境变量

在 Vercel Project Settings -> Environment Variables 添加：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-chat
API_TOKEN=一个长一点的私密 token
```

不要添加 `APP_PASSWORD`。网页访问已经开放，任何拿到网址的人都可以进入用户小镇并提问。

`API_TOKEN` 只用于保护外部系统调用接口 `/api/brain/:resident_id`，普通网页聊天不需要输入密码。

## 4. 线上检查

部署完成后，打开 Vercel 给出的网址。

检查：

```text
/api/health
```

应该返回 `ok: true`。`has_deepseek_key: true` 表示 DeepSeek API Key 已配置。
