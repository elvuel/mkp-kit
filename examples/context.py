from __future__ import annotations

import threading
import time

from examples.common import init_sfport, log
from mkp_python import DirectiveTimeoutError, alog, astop


def run_timeout_case(sfport, log_name: str) -> None:
    try:
        result = alog(sfport, log_name, timeout=0.001)
        print(f"result={result!r}")
    except DirectiveTimeoutError as exc:
        print(f"timeout error={exc}")
        print("is timeout: True")


def run_manual_stop_case(sfport, log_name: str) -> None:
    result: dict[str, object] = {}

    def worker() -> None:
        try:
            result["value"] = alog(sfport, log_name, timeout=30.0)
        except Exception as exc:
            result["error"] = exc

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    time.sleep(0.3)
    stop_result = astop(sfport)
    thread.join(timeout=5.0)
    print(f"stop_result={stop_result!r}")
    log(result)


def main() -> None:
    sfport = init_sfport()
    try:
        log_name = "mkpdemo/demo"
        print("=== case 1: timeout ===")
        run_timeout_case(sfport, log_name)
        print("=== case 2: manual stop ===")
        run_manual_stop_case(sfport, log_name)
    finally:
        sfport.close()


if __name__ == "__main__":
    main()
