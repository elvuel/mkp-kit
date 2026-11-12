from __future__ import annotations

import argparse

from examples.common import init_sfport, log
from mkp_python import AJSON2LogOption, ajson2log


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("jsonpath")
    parser.add_argument("outputlogpath")
    args = parser.parse_args()
    sfport = init_sfport()
    try:
        log(ajson2log(sfport, AJSON2LogOption(jsonpath=args.jsonpath, outputlogpath=args.outputlogpath), timeout=30.0))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
