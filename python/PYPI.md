# PyPI 发布说明

本文档说明如何从 `mkp-kit/python` 发布 `mkp-python` 到 PyPI。

当前仓库状态：

- 包元数据位于 `pyproject.toml`
- PyPI 长说明来源为 `README.en.md`
- GitHub Actions 工作流位于 `.github/workflows/publish-python.yml`
- 工作流在 `main` 分支下仅当 `python/` 目录或该 workflow 文件变更时自动执行构建校验
- 真正的 PyPI 发布仅在手动触发 workflow 时执行

## 1. 发布前检查

先确认以下信息已正确更新：

- `pyproject.toml` 中的 `version`
- `pyproject.toml` 中的 `authors`
- `pyproject.toml` 中的 `project.urls`
- `README.en.md` 中的英文说明是否适合作为 PyPI 首页展示
- 代码和示例是否已完成本次准备发布所需的验证

每次正式发布前，都应递增版本号，避免与 PyPI 上的历史版本冲突。

## 2. 本地构建与检查

在仓库根目录执行：

```powershell
cd python
py -m pip install --upgrade build twine
py -m build
py -m twine check dist/*
```

说明：

- `py -m build` 会生成 `dist/` 下的源码包和 wheel
- `py -m twine check dist/*` 会检查长说明渲染等基础问题

如果构建完成后只是做本地验证，可在确认结果后清理这些临时产物：

```powershell
Remove-Item -Recurse -Force dist, build, src\mkp_python.egg-info
```

## 3. 手动上传到 TestPyPI（推荐先做）

如果你想先演练一遍发布流程，可以先上传到 TestPyPI：

```powershell
cd python
py -m twine upload --repository testpypi dist/*
```

上传后可在一个干净环境里做安装验证。

## 4. 手动上传到正式 PyPI

如果采用手动上传方式，在本地构建并检查通过后执行：

```powershell
cd python
py -m twine upload dist/*
```

如果使用 PyPI API Token：

- 用户名使用 `__token__`
- 密码使用完整 token

## 5. GitHub Actions 发布流程

工作流文件：

- `.github/workflows/publish-python.yml`

当前 workflow 设计如下：

### 自动触发部分

以下情况会自动执行 **构建与检查**，但不会真正发布：

- 向 `main` 分支推送且命中 `python/**`
- 向 `main` 分支推送且修改了 `.github/workflows/publish-python.yml`

该阶段会执行：

- 安装 `build` 和 `twine`
- 构建 `dist/`
- 执行 `twine check`
- 上传构建产物为 workflow artifact

### 手动发布部分

真正发布到 PyPI 的 `publish` job 只在 `workflow_dispatch` 时运行。

也就是说：

- 普通 push 不会自动把包发到 PyPI
- 只有在 GitHub Actions 页面手动触发该 workflow 时，才会执行发布步骤

## 6. 配置 PyPI Trusted Publishing

推荐使用 GitHub Actions + PyPI Trusted Publishing，而不是长期保存本地上传凭据。

建议的配置步骤：

1. 进入 PyPI 项目后台
2. 为 `mkp-python` 配置 GitHub Trusted Publisher
3. 绑定仓库 `elvuel/mkp-kit`
4. 指定 workflow 文件 `.github/workflows/publish-python.yml`
5. 如使用 GitHub environment，则保持与 workflow 中的 `pypi` 一致

当前 workflow 已为发布 job 配置：

- `permissions.id-token: write`
- `environment: pypi`

这两项是后续接入 Trusted Publishing 的关键前提。

## 7. 推荐发布流程

建议每次正式发布都按以下顺序进行：

1. 修改 `python/pyproject.toml` 中的版本号
2. 提交并推送代码
3. 等待 GitHub Actions 中的构建检查通过
4. 如有需要，先上传 TestPyPI 做验证
5. 在 GitHub Actions 中手动触发 `publish-python`
6. 发布完成后，再验证 PyPI 页面与安装结果

## 8. 发布后验证

发布完成后，至少检查：

- PyPI 页面中的项目描述是否正确
- `README.en.md` 是否渲染正常
- 包名 `mkp-python` 是否可见
- console scripts 是否正确生成
- 在干净环境中能否正常安装并导入

例如：

```powershell
py -m pip install mkp-python
py -c "import mkp_python; print(mkp_python.__file__)"
mkp --help
```

## 9. 常见调整点

如果后续需要进一步完善 PyPI 展示，可以继续调整：

- `pyproject.toml` 的 `classifiers`
- `keywords`
- `project.urls`
- `README.en.md` 的首屏说明和示例

如果后续要改成 tag 驱动发布，也可以在当前 workflow 基础上再调整触发条件。