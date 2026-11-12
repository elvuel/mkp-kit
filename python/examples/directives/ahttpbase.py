from __future__ import annotations

import argparse

from examples.common import init_sfport, log
from mkp_python import AHTTPBaseOption, ahttpbase


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("url", nargs="?")
    args = parser.parse_args()
    opt = AHTTPBaseOption(url=args.url or "") if args.url else None
    sfport = init_sfport()
    try:
        log(ahttpbase(sfport, opt, timeout=10.0))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
