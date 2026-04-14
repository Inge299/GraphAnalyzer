#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

KNOWN_ENCODINGS = ("utf-8-sig", "cp1251", "cp866", "utf-8")
INPUT_TIME_FORMAT = "%d.%m.%Y %H:%M:%S"
POSTGRES_TIME_FORMAT = "%Y-%m-%d %H:%M:%S"


@dataclass
class Event:
    phone_a: str
    phone_b: str
    start: datetime
    end: datetime
    duration_sec: int
    operator_a: str
    operator_b: str
    address_a: str
    address_b: str
    conn_type: str


@dataclass
class Cluster:
    phone_a: str
    phone_b: str
    conn_type: str
    start: datetime
    end: datetime
    duration_sec: int
    operator_a: Counter
    operator_b: Counter
    address_a: Counter
    address_b: Counter

    def absorb(self, event: Event) -> None:
        self.start = min(self.start, event.start)
        self.end = max(self.end, event.end)
        self.duration_sec = max(self.duration_sec, event.duration_sec)
        if event.operator_a:
            self.operator_a[event.operator_a] += 1
        if event.operator_b:
            self.operator_b[event.operator_b] += 1
        if event.address_a:
            self.address_a[event.address_a] += 1
        if event.address_b:
            self.address_b[event.address_b] += 1


@dataclass
class BuildStats:
    discovered_sources_total: int = 0
    unique_sources_total: int = 0
    duplicate_sources_skipped: int = 0
    rows_read_total: int = 0
    rows_with_valid_start: int = 0
    rows_with_two_abonents: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Nodex converter: transform billing CSV/ZIP into communications and device_history CSV files."
    )
    parser.add_argument(
        "--input-dir",
        required=True,
        help="Folder with source CSV and ZIP files.",
    )
    parser.add_argument(
        "--out-communications",
        default="communications.csv",
        help="Output path for communications CSV.",
    )
    parser.add_argument(
        "--out-device-history",
        default="device_history.csv",
        help="Output path for device history CSV.",
    )
    parser.add_argument(
        "--out-manifest",
        default="nodex_manifest.json",
        help="Output path for run manifest (json) with processing metrics.",
    )
    parser.add_argument(
        "--dedup-window-sec",
        type=int,
        default=5,
        help="Allowed time drift in seconds for considering events as duplicates.",
    )
    parser.add_argument(
        "--postgres-friendly",
        action="store_true",
        help="Use Postgre-friendly output formatting: utf-8, ISO datetime, NULL token for empty values.",
    )
    parser.add_argument(
        "--null-token",
        default="NULL",
        help="Token for empty values in --postgres-friendly mode.",
    )
    return parser.parse_args()


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).strip()


def normalize_phone(value: str) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    digits = re.sub(r"\D+", "", text)
    if not digits:
        return ""
    if len(digits) == 11 and digits.startswith("8"):
        return "7" + digits[1:]
    if len(digits) == 10:
        return "7" + digits
    return digits


def parse_int(value: str) -> int:
    text = normalize_text(value).replace(",", ".")
    if not text:
        return 0
    try:
        return max(0, int(float(text)))
    except ValueError:
        return 0


def parse_dt(value: str) -> datetime | None:
    text = normalize_text(value)
    if not text:
        return None
    try:
        return datetime.strptime(text, INPUT_TIME_FORMAT)
    except ValueError:
        return None


def format_dt(value: datetime, postgres_friendly: bool) -> str:
    return value.strftime(POSTGRES_TIME_FORMAT if postgres_friendly else INPUT_TIME_FORMAT)


def choose_encoding(raw: bytes) -> str:
    for encoding in KNOWN_ENCODINGS:
        try:
            raw.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            continue
    return "latin-1"


def read_csv_rows(raw: bytes, source_name: str) -> Iterable[dict[str, str]]:
    encoding = choose_encoding(raw)
    text = raw.decode(encoding, errors="replace")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    if reader.fieldnames is None:
        raise ValueError(f"No CSV header in source: {source_name}")
    for row in reader:
        yield {normalize_text(k): normalize_text(v) for k, v in row.items() if k is not None}


