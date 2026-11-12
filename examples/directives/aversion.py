from __future__ import annotations

from examples.common import init_sfport, log
from mkp_python import aversion


def main() -> None:
    sfport = init_sfport()
    try:
        log(aversion(sfport))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
