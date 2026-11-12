from __future__ import annotations

import argparse

from examples.common import init_sfport, log
from mkp_python import WifiAutoOption, wifi_auto


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("state", nargs="?", choices=["0", "1"])
    args = parser.parse_args()
    opt = WifiAutoOption(state=args.state) if args.state is not None else None
    sfport = init_sfport()
    try:
        log(wifi_auto(sfport, opt, timeout=30.0))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
