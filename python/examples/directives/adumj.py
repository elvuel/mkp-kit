from __future__ import annotations

import argparse

from examples.common import init_sfport, log
from mkp_python.sdk import adumj


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("log_path")
    args = parser.parse_args()
    sfport = init_sfport()
    try:
        log(adumj(sfport, args.log_path, timeout=30.0))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
