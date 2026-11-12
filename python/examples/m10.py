from __future__ import annotations

import time

from examples.common import init_sfport
from mkp_python import M10Option


def main() -> None:
    sfport = init_sfport()
    try:
        print("3s 后开始移动鼠标：先向左 400，再向上 400")
        time.sleep(3)

        sfport.mouse10(M10Option().set_x(-400).with_sync_ignore_output(True))
        sfport.mouse10(M10Option().set_y(-400).with_sync_ignore_output(True))

        print("m10 示例完成")
    finally:
        sfport.close()


if __name__ == "__main__":
    main()