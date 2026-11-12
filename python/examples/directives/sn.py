from __future__ import annotations

from examples.common import init_sfport, log
from mkp_python import device_sn


def main() -> None:
    sfport = init_sfport()
    try:
        log(device_sn(sfport))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
