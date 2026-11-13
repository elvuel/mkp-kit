# MKP .NET Directive Examples

[Examples 索引](../README.md) | [.NET README](../../README.md) | [.NET 指令补充](../../directives.md)

---

`.NET` 版 directive 示例集中在一个项目里，通过子命令区分不同指令。

## 运行方式

以下命令相对于 `mkp-kit/dotnet/`：

```powershell
dotnet run --project .\examples\Directives -- sn --port COM5
dotnet run --project .\examples\Directives -- list_dir /eMMC/applog --port COM5
dotnet run --project .\examples\Directives -- ahttpbase http://192.168.1.10:8000 --port COM5
dotnet run --project .\examples\Directives -- ajson2log D:\tmp\demo.json /eMMC/applog/demo.log --port COM5
```

通用帮助：

```powershell
dotnet run --project .\examples\Directives -- --help
dotnet run --project .\examples\Directives -- atime --help
```

## 当前支持的子命令

- `sn`
- `aversion`
- `alive`
- `list_dir`
- `clean_dir`
- `delete_file`
- `join`
- `wifi_auto`
- `ahttpbase`
- `ainsp`
- `atime`
- `adumj`
- `aget`
- `aput`
- `ajson2log`
- `alog`
- `astop`
- `acancel`
- `aplay`

## 约定

- 查询类 directive 通常直接打印强类型结果或 JSON 结构
- `aplay` 会返回“已启动”样式的本地包装结果，而不是等待设备同步回放完成
- 真实 directive 分发逻辑位于 `Program.cs`

## 注意事项

- 若新增或修改 directive 子命令，请同步更新本文件与 `../../directives.md`
- 更完整的 `.NET` directive API / parser / return type 说明见 `../../directives.md`

