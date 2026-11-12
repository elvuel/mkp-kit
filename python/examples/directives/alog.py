from __future__ import annotations

import argparse

from examples.common import init_sfport, log
from mkp_python import alog


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("log_name", nargs="?", default="subdir1/test")
    args = parser.parse_args()
    sfport = init_sfport()
    try:
        log(alog(sfport, args.log_name))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
