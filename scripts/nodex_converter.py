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
    imsi_a: str
    imsi_b: str
    imei_a: str
    imei_b: str
    loc_a_start: str
    loc_a_end: str
    loc_b_start: str
    loc_b_end: str
    conn_type: str


@dataclass
class LocationEvent:
    identifier_type: str
    identifier_value: str
    event_time: datetime
    address: str
    mcc: str
    mnc: str
    lac: str
    bs: str


@dataclass
class IpBinding:
    identifier_type: str
    identifier_value: str
    ip_address: str
    event_time: datetime
    address: str
    mcc: str
    mnc: str
    lac: str
    bs: str
    user_id: str = ""
    device_info: str = ""
    message_text: str = ""


@dataclass
class UserMsisdnFact:
    event_time: datetime
    user_id: str
    user_msisdn: str


@dataclass
class IpMsisdnFact:
    event_time: datetime
    ip_address: str
    user_msisdn: str


@dataclass
class MsisdnDeviceFact:
    event_time: datetime
    user_msisdn: str
    device_info: str


@dataclass
class MsisdnTextFact:
    event_time: datetime
    user_msisdn: str
    file_msisdn: str
    message_text: str


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
    imsi_a: Counter
    imsi_b: Counter
    imei_a: Counter
    imei_b: Counter
    loc_a_start: Counter
    loc_a_end: Counter
    loc_b_start: Counter
    loc_b_end: Counter
    duration_sum_sec: int
    event_count: int

    def absorb(self, event: Event) -> None:
        self.start = min(self.start, event.start)
        self.end = max(self.end, event.end)
        self.duration_sec = max(self.duration_sec, event.duration_sec)
        self.duration_sum_sec += max(0, event.duration_sec)
        self.event_count += 1
        if event.operator_a:
            self.operator_a[event.operator_a] += 1
        if event.operator_b:
            self.operator_b[event.operator_b] += 1
        if event.address_a:
            self.address_a[event.address_a] += 1
        if event.address_b:
            self.address_b[event.address_b] += 1
        if event.imsi_a:
            self.imsi_a[event.imsi_a] += 1
        if event.imsi_b:
            self.imsi_b[event.imsi_b] += 1
        if event.imei_a:
            self.imei_a[event.imei_a] += 1
        if event.imei_b:
            self.imei_b[event.imei_b] += 1
        if event.loc_a_start:
            self.loc_a_start[event.loc_a_start] += 1
        if event.loc_a_end:
            self.loc_a_end[event.loc_a_end] += 1
        if event.loc_b_start:
            self.loc_b_start[event.loc_b_start] += 1
        if event.loc_b_end:
            self.loc_b_end[event.loc_b_end] += 1