def detect_operator(phone: str, imsi: str, fallback: str) -> str:
    fb = normalize_text(fallback)
    if fb and not normalize_phone(fb):
        return fb

    imsi_clean = re.sub(r"\D+", "", normalize_text(imsi))
    prefix = imsi_clean[:5]
    imsi_map = {
        "25001": "МТС",
        "25002": "МегаФон",
        "25020": "Теле2",
        "25099": "Билайн",
    }
    if prefix in imsi_map:
        return imsi_map[prefix]

    number = normalize_phone(phone)
    if number.startswith("79"):
        return "Россия"
    return ""


def canonicalize_pair(a: str, b: str) -> tuple[str, str, bool]:
    if a <= b:
        return a, b, False
    return b, a, True


def iter_source_bytes(input_dir: Path) -> Iterable[tuple[str, bytes]]:
    for file_path in sorted(input_dir.rglob("*")):
        if file_path.is_dir():
            continue
        suffix = file_path.suffix.lower()
        if suffix == ".csv":
            yield str(file_path), file_path.read_bytes()
        elif suffix == ".zip":
            with zipfile.ZipFile(file_path) as zf:
                for entry in zf.infolist():
                    if entry.is_dir() or not entry.filename.lower().endswith(".csv"):
                        continue
                    with zf.open(entry) as fh:
                        yield f"{file_path}!{entry.filename}", fh.read()


def build_events_and_devices(
    input_dir: Path,
) -> tuple[list[Event], dict[tuple[str, str, str], list[datetime]], BuildStats]:
    seen_hashes: set[str] = set()
    events: list[Event] = []
    devices: dict[tuple[str, str, str], list[datetime]] = {}
    stats = BuildStats()

    for source_name, raw in iter_source_bytes(input_dir):
        stats.discovered_sources_total += 1
        digest = hashlib.sha256(raw).hexdigest()
        if digest in seen_hashes:
            stats.duplicate_sources_skipped += 1
            continue
        seen_hashes.add(digest)
        stats.unique_sources_total += 1

        for row in read_csv_rows(raw, source_name):
            stats.rows_read_total += 1
            start = parse_dt(row.get("Время начала соединения", ""))
            if start is None:
                continue
            stats.rows_with_valid_start += 1

            duration = parse_int(row.get("Длительность, сек", "0"))
            end = start + timedelta(seconds=duration)

            abon_num = normalize_phone(row.get("Номер абонента", ""))
            contact_num = normalize_phone(row.get("Номер контакта", ""))
            if not abon_num or not contact_num:
                continue
            stats.rows_with_two_abonents += 1

            a_phone, b_phone, swapped = canonicalize_pair(abon_num, contact_num)

            abon_imsi = normalize_text(row.get("IMSI абонента", ""))
            contact_imsi = normalize_text(row.get("IMSI контакта", ""))
            abon_imei = normalize_text(row.get("IMEI абонента", ""))
            contact_imei = normalize_text(row.get("IMEI контакта", ""))

            operator_abon = detect_operator(abon_num, abon_imsi, row.get("Номер абонента", ""))
            operator_contact = detect_operator(contact_num, contact_imsi, row.get("Номер контакта", ""))

            address_abon = normalize_text(
                row.get("Адрес БС абонента на начало", "")
                or row.get("Адрес БС абонента на завершение", "")
            )
            address_contact = normalize_text(
                row.get("Адрес БС контакта на начало", "")
                or row.get("Адрес БС контакта на завершение", "")
            )

            if swapped:
                operator_a, operator_b = operator_contact, operator_abon
                address_a, address_b = address_contact, address_abon
            else:
                operator_a, operator_b = operator_abon, operator_contact
                address_a, address_b = address_abon, address_contact

            conn_type = normalize_text(row.get("Тип соединения", ""))
            events.append(
                Event(
                    phone_a=a_phone,
                    phone_b=b_phone,
                    start=start,
                    end=end,
                    duration_sec=duration,
                    operator_a=operator_a,
                    operator_b=operator_b,
                    address_a=address_a,
                    address_b=address_b,
                    conn_type=conn_type,
                )
            )

            for phone, imsi, imei in (
                (abon_num, abon_imsi, abon_imei),
                (contact_num, contact_imsi, contact_imei),
            ):
                if not phone or (not imsi and not imei):
                    continue
                key = (phone, imsi, imei)
                if key not in devices:
                    devices[key] = [start, end]
                else:
                    devices[key][0] = min(devices[key][0], start)
                    devices[key][1] = max(devices[key][1], end)

    return events, devices, stats


