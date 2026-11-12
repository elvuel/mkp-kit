from __future__ import annotations

import argparse

from examples.common import init_sfport, log
from mkp_python import ainspect


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default="/eMMC/applog/uuu2.log")
    args = parser.parse_args()
    sfport = init_sfport()
    try:
        log(ainspect(sfport, args.path))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
