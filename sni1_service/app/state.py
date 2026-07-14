from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any


class StateManager:
    def __init__(self, dns_window_sec: int = 120):
        self.dns_window_sec = dns_window_sec
        self.dns_by_src: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.dns_resolution_observed: bool = False
        self.flow_events: list[dict[str, Any]] = []

    def observe_dns(
        self,
        src_ip: str | None,
        queried_names: list[str],
        resolved_ips: list[str],
        ts: datetime,
    ) -> None:
        if src_ip is None or ts is None:
            return

        names = queried_names or [None]
        if resolved_ips:
            self.dns_resolution_observed = True

        if not resolved_ips:
            for name in names:
                self.dns_by_src[src_ip].append({"name": name, "ip": None, "ts": ts})
            self.cleanup(ts)
            return

        for name in names:
            for ip in resolved_ips:
                self.dns_by_src[src_ip].append({"name": name, "ip": ip, "ts": ts})

        self.cleanup(ts)

    def find_dns_before_tls(
        self,
        src_ip: str | None,
        dst_ip: str | None,
        ts: datetime,
        window_sec: int = 60,
    ) -> list[dict]:
        if not src_ip or not dst_ip or ts is None:
            return []

        lower_bound = ts - timedelta(seconds=window_sec)
        records = self.dns_by_src.get(src_ip, [])
        return [
            r
            for r in records
            if r.get("ip") == dst_ip and lower_bound <= r.get("ts") <= ts
        ]

    def cleanup(self, now: datetime) -> None:
        if now is None:
            return
        cutoff = now - timedelta(seconds=self.dns_window_sec)
        for src_ip in list(self.dns_by_src.keys()):
            filtered = [r for r in self.dns_by_src[src_ip] if r.get("ts") and r["ts"] >= cutoff]
            if filtered:
                self.dns_by_src[src_ip] = filtered
            else:
                self.dns_by_src.pop(src_ip, None)

    def observe_flow_end(self, event) -> None:
        self.flow_events.append(
            {
                "ts": getattr(event, "end_ts", None) or getattr(event, "ts", None),
                "src_ip": getattr(event, "src_ip", None),
                "dst_ip": getattr(event, "dst_ip", None),
                "duration_sec": getattr(event, "duration_sec", None),
            }
        )