def cluster_events(events: list[Event], dedup_window_sec: int) -> list[Cluster]:
    grouped: dict[tuple[str, str, str], list[Event]] = defaultdict(list)
    for event in events:
        grouped[(event.phone_a, event.phone_b, event.conn_type)].append(event)

    clusters: list[Cluster] = []
    for key_events in grouped.values():
        key_events.sort(key=lambda e: (e.start, e.end))
        local_clusters: list[Cluster] = []
        for event in key_events:
            if (
                local_clusters
                and abs((event.start - local_clusters[-1].start).total_seconds()) <= dedup_window_sec
                and abs((event.end - local_clusters[-1].end).total_seconds()) <= dedup_window_sec
            ):
                local_clusters[-1].absorb(event)
                continue

            cluster = Cluster(
                phone_a=event.phone_a,
                phone_b=event.phone_b,
                conn_type=event.conn_type,
                start=event.start,
                end=event.end,
                duration_sec=event.duration_sec,
                operator_a=Counter([event.operator_a]) if event.operator_a else Counter(),
                operator_b=Counter([event.operator_b]) if event.operator_b else Counter(),
                address_a=Counter([event.address_a]) if event.address_a else Counter(),
                address_b=Counter([event.address_b]) if event.address_b else Counter(),
            )
            local_clusters.append(cluster)
        clusters.extend(local_clusters)
    return clusters


def most_common_value(counter: Counter) -> str:
    if not counter:
        return ""
    return counter.most_common(1)[0][0]


def out_value(value: str | int, postgres_friendly: bool, null_token: str) -> str | int:
    if isinstance(value, int):
        return value
    if postgres_friendly and value == "":
        return null_token
    return value


