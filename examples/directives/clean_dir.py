from __future__ import annotations

import argparse

from examples.common import init_sfport, log
from mkp_python import clean_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default="/eMMC/applog/subdir1")
    args = parser.parse_args()
    sfport = init_sfport()
    try:
        clean_dir(sfport, args.path)
        log("succeed")
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
