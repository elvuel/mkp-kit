from __future__ import annotations

import argparse

from examples.common import init_sfport, log
from mkp_python import JoinOption, join


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ssid", nargs="?")
    parser.add_argument("password", nargs="?")
    args = parser.parse_args()
    if (args.ssid is None) != (args.password is None):
        raise SystemExit("usage: python -m examples.directives.join [ssid password]")
    opt = JoinOption(ssid=args.ssid or "", password=args.password or "") if args.ssid else None
    sfport = init_sfport()
    try:
        log(join(sfport, opt, timeout=30.0))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
