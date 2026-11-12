from __future__ import annotations

import os
import time
from pprint import pprint

from mkp_python import check_sf_serial_port, new_sf_serial_port, stop_record


def init_sfport(port_name: str | None = None):
    sfport = new_sf_serial_port()
    resolved = port_name or os.getenv("MKP_SF_PORT") or check_sf_serial_port()
    if not resolved:
        raise SystemExit("lookup mkp device failed")
    sfport.name = resolved
    sfport.open()
    time.sleep(0.05)
    sfport.reset_input_buffer()
    sfport.start_read_loop()
    try:
        stop_record(sfport)
    except Exception:
        pass
    sfport.sync_output_enabled = True
    return sfport


def log(value) -> None:
    pprint(value)