@dataclass
class BuildStats:
    discovered_sources_total: int = 0
    unique_sources_total: int = 0
    duplicate_sources_skipped: int = 0
    rows_read_total: int = 0
    rows_with_valid_start: int = 0
    rows_with_two_abonents: int = 0
    rows_location_only: int = 0
    rows_with_non_phone_contact: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Nodex converter: transform billing CSV/ZIP into project CSV files."
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
        "--out-location-events",
        default="location_events.csv",
        help="Output path for location-only events CSV.",
    )
    parser.add_argument(
        "--out-ip-bindings",
        default="ip_bindings.csv",
        help="Output path for identifier-to-ip bindings CSV.",
    )
    parser.add_argument(
        "--out-user-msisdn-facts",
        default="user_msisdn_facts.csv",
        help="Output path for user-id to MSISDN facts CSV.",
    )
    parser.add_argument(
        "--out-ip-msisdn-facts",
        default="ip_msisdn_facts.csv",
        help="Output path for IP to MSISDN facts CSV.",
    )
    parser.add_argument(
        "--out-msisdn-device-facts",
        default="msisdn_device_facts.csv",
        help="Output path for MSISDN to device facts CSV.",
    )
    parser.add_argument(
        "--out-msisdn-text-facts",
        default="msisdn_text_facts.csv",
        help="Output path for MSISDN text facts CSV.",
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
    """Normalize a subscriber number without converting service identifiers to digits."""
    text = normalize_text(value)
    if not text or not re.fullmatch(r"[0-9+().\s-]+", text):
        return ""
    digits = re.sub(r"\D+", "", text)
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    elif len(digits) == 10:
        digits = "7" + digits
    return digits if 8 <= len(digits) <= 13 else ""

def normalize_imsi(value: str) -> str:
    digits = re.sub(r"\D+", "", normalize_text(value))
    if len(digits) != 15:
        return ""
    return digits


def extract_mcc_mnc(imsi: str) -> tuple[str, str]:
    normalized = normalize_imsi(imsi)
    if not normalized:
        return "", ""
    return normalized[:3], normalized[3:5].lstrip("0") or "0"


def normalize_imei(value: str) -> str:
    digits = re.sub(r"\D+", "", normalize_text(value))
    if len(digits) < 14:
        return ""
    return digits[:14]


def parse_lac_bs(value: str) -> tuple[str, str]:
    raw = normalize_text(value)
    if not raw:
        return "", ""
    parts = re.findall(r"\d+", raw)
    if len(parts) < 2:
        return "", ""
    return parts[0], parts[1]


def append_location_event(
    target: list[LocationEvent],
    seen: set[tuple[str, str, datetime, str, str, str, str, str]],
    *,
    identifier_type: str,
    identifier_value: str,
    event_time: datetime | None,
    address: str,
    imsi: str,
    location_value: str,
) -> None:
    """Keep a location fact only when the source actually contains location data."""
    if not identifier_value or event_time is None:
        return
    lac, bs = parse_lac_bs(location_value)
    if not (address or lac or bs):
        return
    mcc, mnc = extract_mcc_mnc(imsi)
    key = (identifier_type, identifier_value, event_time, address, mcc, mnc, lac, bs)
    if key in seen:
        return
    seen.add(key)
    target.append(
        LocationEvent(
            identifier_type=identifier_type,
            identifier_value=identifier_value,
            event_time=event_time,
            address=address,
            mcc=mcc,
            mnc=mnc,
            lac=lac,
            bs=bs,
        )
    )


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
    for fmt in (INPUT_TIME_FORMAT, "%d.%m.%Y %H:%M", "%d.%m.%Y %H"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def extract_user_identity_fields(value: str) -> tuple[str, str, str]:
    text = str(value or "").strip()
    if not text:
        return "", "", ""

    ip_match = re.search(r"IP-адрес:\s*([^;]+)", text, flags=re.IGNORECASE)
    msisdn_match = re.search(r"Номер:\s*([^;]+)", text, flags=re.IGNORECASE)
    device_match = re.search(r"Программа:\s*(.+)$", text, flags=re.IGNORECASE)

    ip_address = normalize_text(ip_match.group(1)) if ip_match else ""
    msisdn = normalize_phone(msisdn_match.group(1)) if msisdn_match else ""
    device_info = normalize_text(device_match.group(1)) if device_match else ""
    return ip_address, msisdn, device_info


def extract_file_msisdn(source_name: str) -> str:
    text = str(source_name or "").replace("\\", "/")
    leaf = text.split("!")[-1].split("/")[-1]
    for candidate in re.findall(r"\b7\d{10}\b", leaf):
        normalized = normalize_phone(candidate)
        if len(normalized) == 11 and normalized.startswith("7"):
            return normalized
    return ""


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
        if suffix in {".csv", ".txt"}:
            yield str(file_path), file_path.read_bytes()
        elif suffix == ".zip":
            with zipfile.ZipFile(file_path) as zf:
                for entry in zf.infolist():
                    if entry.is_dir() or Path(entry.filename).suffix.lower() not in {".csv", ".txt"}:
                        continue
                    with zf.open(entry) as fh:
                        yield f"{file_path}!{entry.filename}", fh.read()


def build_events_and_devices(
    input_dir: Path,
) -> tuple[
    list[Event],
    dict[tuple[str, str, str], list[datetime]],
    list[LocationEvent],
    list[IpBinding],
    list[UserMsisdnFact],
    list[IpMsisdnFact],
    list[MsisdnDeviceFact],
    list[MsisdnTextFact],
    BuildStats,
]:
    seen_hashes: set[str] = set()
    events: list[Event] = []
    devices: dict[tuple[str, str, str], list[datetime]] = {}
    location_events: list[LocationEvent] = []
    location_event_keys: set[tuple[str, str, datetime, str, str, str, str, str]] = set()
    ip_bindings: list[IpBinding] = []
    user_msisdn_facts: list[UserMsisdnFact] = []
    ip_msisdn_facts: list[IpMsisdnFact] = []
    msisdn_device_facts: list[MsisdnDeviceFact] = []
    msisdn_text_facts: list[MsisdnTextFact] = []
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

            user_identity_blob = normalize_text(row.get("Техданные, идент. пользователя", ""))
            if user_identity_blob:
                event_time = parse_dt(row.get("Дата и время", ""))
                if event_time is None:
                    continue

                stats.rows_with_valid_start += 1
                ip_address, msisdn, device_info = extract_user_identity_fields(user_identity_blob)
                user_id = normalize_text(row.get("Ид. пользователя", ""))
                message_text = normalize_text(row.get("Текст сообщения", "") or row.get("Текст", ""))
                file_msisdn = extract_file_msisdn(source_name)

                if user_id and msisdn:
                    user_msisdn_facts.append(
                        UserMsisdnFact(
                            event_time=event_time,
                            user_id=user_id,
                            user_msisdn=msisdn,
                        )
                    )
                if ip_address and msisdn:
                    ip_msisdn_facts.append(
                        IpMsisdnFact(
                            event_time=event_time,
                            ip_address=ip_address,
                            user_msisdn=msisdn,
                        )
                    )
                if msisdn and device_info:
                    msisdn_device_facts.append(
                        MsisdnDeviceFact(
                            event_time=event_time,
                            user_msisdn=msisdn,
                            device_info=device_info,
                        )
                    )
                if msisdn and file_msisdn and message_text:
                    msisdn_text_facts.append(
                        MsisdnTextFact(
                            event_time=event_time,
                            user_msisdn=msisdn,
                            file_msisdn=file_msisdn,
                            message_text=message_text,
                        )
                    )
                continue

            conn_start = parse_dt(row.get("Время начала соединения", ""))
            location_time = parse_dt(row.get("Время определения местоположения", ""))

            if conn_start is not None:
                stats.rows_with_valid_start += 1

                duration = parse_int(row.get("Длительность, сек", "0"))
                conn_end = conn_start + timedelta(seconds=duration)

                abon_num = normalize_phone(row.get("Номер абонента", ""))
                contact_num = normalize_phone(row.get("Номер контакта", ""))
                if not abon_num or not contact_num:
                    stats.rows_with_non_phone_contact += 1
                    continue
                stats.rows_with_two_abonents += 1

                a_phone, b_phone, swapped = canonicalize_pair(abon_num, contact_num)

                abon_imsi = normalize_text(row.get("IMSI абонента", ""))
                contact_imsi = normalize_text(row.get("IMSI контакта", ""))
                abon_imei = normalize_text(row.get("IMEI абонента", ""))
                contact_imei = normalize_text(row.get("IMEI контакта", ""))

                operator_abon = detect_operator(abon_num, abon_imsi, row.get("Номер абонента", ""))
                operator_contact = detect_operator(contact_num, contact_imsi, row.get("Номер контакта", ""))

                address_abon_start = normalize_text(row.get("Адрес БС абонента на начало", ""))
                address_abon_end = normalize_text(row.get("Адрес БС абонента на завершение", ""))
                address_contact_start = normalize_text(row.get("Адрес БС контакта на начало", ""))
                address_contact_end = normalize_text(row.get("Адрес БС контакта на завершение", ""))
                address_abon = address_abon_start or address_abon_end
                address_contact = address_contact_start or address_contact_end

                loc_abon_start = normalize_text(row.get("М/П абонента на начало", ""))
                loc_abon_end = normalize_text(row.get("М/П абонента на конец", ""))
                loc_contact_start = normalize_text(row.get("М/П контакта на начало", ""))
                loc_contact_end = normalize_text(row.get("М/П контакта на конец", ""))

                if swapped:
                    operator_a, operator_b = operator_contact, operator_abon
                    address_a, address_b = address_contact, address_abon
                    imsi_a, imsi_b = contact_imsi, abon_imsi
                    imei_a, imei_b = contact_imei, abon_imei
                    loc_a_start, loc_a_end = loc_contact_start, loc_contact_end
                    loc_b_start, loc_b_end = loc_abon_start, loc_abon_end
                else:
                    operator_a, operator_b = operator_abon, operator_contact
                    address_a, address_b = address_abon, address_contact
                    imsi_a, imsi_b = abon_imsi, contact_imsi
                    imei_a, imei_b = abon_imei, contact_imei
                    loc_a_start, loc_a_end = loc_abon_start, loc_abon_end
                    loc_b_start, loc_b_end = loc_contact_start, loc_contact_end

                conn_type = normalize_text(row.get("Тип соединения", ""))
                events.append(
                    Event(
                        phone_a=a_phone,
                        phone_b=b_phone,
                        start=conn_start,
                        end=conn_end,
                        duration_sec=duration,
                        operator_a=operator_a,
                        operator_b=operator_b,
                        address_a=address_a,
                        address_b=address_b,
                        imsi_a=imsi_a,
                        imsi_b=imsi_b,
                        imei_a=imei_a,
                        imei_b=imei_b,
                        loc_a_start=loc_a_start,
                        loc_a_end=loc_a_end,
                        loc_b_start=loc_b_start,
                        loc_b_end=loc_b_end,
                        conn_type=conn_type,
                    )
                )

                for phone, imsi, imei, event_time, location_value, address in (
                    (abon_num, abon_imsi, abon_imei, conn_start, loc_abon_start, address_abon_start),
                    (abon_num, abon_imsi, abon_imei, conn_end, loc_abon_end, address_abon_end),
                    (contact_num, contact_imsi, contact_imei, conn_start, loc_contact_start, address_contact_start),
                    (contact_num, contact_imsi, contact_imei, conn_end, loc_contact_end, address_contact_end),
                ):
                    for identifier_type, identifier_value in (("msisdn", phone), ("imsi", imsi), ("imei", imei)):
                        append_location_event(
                            location_events,
                            location_event_keys,
                            identifier_type=identifier_type,
                            identifier_value=identifier_value,
                            event_time=event_time,
                            address=address,
                            imsi=imsi,
                            location_value=location_value,
                        )

                for phone, imsi, imei in (
                    (abon_num, abon_imsi, abon_imei),
                    (contact_num, contact_imsi, contact_imei),
                ):
                    if not phone or (not imsi and not imei):
                        continue
                    key = (phone, imsi, imei)
                    if key not in devices:
                        devices[key] = [conn_start, conn_end]
                    else:
                        devices[key][0] = min(devices[key][0], conn_start)
                        devices[key][1] = max(devices[key][1], conn_end)
                continue

            if location_time is None:
                continue

            stats.rows_with_valid_start += 1
            stats.rows_location_only += 1

            abon_num = normalize_phone(row.get("Номер абонента", ""))
            abon_imsi = normalize_imsi(row.get("IMSI абонента", ""))
            abon_imei = normalize_imei(row.get("IMEI абонента", ""))
            ip_address = normalize_text(row.get("IP-адрес абонента", ""))
            location_value = normalize_text(row.get("М/П абонента", ""))
            address = normalize_text(row.get("Адрес БС абонента", ""))

            identifiers: list[tuple[str, str]] = []
            if abon_num:
                identifiers.append(("phone", abon_num))
            if abon_imsi:
                identifiers.append(("imsi", abon_imsi))
            if abon_imei:
                identifiers.append(("imei", abon_imei))
            if not identifiers:
                continue

            for identifier_type, identifier_value in identifiers:
                append_location_event(
                    location_events,
                    location_event_keys,
                    identifier_type=identifier_type,
                    identifier_value=identifier_value,
                    event_time=location_time,
                    address=address,
                    imsi=abon_imsi,
                    location_value=location_value,
                )

            if ip_address:
                for identifier_type, identifier_value in identifiers:
                    ip_bindings.append(
                        IpBinding(
                            identifier_type=identifier_type,
                            identifier_value=identifier_value,
                            ip_address=ip_address,
                            event_time=location_time,
                            address=address,
                            mcc=mcc,
                            mnc=mnc,
                            lac=lac,
                            bs=bs,
                        )
                    )

            if abon_num and (abon_imsi or abon_imei):
                key = (abon_num, abon_imsi, abon_imei)
                if key not in devices:
                    devices[key] = [location_time, location_time]
                else:
                    devices[key][0] = min(devices[key][0], location_time)
                    devices[key][1] = max(devices[key][1], location_time)

    return (
        events,
        devices,
        location_events,
        ip_bindings,
        user_msisdn_facts,
        ip_msisdn_facts,
        msisdn_device_facts,
        msisdn_text_facts,
        stats,
    )


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
                imsi_a=Counter([event.imsi_a]) if event.imsi_a else Counter(),
                imsi_b=Counter([event.imsi_b]) if event.imsi_b else Counter(),
                imei_a=Counter([event.imei_a]) if event.imei_a else Counter(),
                imei_b=Counter([event.imei_b]) if event.imei_b else Counter(),
                loc_a_start=Counter([event.loc_a_start]) if event.loc_a_start else Counter(),
                loc_a_end=Counter([event.loc_a_end]) if event.loc_a_end else Counter(),
                loc_b_start=Counter([event.loc_b_start]) if event.loc_b_start else Counter(),
                loc_b_end=Counter([event.loc_b_end]) if event.loc_b_end else Counter(),
                duration_sum_sec=max(0, event.duration_sec),
                event_count=1,
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
    fieldnames = [
        "Абон1",
        "Абон2",
        "оператор1",
        "оператор2",
        "Адрес1",
        "Адрес2",
        "IMSI абонента",
        "IMSI контакта",
        "IMEI абонента",
        "IMEI контакта",
        "М/П абонента на начало",
        "М/П абонента на конец",
        "М/П контакта на начало",
        "М/П контакта на конец",
        "время_начала",
        "время_конца",
        "Длительность, сек",
        "уникальных_контактов",
        "количество_связей",
        "общая_продолжительность",
    ]

    rows = []
    for cluster in clusters:
        rows.append(
            {
                "Абон1": out_value(cluster.phone_a, postgres_friendly, null_token),
                "Абон2": out_value(cluster.phone_b, postgres_friendly, null_token),
                "оператор1": out_value(most_common_value(cluster.operator_a), postgres_friendly, null_token),
                "оператор2": out_value(most_common_value(cluster.operator_b), postgres_friendly, null_token),
                "Адрес1": out_value(most_common_value(cluster.address_a), postgres_friendly, null_token),
                "Адрес2": out_value(most_common_value(cluster.address_b), postgres_friendly, null_token),
                "IMSI абонента": out_value(most_common_value(cluster.imsi_a), postgres_friendly, null_token),
                "IMSI контакта": out_value(most_common_value(cluster.imsi_b), postgres_friendly, null_token),
                "IMEI абонента": out_value(most_common_value(cluster.imei_a), postgres_friendly, null_token),
                "IMEI контакта": out_value(most_common_value(cluster.imei_b), postgres_friendly, null_token),
                "М/П абонента на начало": out_value(most_common_value(cluster.loc_a_start), postgres_friendly, null_token),
                "М/П абонента на конец": out_value(most_common_value(cluster.loc_a_end), postgres_friendly, null_token),
                "М/П контакта на начало": out_value(most_common_value(cluster.loc_b_start), postgres_friendly, null_token),
                "М/П контакта на конец": out_value(most_common_value(cluster.loc_b_end), postgres_friendly, null_token),
                "время_начала": format_dt(cluster.start, postgres_friendly),
                "время_конца": format_dt(cluster.end, postgres_friendly),
                "Длительность, сек": int(max(0, cluster.duration_sec)),
                "уникальных_контактов": 1,
                "количество_связей": int(max(1, cluster.event_count)),
                "общая_продолжительность": int(max(0, cluster.duration_sum_sec)),
            }
        )

    rows.sort(
        key=lambda r: (
            str(r["Абон1"]),
            str(r["Абон2"]),
            str(r["время_начала"]),
            str(r["время_конца"]),
        )
    )
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


def write_location_events(
    path: Path,
    rows: list[LocationEvent],
    postgres_friendly: bool,
    null_token: str,
) -> int:
    fieldnames = ["identifier_type", "identifier_value", "event_time", "address", "mcc", "mnc", "lac", "bs"]
    out_rows: list[dict[str, str]] = []
    for row in rows:
        out_rows.append(
            {
                "identifier_type": row.identifier_type,
                "identifier_value": row.identifier_value,
                "event_time": format_dt(row.event_time, postgres_friendly),
                "address": str(out_value(row.address, postgres_friendly, null_token)),
                "mcc": str(out_value(row.mcc, postgres_friendly, null_token)),
                "mnc": str(out_value(row.mnc, postgres_friendly, null_token)),
                "lac": str(out_value(row.lac, postgres_friendly, null_token)),
                "bs": str(out_value(row.bs, postgres_friendly, null_token)),
            }
        )

    out_rows.sort(key=lambda r: (r["identifier_type"], r["identifier_value"], r["event_time"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(out_rows)
    return len(out_rows)


def write_ip_bindings(
    path: Path,
    rows: list[IpBinding],
    postgres_friendly: bool,
    null_token: str,
) -> int:
    fieldnames = [
        "identifier_type",
        "identifier_value",
        "ip_address",
        "event_time",
        "address",
        "mcc",
        "mnc",
        "lac",
        "bs",
        "user_id",
        "device_info",
        "message_text",
    ]
    out_rows: list[dict[str, str]] = []
    for row in rows:
        out_rows.append(
            {
                "identifier_type": row.identifier_type,
                "identifier_value": row.identifier_value,
                "ip_address": row.ip_address,
                "event_time": format_dt(row.event_time, postgres_friendly),
                "address": str(out_value(row.address, postgres_friendly, null_token)),
                "mcc": str(out_value(row.mcc, postgres_friendly, null_token)),
                "mnc": str(out_value(row.mnc, postgres_friendly, null_token)),
                "lac": str(out_value(row.lac, postgres_friendly, null_token)),
                "bs": str(out_value(row.bs, postgres_friendly, null_token)),
                "user_id": str(out_value(row.user_id, postgres_friendly, null_token)),
                "device_info": str(out_value(row.device_info, postgres_friendly, null_token)),
                "message_text": str(out_value(row.message_text, postgres_friendly, null_token)),
            }
        )

    out_rows.sort(
        key=lambda r: (
            r["identifier_type"],
            r["identifier_value"],
            r["event_time"],
            r["ip_address"],
            r["user_id"],
        )
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(out_rows)
    return len(out_rows)


def write_user_msisdn_facts(
    path: Path,
    rows: list[UserMsisdnFact],
    postgres_friendly: bool,
) -> int:
    fieldnames = ["event_time", "user_id", "user_msisdn"]
    out_rows = [
        {
            "event_time": format_dt(row.event_time, postgres_friendly),
            "user_id": row.user_id,
            "user_msisdn": row.user_msisdn,
        }
        for row in rows
    ]
    out_rows.sort(key=lambda r: (r["event_time"], r["user_id"], r["user_msisdn"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(out_rows)
    return len(out_rows)


def write_ip_msisdn_facts(
    path: Path,
    rows: list[IpMsisdnFact],
    postgres_friendly: bool,
) -> int:
    fieldnames = ["event_time", "ip_address", "user_msisdn"]
    out_rows = [
        {
            "event_time": format_dt(row.event_time, postgres_friendly),
            "ip_address": row.ip_address,
            "user_msisdn": row.user_msisdn,
        }
        for row in rows
    ]
    out_rows.sort(key=lambda r: (r["event_time"], r["ip_address"], r["user_msisdn"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(out_rows)
    return len(out_rows)


def write_msisdn_device_facts(
    path: Path,
    rows: list[MsisdnDeviceFact],
    postgres_friendly: bool,
) -> int:
    fieldnames = ["event_time", "user_msisdn", "device_info"]
    out_rows = [
        {
            "event_time": format_dt(row.event_time, postgres_friendly),
            "user_msisdn": row.user_msisdn,
            "device_info": row.device_info,
        }
        for row in rows
    ]
    out_rows.sort(key=lambda r: (r["event_time"], r["user_msisdn"], r["device_info"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(out_rows)
    return len(out_rows)


def write_msisdn_text_facts(
    path: Path,
    rows: list[MsisdnTextFact],
    postgres_friendly: bool,
) -> int:
    fieldnames = ["event_time", "user_msisdn", "file_msisdn", "message_text"]
    out_rows = [
        {
            "event_time": format_dt(row.event_time, postgres_friendly),
            "user_msisdn": row.user_msisdn,
            "file_msisdn": row.file_msisdn,
            "message_text": row.message_text,
        }
        for row in rows
    ]
    out_rows.sort(key=lambda r: (r["event_time"], r["user_msisdn"], r["file_msisdn"], r["message_text"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(out_rows)
    return len(out_rows)


def write_manifest(
    path: Path,
    input_dir: Path,
    args: argparse.Namespace,
    stats: BuildStats,
    events_count: int,
    clusters_count: int,
    communications_rows: int,
    device_rows: int,
    location_events_rows: int,
    ip_bindings_rows: int,
    user_msisdn_facts_rows: int,
    ip_msisdn_facts_rows: int,
    msisdn_device_facts_rows: int,
    msisdn_text_facts_rows: int,
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
            "location_only_rows": stats.rows_location_only,
            "non_phone_contact_rows": stats.rows_with_non_phone_contact,
            "events_kept": events_count,
            "events_after_dedup": clusters_count,
        },
        "output": {
            "communications_rows": communications_rows,
            "device_history_rows": device_rows,
            "location_events_rows": location_events_rows,
            "ip_bindings_rows": ip_bindings_rows,
            "user_msisdn_facts_rows": user_msisdn_facts_rows,
            "ip_msisdn_facts_rows": ip_msisdn_facts_rows,
            "msisdn_device_facts_rows": msisdn_device_facts_rows,
            "msisdn_text_facts_rows": msisdn_text_facts_rows,
        },
    }
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir)
    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"Input directory does not exist: {input_dir}")

    (
        events,
        devices,
        location_events,
        ip_bindings,
        user_msisdn_facts,
        ip_msisdn_facts,
        msisdn_device_facts,
        msisdn_text_facts,
        stats,
    ) = build_events_and_devices(input_dir)
    clusters = cluster_events(events, args.dedup_window_sec)

    communications_path = Path(args.out_communications)
    device_history_path = Path(args.out_device_history)
    location_events_path = Path(args.out_location_events)
    ip_bindings_path = Path(args.out_ip_bindings)
    user_msisdn_facts_path = Path(args.out_user_msisdn_facts)
    ip_msisdn_facts_path = Path(args.out_ip_msisdn_facts)
    msisdn_device_facts_path = Path(args.out_msisdn_device_facts)
    msisdn_text_facts_path = Path(args.out_msisdn_text_facts)
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
    location_rows = write_location_events(
        location_events_path,
        location_events,
        postgres_friendly=args.postgres_friendly,
        null_token=args.null_token,
    )
    ip_rows = write_ip_bindings(
        ip_bindings_path,
        ip_bindings,
        postgres_friendly=args.postgres_friendly,
        null_token=args.null_token,
    )
    user_msisdn_rows = write_user_msisdn_facts(
        user_msisdn_facts_path,
        user_msisdn_facts,
        postgres_friendly=args.postgres_friendly,
    )
    ip_msisdn_rows = write_ip_msisdn_facts(
        ip_msisdn_facts_path,
        ip_msisdn_facts,
        postgres_friendly=args.postgres_friendly,
    )
    msisdn_device_rows = write_msisdn_device_facts(
        msisdn_device_facts_path,
        msisdn_device_facts,
        postgres_friendly=args.postgres_friendly,
    )
    msisdn_text_rows = write_msisdn_text_facts(
        msisdn_text_facts_path,
        msisdn_text_facts,
        postgres_friendly=args.postgres_friendly,
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
        location_events_rows=location_rows,
        ip_bindings_rows=ip_rows,
        user_msisdn_facts_rows=user_msisdn_rows,
        ip_msisdn_facts_rows=ip_msisdn_rows,
        msisdn_device_facts_rows=msisdn_device_rows,
        msisdn_text_facts_rows=msisdn_text_rows,
    )

    print(f"Nodex converter done. Sources processed from: {input_dir}")
    print(f"Discovered sources: {stats.discovered_sources_total}")
    print(f"Unique sources used: {stats.unique_sources_total}")
    print(f"Duplicate sources skipped: {stats.duplicate_sources_skipped}")
    print(f"Rows read: {stats.rows_read_total}")
    print(f"Unique raw events with two abonents: {len(events)}")
    print(f"Events after dedup clustering: {len(clusters)}")
    print(f"Location-only rows: {stats.rows_location_only}")
    print(f"Communications rows written: {communications_rows}")
    print(f"Device history rows written: {device_rows}")
    print(f"Location events rows written: {location_rows}")
    print(f"IP bindings rows written: {ip_rows}")
    print(f"User-MSISDN facts written: {user_msisdn_rows}")
    print(f"IP-MSISDN facts written: {ip_msisdn_rows}")
    print(f"MSISDN-device facts written: {msisdn_device_rows}")
    print(f"MSISDN-text facts written: {msisdn_text_rows}")
    print(f"Communications written to: {communications_path.resolve()}")
    print(f"Device history written to: {device_history_path.resolve()}")
    print(f"Location events written to: {location_events_path.resolve()}")
    print(f"IP bindings written to: {ip_bindings_path.resolve()}")
    print(f"User-MSISDN facts written to: {user_msisdn_facts_path.resolve()}")
    print(f"IP-MSISDN facts written to: {ip_msisdn_facts_path.resolve()}")
    print(f"MSISDN-device facts written to: {msisdn_device_facts_path.resolve()}")
    print(f"MSISDN-text facts written to: {msisdn_text_facts_path.resolve()}")
    print(f"Manifest written to: {manifest_path.resolve()}")


if __name__ == "__main__":
    main()
