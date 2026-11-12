from __future__ import annotations

from examples.common import init_sfport, log
from mkp_python import astop


def main() -> None:
    sfport = init_sfport()
    try:
        astop(sfport)
        log("done")
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
