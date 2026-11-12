from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mkp_python.file_server import create_app, resolve_root, safe_join


def test_put_get_list_and_upload(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))

    put_response = client.put("/nested/test.txt", content=b"hello")
    assert put_response.status_code == 200
    assert put_response.json() == {"status": "ok", "path": "nested/test.txt", "size": 5}

    get_response = client.get("/nested/test.txt")
    assert get_response.status_code == 200
    assert get_response.content == b"hello"

    root_listing = client.get("/list")
    assert root_listing.status_code == 200
    assert root_listing.json() == [{"name": "nested", "type": "dir", "size": 0, "path": "nested"}]

    nested_listing = client.get("/list", params={"path": "nested"})
    assert nested_listing.status_code == 200
    assert nested_listing.json() == [{"name": "test.txt", "type": "file", "size": 5, "path": "nested/test.txt"}]

    upload_response = client.post(
        "/upload",
        data={"path": "uploads"},
        files={"file": ("bad:name?.txt", b"world", "text/plain")},
    )
    assert upload_response.status_code == 200
    assert upload_response.json() == {"status": "ok", "path": "uploads/bad_name_.txt", "size": 5}
    assert (tmp_path / "uploads" / "bad_name_.txt").read_bytes() == b"world"


def test_rejects_path_traversal_and_empty_put(tmp_path) -> None:
    client = TestClient(create_app(tmp_path))
    root = resolve_root(tmp_path)

    assert client.get("/list", params={"path": "../outside"}).status_code == 400
    with pytest.raises(ValueError, match="Path traversal rejected"):
        safe_join(root, "../outside.txt")
    empty_response = client.put("/empty.txt", content=b"")
    assert empty_response.status_code == 400
    assert empty_response.json()["detail"] == "Empty request body"
