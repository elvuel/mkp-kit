from __future__ import annotations

import argparse

from examples.common import init_sfport, log
from mkp_python import list_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default="/eMMC")
    args = parser.parse_args()
    sfport = init_sfport()
    try:
        log(list_dir(sfport, args.path))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
