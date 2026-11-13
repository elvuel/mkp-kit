# Java Examples

在 `java/` 目录执行这些任务：

- `m10` dry-run：`.\gradlew.bat :examples:runM10`
- `kpad` dry-run：`.\gradlew.bat :examples:runKpad`
- `m10` device：设置 `MKP_SERIAL_PORT=COMx` 后执行 `.\gradlew.bat :examples:runM10Device`
- `kpad` device：设置 `MKP_SERIAL_PORT=COMx` 后执行 `.\gradlew.bat :examples:runKpadDevice`
- `sn`：`.\gradlew.bat :examples:runSn`
- `alive`：`.\gradlew.bat :examples:runAlive`
- `aversion`：`.\gradlew.bat :examples:runAversion`
- `atime`：`.\gradlew.bat :examples:runAtime --args="/eMMC/applog/spike.log"`
- `ainsp`：`.\gradlew.bat :examples:runAinsp --args="/eMMC/applog/demo.log"`
- `list_dir`：`.\gradlew.bat :examples:runListDir --args="/eMMC/applog"`
- `clean_dir`：`.\gradlew.bat :examples:runCleanDir --args="/eMMC/applog/subdir1"`
- `delete_file`：`.\gradlew.bat :examples:runDeleteFile --args="/eMMC/applog/demo.log"`
- `join`：`.\gradlew.bat :examples:runJoin --args="<ssid> <password>"`
- `wifi_auto`：`.\gradlew.bat :examples:runWifiAuto --args="1"`
- `ahttpbase`：`.\gradlew.bat :examples:runAhttpbase --args="http://127.0.0.1:8080"`
- `adumj`：`.\gradlew.bat :examples:runAdumj --args="/eMMC/applog/demo.log"`
- `aget`：`.\gradlew.bat :examples:runAget --args="/tmp/demo.txt"`
- `aput`：`.\gradlew.bat :examples:runAput --args="/eMMC/applog/demo.log"`
- `ajson2log`：`.\gradlew.bat :examples:runAjson2log --args="demo.json /eMMC/applog/demo.log"`
- `alog`：`.\gradlew.bat :examples:runAlog --args="subdir1/test"`
- `astop`：`.\gradlew.bat :examples:runAstop`
- `acancel`：`.\gradlew.bat :examples:runAcancel`
- `aplay`：`.\gradlew.bat :examples:runAplay --args="demo -1"`
