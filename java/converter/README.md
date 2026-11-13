# Java Converter

`java/converter/` 是 `mkp-kit/java/` 下的双向 `.log <-> .json` 转换工具模块。

它对齐了其它语言版本的 host-side converter 语义，用于在：

- MKP binary applog：`.log`
- MKP action envelope：`.json`

之间进行双向转换。

## 作用

当前 Java converter 覆盖：

- `.log -> .json`
- `.json -> .log`
- `MKv1` / `MKv2` 头读取与写回
- 鼠标 5-byte payload 编解码
- 键盘 8-byte report 编解码
- `MouseMove` / `MouseDown` / `MouseUp` / `Wheel`
- `KeyDown` / `KeyUp`
- 非递增时间戳的 `delta=0` 钳制
- 写出时自动补 stop trailer

## Package

- converter 包：`io.github.elvuel.mkpkit.java.converter`

## 构建

在 `mkp-kit/java/` 目录执行：

```powershell
.\gradlew.bat :converter:build
```

## 用法

显示帮助：

```powershell
.\gradlew.bat :converter:run --args="--help"
```

基本形式：

```powershell
.\gradlew.bat :converter:run --args="-f <input> [-o <output>]"
```

方向由输入文件扩展名决定：

| `-f` 扩展名 | 转换方向 | 默认输出扩展名 |
|---|---|---|
| `.log` | `log -> json` | `.json` |
| `.json` | `json -> log` | `.log` |

如果未传 `-o`，输出路径默认与输入同名，仅替换扩展名。

如果显式传了 `-o` 但没带目标扩展名，Java converter 会自动补上正确扩展名。

## 示例

```powershell
# log -> json
.\gradlew.bat :converter:run --args="-f .\demo.log"

# json -> log
.\gradlew.bat :converter:run --args="-f .\demo.json"

# 指定输出目录或输出前缀
.\gradlew.bat :converter:run --args="-f .\demo.log -o .\artifact\out"
# -> 实际写出 .\artifact\out.json
```

## JSON 约定

JSON envelope 采用如下顶层结构：

- `format`
- `version`
- `meta`
- `events`

其中：

- `version` 当前兼容 `MKv1` 与 `MKv2`
- `meta` 当前包含 `width`、`height`、`startX`、`startY`
- `events` 中每个元素必须是**仅带一个事件名 key** 的对象

支持的事件名：

- `MouseMove`
- `MouseDown`
- `MouseUp`
- `Wheel`
- `KeyDown`
- `KeyUp`

## 当前实现说明

- Java converter 复用了 `java/core/` 中的 `Keycodes` 作为键盘键名 / modifier 映射来源
- `json -> log` 时按原始事件顺序消费 JSON，不会因为时间戳回退而重排事件
- 如果 JSON 中出现未知按键名、未知鼠标按钮、或超过 6 个同时按下普通键，会直接报错退出

## 相关文件

| 文件 | 作用 |
|---|---|
| `src/main/java/io/github/elvuel/mkpkit/java/converter/ConverterCore.java` | codec 与转换状态机 |
| `src/main/java/io/github/elvuel/mkpkit/java/converter/ConverterCli.java` | 命令行参数解析与执行 |
| `src/main/java/io/github/elvuel/mkpkit/java/converter/Main.java` | CLI 入口 |
