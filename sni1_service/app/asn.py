from __future__ import annotations

import csv
import ipaddress
from bisect import bisect_right
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ASNRange:
    start_int: int
    end_int: int
    asn: int
    as_name: str


@dataclass(frozen=True)
class ASNInfo:
    asn: int
    as_name: str


class ASNDatabase:
    def __init__(self, ranges: list[ASNRange]):
        self.ranges = sorted(ranges, key=lambda r: (r.start_int, r.end_int))
        self._starts = [r.start_int for r in self.ranges]

    @classmethod
    def from_csv(cls, path: Path) -> "ASNDatabase":
        ranges: list[ASNRange] = []
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                start_ip = str(row.get("start_ip") or "").strip()
                end_ip = str(row.get("end_ip") or "").strip()
                asn_raw = str(row.get("asn") or "").strip()
                as_name = str(row.get("as_name") or "").strip()
                if not (start_ip and end_ip and asn_raw):
                    continue

                try:
                    start_int = int(ipaddress.ip_address(start_ip))
                    end_int = int(ipaddress.ip_address(end_ip))
                    asn = int(asn_raw)
                except (ValueError, TypeError):
                    continue

                if end_int < start_int:
                    continue

                ranges.append(
                    ASNRange(
                        start_int=start_int,
                        end_int=end_int,
                        asn=asn,
                        as_name=as_name,
                    )
                )

        return cls(ranges)

    def lookup(self, ip: str) -> ASNInfo | None:
        try:
            ip_int = int(ipaddress.ip_address(ip))
        except ValueError:
            return None

        idx = bisect_right(self._starts, ip_int) - 1
        if idx < 0:
            return None

        candidate = self.ranges[idx]
        if candidate.start_int <= ip_int <= candidate.end_int:
            return ASNInfo(asn=candidate.asn, as_name=candidate.as_name)
        return None
