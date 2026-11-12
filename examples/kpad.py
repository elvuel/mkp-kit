from __future__ import annotations

import time

from examples.common import init_sfport
from mkp_python import KpadOption


def tap(sfport, *keys: str) -> None:
    sfport.keypad(
        KpadOption()
        .with_keys(list(keys))
        .with_auto_release()
        .with_sync_ignore_output(True)
    )


def main() -> None:
    sfport = init_sfport()
    try:
        print("3s 后开始输出文本: Hello MKP!")
        time.sleep(3)

        sequence = [
            ["MOD_LSHIFT", "H"],
            ["E"],
            ["L"],
            ["L"],
            ["O"],
            ["SPACE"],
            ["MOD_LSHIFT", "M"],
            ["MOD_LSHIFT", "K"],
            ["MOD_LSHIFT", "P"],
            ["MOD_LSHIFT", "1"],
        ]
        for keys in sequence:
            tap(sfport, *keys)

        print("kpad 示例完成")
    finally:
        sfport.close()


if __name__ == "__main__":
    main()