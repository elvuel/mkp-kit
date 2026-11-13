# ContextKeys Example

此项目提供两个模式：

- keys：连接真实设备，演示 keyDown / keyUp / keyTap
- context：使用 fake transport，演示基于 CancellationToken 的超时取消与手动取消

`powershell
dotnet run --project .\examples\ContextKeys -- keys --port COM5
dotnet run --project .\examples\ContextKeys -- context
`
