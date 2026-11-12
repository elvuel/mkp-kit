from __future__ import annotations

from examples.common import init_sfport, log
from mkp_python import alive


def main() -> None:
    sfport = init_sfport()
    try:
        log(alive(sfport))
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
