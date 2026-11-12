from __future__ import annotations

import time

from examples.common import init_sfport
from mkp_python import key_down, key_tap, key_up


def main() -> None:
    sfport = init_sfport()
    try:
        print("sleep 5s")
        time.sleep(5)
        print("--start--")

        key_down(sfport, "w")
        key_down(sfport, "d")
        time.sleep(3)
        key_up(sfport, "d")
        key_up(sfport, "w")

        key_down(sfport, "alt")
        key_down(sfport, "n")
        time.sleep(0.2)
        key_up(sfport, "n")
        key_up(sfport, "alt")
        time.sleep(3)

        key_tap(sfport, "esc")
        time.sleep(3)

        key_down(sfport, "MOD_LALT")
        key_down(sfport, "q")
        time.sleep(0.6)
        key_up(sfport, "q")
        key_up(sfport, "MOD_LALT")

        time.sleep(3)
        key_down(sfport, "space")
        time.sleep(3)
        key_up(sfport, "space")
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
