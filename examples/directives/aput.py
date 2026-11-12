from __future__ import annotations

import argparse

from examples.common import init_sfport, log
from mkp_python.models import APutOption
from mkp_python.sdk import adownload_from_mkp


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("filepath")
    args = parser.parse_args()
    sfport = init_sfport()
    try:
        log(adownload_from_mkp(sfport, APutOption(filepath=args.filepath), timeout=30.0))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
