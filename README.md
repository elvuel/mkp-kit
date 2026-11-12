# MKP Kit

中文 | [English](./README.en.md)

---

`mkp-kit` 是将 `mkp-go`、`mkp-python`、`mkp-rust` 合并后的 monorepo。

## 仓库结构

- `go/`：Go 版 SDK / helper / controller / examples / directives 文档
- `python/`：Python 版 SDK / server / CLI / converter / file server / examples / directives 文档
- `rust/`：Rust 版 SDK / server / CLI / converter / file server / examples / directives 文档

## 目录映射

- 原 `mkp-go` -> `go/`
- 原 `mkp-python` -> `python/`
- 原 `mkp-rust` -> `rust/`

## 语言入口

- Go：`go/README.md`
- Python：`python/README.md`
- Rust：`rust/README.md`

## 维护约定

- 各语言继续保留各自独立的包 / 模块 / crate 结构
- 与语言实现强相关的文档、示例、测试，继续放在各自子目录
- 跨语言的总体说明、发布策略、仓库级规范，优先放在仓库根目录

## 历史说明

当前合并方式保留了三边 Git 历史，并通过 subtree 方式导入：

- `go/` <- `mkp-go`
- `python/` <- `mkp-python`
- `rust/` <- `mkp-rust`
