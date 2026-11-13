# MKP .NET Examples

[主 README](../README.md) | [README English](../README.en.md) | [指令补充](../directives.md) | [.NET 指令补充](../directives.md)

---

本文档只说明 `mkp-kit/dotnet/examples/` 下的 `.NET` 示例项目组织与运行方式。

## 目录

| 路径 | 作用 |
|---|---|
| `Common/` | 共享 `--port` 参数解析、输出辅助与端口初始化 |
| `Directives/` | 统一的 directive runner，使用子命令承载多条指令示例 |
| `M10/` | 独立鼠标示例 |
| `Kpad/` | 独立键盘示例 |
| `ContextKeys/` | 组合示例，承载 `keys` 与 `context` 两种模式 |

## 运行约定

- 以下命令均相对于 `mkp-kit/dotnet/`
- 除 `context` 模式外，示例通常支持 `--port COMx`
- directive 示例统一通过 `examples/Directives/` 项目上的子命令运行

## 快速示例

```powershell
dotnet run --project .\examples\Directives -- sn --port COM5
dotnet run --project .\examples\Directives -- list_dir /eMMC/applog --port COM5
dotnet run --project .\examples\M10 -- --port COM5
dotnet run --project .\examples\Kpad -- --port COM5
dotnet run --project .\examples\ContextKeys -- keys --port COM5
dotnet run --project .\examples\ContextKeys -- context
```

## 示例索引

| 示例 | 项目路径 | 运行命令 | 说明 |
|---|---|---|---|
| `Directives` | `examples/Directives/` | `dotnet run --project .\examples\Directives -- sn --port COM5` | 聚合 `sn`、`list_dir`、`atime`、`ajson2log`、`alog`、`aplay` 等 directive 示例 |
| `M10` | `examples/M10/` | `dotnet run --project .\examples\M10 -- --port COM5` | 先向左移动 `400`，再向上移动 `400` |
| `Kpad` | `examples/Kpad/` | `dotnet run --project .\examples\Kpad -- --port COM5` | 输出 `Hello MKP!` |
| `ContextKeys` | `examples/ContextKeys/` | `dotnet run --project .\examples\ContextKeys -- keys --port COM5` | 演示 `KeyTapAsync`、`KeyDownAsync`、`KeyUpAsync`、释放与上下文取消 |

## 注意事项

- 若共享 directive 语义发生变化，应优先更新根文档 `../directives.md`
- 若新增 `.NET` 示例，请同步更新 `../README.md`、`../directives.md` 与本文件
- `examples/Directives/README.md` 只描述 directive runner 本身；更完整的 API / parser 说明见 `../directives.md`

