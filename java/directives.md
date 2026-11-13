# Java Directives

本文件描述 `java/` 当前已经对齐的 directive 封装与外层暴露状态。

## 已实现

- `sn`
- `alive`
- `aversion`
- `atime`
- `ainsp`
- `list_dir`
- `clean_dir`
- `delete_file`
- `join`
- `wifi_auto`
- `ahttpbase`
- `adumj`
- `aget`
- `aput`
- `ajson2log`
- `alog`
- `astop`
- `acancel`
- `aplay`
- `m10`
- `kpad`

## 当前状态

- Java 已对齐核心 directive 行为与解析边界。
- Java 已补上 `cli`、`client`、`server`、`file-server`、`converter` 五层外部暴露。
