#!/usr/bin/env python3
"""Concurrency smoke: 50 parallel joins + display fetches."""
from __future__ import annotations

import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

API = os.environ.get("API", "http://localhost:8080/api")


def req(method: str, path: str, body=None, headers=None):
    data = None if body is None else json.dumps(body).encode()
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    r = urllib.request.Request(API + path, data=data, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=30) as res:
        return res.status, json.loads(res.read().decode() or "null")


def main():
    _, templates = req("GET", "/templates")
    tid = templates[0]["id"]
    _, created = req("POST", "/sessions", {"templateId": tid, "title": "Load Check"})
    sid, code, ht = created["id"], created["code"], created["hostToken"]
    req("POST", f"/sessions/{sid}/start", {}, {"X-Host-Token": ht})

    def join(i: int):
        status, _ = req("POST", f"/sessions/{code}/join", {"displayName": f"User{i}"})
        return status

    def display(_: int):
        status, _ = req("GET", f"/sessions/{sid}/display")
        return status

    print(f"Session {sid} code={code}")
    with ThreadPoolExecutor(max_workers=20) as pool:
        join_codes = [f.result() for f in as_completed(pool.submit(join, i) for i in range(50))]
        disp_codes = [f.result() for f in as_completed(pool.submit(display, i) for i in range(50))]
    print("join statuses", {c: join_codes.count(c) for c in sorted(set(join_codes))})
    print("display statuses", {c: disp_codes.count(c) for c in sorted(set(disp_codes))})
    _, view = req("GET", f"/sessions/{sid}/display")
    count = view["participantCount"]
    print(f"participantCount={count}")
    assert count == 50, count
    print("Load check OK")


if __name__ == "__main__":
    main()
