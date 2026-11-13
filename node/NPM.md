# npm 发布说明

本文档说明如何从 `mkp-kit/node` 发布 `@elvuel/mkp-node` 到 npm。

当前仓库状态：

- 包元数据位于 `package.json`
- npm 页面默认使用 `README.md` 作为包说明
- GitHub Actions 工作流位于 `.github/workflows/publish-node.yml`
- 工作流在 `main` 分支下仅当 `node/` 目录或该 workflow 文件变更时自动执行构建校验
- 真正的 npm 发布仅在手动触发 workflow 时执行

## 1. 发布前检查

先确认以下信息已正确更新：

- `package.json` 中的 `version`
- `package.json` 中的 `name`
- `package.json` 中的 `repository` / `homepage` / `bugs`
- `README.md` 是否适合作为 npm 页面说明
- `dist/` 入口、`bin` 命令和 `files` 列表是否与实际构建产物一致

每次正式发布前，都应递增版本号，避免与 npm 上的历史版本冲突。

## 2. 本地构建与检查

在仓库根目录执行：

```powershell
cd node
npm ci
npm run build
npm test
npm pack --dry-run
```

说明：

- `npm run build` 会编译 TypeScript 到 `dist/`
- `npm test` 会执行构建后的 Node 测试
- `npm pack --dry-run` 会显示最终将被打进 npm tarball 的文件

## 3. 手动发布到 npm

如果采用本地手动发布方式：

```powershell
cd node
npm login
npm publish --access public
```

对于当前 scoped package `@elvuel/mkp-node`，首发公开包时应显式带上 `--access public`。

## 4. GitHub Actions 发布流程

工作流文件：

- `.github/workflows/publish-node.yml`

当前 workflow 设计如下：

### 自动触发部分

以下情况会自动执行 **构建与检查**，但不会真正发布：

- 向 `main` 分支推送且命中 `node/**`
- 向 `main` 分支推送且修改了 `.github/workflows/publish-node.yml`

该阶段会执行：

- 安装依赖
- 构建 `dist/`
- 运行测试
- 执行 `npm pack --dry-run`

### 手动发布部分

真正发布到 npm 的 `publish` job 只在 `workflow_dispatch` 时运行。

也就是说：

- 普通 push 不会自动把包发到 npm
- 只有在 GitHub Actions 页面手动触发该 workflow 时，才会执行发布步骤

## 5. 配置 npm Trusted Publishing

推荐使用 GitHub Actions + npm Trusted Publishing，而不是长期保存 npm token。

建议的配置步骤：

1. 进入 npm 包后台
2. 为 `@elvuel/mkp-node` 配置 GitHub Trusted Publisher
3. 绑定仓库 `elvuel/mkp-kit`
4. 指定 workflow 文件 `.github/workflows/publish-node.yml`
5. 如使用 GitHub environment，则保持与 workflow 中的环境名一致

当前 workflow 已为发布 job 配置：

- `permissions.id-token: write`
- `environment: npm`

这两项是后续接入 Trusted Publishing 的关键前提。

## 6. 推荐发布流程

建议每次正式发布都按以下顺序进行：

1. 修改 `node/package.json` 中的版本号
2. 提交并推送代码
3. 等待 GitHub Actions 中的构建检查通过
4. 在 GitHub Actions 中手动触发 `publish-node`
5. 发布完成后，再验证 npm 页面与安装结果

## 7. 发布后验证

发布完成后，至少检查：

- npm 页面中的包描述是否正确
- `README.md` 是否渲染正常
- 包名 `@elvuel/mkp-node` 是否可见
- bin 命令是否正确生成
- 在干净环境中能否正常安装并运行 CLI

例如：

```powershell
npm install @elvuel/mkp-node
npx mkp --help
npx mkp-server --help
```

## 8. 常见调整点

如果后续需要进一步完善 npm 展示或打包内容，可以继续调整：

- `package.json` 的 `keywords`
- `repository` / `homepage` / `bugs`
- `files`
- `README.md` 的首屏说明和示例

如果后续要改成 tag 驱动发布，也可以在当前 workflow 基础上再调整触发条件。