def write_communications(
    path: Path,
    clusters: list[Cluster],
    postgres_friendly: bool,
    null_token: str,
) -> int:
    grouped: dict[tuple[str, str], list[Cluster]] = defaultdict(list)
    for cluster in clusters:
        grouped[(cluster.phone_a, cluster.phone_b)].append(cluster)

    fieldnames = [
        "Абон1",
        "Абон2",
        "оператор1",
        "оператор2",
        "Адрес1",
        "Адрес2",
        "время_начала",
        "время_конца",
        "количество_связей",
        "общая_продолжительность",
    ]

    rows = []
    for (phone_a, phone_b), pair_clusters in grouped.items():
        starts = [c.start for c in pair_clusters]
        ends = [c.end for c in pair_clusters]
        op_a = Counter()
        op_b = Counter()
        addr_a = Counter()
        addr_b = Counter()
        total_duration = 0
        for c in pair_clusters:
            op_a.update(c.operator_a)
            op_b.update(c.operator_b)
            addr_a.update(c.address_a)
            addr_b.update(c.address_b)
            total_duration += c.duration_sec

        rows.append(
            {
                "Абон1": out_value(phone_a, postgres_friendly, null_token),
                "Абон2": out_value(phone_b, postgres_friendly, null_token),
                "оператор1": out_value(most_common_value(op_a), postgres_friendly, null_token),
                "оператор2": out_value(most_common_value(op_b), postgres_friendly, null_token),
                "Адрес1": out_value(most_common_value(addr_a), postgres_friendly, null_token),
                "Адрес2": out_value(most_common_value(addr_b), postgres_friendly, null_token),
                "время_начала": format_dt(min(starts), postgres_friendly),
                "время_конца": format_dt(max(ends), postgres_friendly),
                "количество_связей": len(pair_clusters),
                "общая_продолжительность": total_duration,
            }
        )

    rows.sort(key=lambda r: int(r["количество_связей"]), reverse=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def write_device_history(
    path: Path,
    devices: dict[tuple[str, str, str], list[datetime]],
    postgres_friendly: bool,
    null_token: str,
) -> int:
    fieldnames = ["абон", "imsi", "imei", "начало_периода", "окончание_периода"]

    rows = []
    for (abon, imsi, imei), (start, end) in devices.items():
        rows.append(
            {
                "абон": out_value(abon, postgres_friendly, null_token),
                "imsi": out_value(imsi, postgres_friendly, null_token),
                "imei": out_value(imei, postgres_friendly, null_token),
                "начало_периода": format_dt(start, postgres_friendly),
                "окончание_периода": format_dt(end, postgres_friendly),
            }
        )

    rows.sort(key=lambda r: (r["абон"], r["imsi"], r["imei"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def write_manifest(
    path: Path,
    input_dir: Path,
    args: argparse.Namespace,
    stats: BuildStats,
    events_count: int,
    clusters_count: int,
    communications_rows: int,
    device_rows: int,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "tool": "Nodex converter",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "input_dir": str(input_dir),
        "params": {
            "dedup_window_sec": args.dedup_window_sec,
            "postgres_friendly": args.postgres_friendly,
            "null_token": args.null_token,
        },
        "sources": {
            "discovered_total": stats.discovered_sources_total,
            "unique_total": stats.unique_sources_total,
            "duplicate_skipped": stats.duplicate_sources_skipped,
        },
        "rows": {
            "read_total": stats.rows_read_total,
            "with_valid_start": stats.rows_with_valid_start,
            "with_two_abonents": stats.rows_with_two_abonents,
            "events_kept": events_count,
            "events_after_dedup": clusters_count,
        },
        "output": {
            "communications_rows": communications_rows,
            "device_history_rows": device_rows,
        },
    }
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir)
    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"Input directory does not exist: {input_dir}")

    events, devices, stats = build_events_and_devices(input_dir)
    clusters = cluster_events(events, args.dedup_window_sec)

    communications_path = Path(args.out_communications)
    device_history_path = Path(args.out_device_history)
    manifest_path = Path(args.out_manifest)

    communications_rows = write_communications(
        communications_path,
        clusters,
        postgres_friendly=args.postgres_friendly,
        null_token=args.null_token,
    )
    device_rows = write_device_history(
        device_history_path,
        devices,
        postgres_friendly=args.postgres_friendly,
        null_token=args.null_token,
    )
    write_manifest(
        manifest_path,
        input_dir,
        args,
        stats,
        events_count=len(events),
        clusters_count=len(clusters),
        communications_rows=communications_rows,
        device_rows=device_rows,
    )

    print(f"Nodex converter done. Sources processed from: {input_dir}")
    print(f"Discovered sources: {stats.discovered_sources_total}")
    print(f"Unique sources used: {stats.unique_sources_total}")
    print(f"Duplicate sources skipped: {stats.duplicate_sources_skipped}")
    print(f"Rows read: {stats.rows_read_total}")
    print(f"Unique raw events with two abonents: {len(events)}")
    print(f"Events after dedup clustering: {len(clusters)}")
    print(f"Communications rows written: {communications_rows}")
    print(f"Device history rows written: {device_rows}")
    print(f"Communications written to: {communications_path.resolve()}")
    print(f"Device history written to: {device_history_path.resolve()}")
    print(f"Manifest written to: {manifest_path.resolve()}")


if __name__ == "__main__":
    main()


