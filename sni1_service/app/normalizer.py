from __future__ import annotations

from typing import Any

from .data_quality import has_useful_signal
from .domain_utils import extract_etld1, parse_endpoint, parse_sni_list
from .models import NormalizedEvent
from .utils import clean_text, normalize_header, parse_datetime, parse_int

COLUMN_ALIASES: dict[str, list[str]] = {
    "ts": [
        "Время начала соединения",
        "время начала соединения",
        "start_time",
        "timestamp",
        "ts",
    ],
    "end_ts": ["Время завершения соединения", "end_time", "end_ts"],
    "operator": ["Оператор", "operator"],
    "cell_id": ["Ид.точки подключения", "cell_id", "connection_point_id"],
    "src_endpoint": [
        "IP-адрес/порт клиента",
        "client_endpoint",
        "src_endpoint",
        "source",
    ],
    "src_port": ["Порт клиента", "src_port", "client_port"],
    "dst_endpoint": [
        "IP-адрес/порт сервера",
        "server_endpoint",
        "dst_endpoint",
        "destination",
    ],
    "dst_port": ["Порт сервера", "dst_port", "server_port"],
    "protocol_hint": ["RFC1700", "protocol", "protocol_hint"],
    "bytes_rx": [
        "Принято данных, байт",
        "bytes_rx",
        "rx_bytes",
        "received_bytes",
    ],
    "bytes_tx": [
        "Передано данных, байт",
        "bytes_tx",
        "tx_bytes",
        "sent_bytes",
    ],
    "app_protocol": ["Прикладной протокол", "app_protocol", "application_protocol"],
    "sni": ["SSL SNI", "SNI", "sni", "host", "domain", "url"],
    "control_object_id": ["Ид.объекта контроля", "control_object_id"],
    "subscriber": ["Абонент", "subscriber"],
    "nat_endpoint": ["NAT-адрес/порт", "nat_endpoint"],
    "nat_type": ["Тип NAT", "nat_type"],
    "flow_id": ["Ид.потока", "flow_id"],
    "task_id": ["Ид. задачи (контент)", "task_id"],
    "content_load_errors": ["Ошибки загрузки содержимого", "content_load_errors"],
    "cell_address": ["Адрес БС абонента", "cell_address"],
    "cell_azimuth": ["Азимут антенны абонента", "cell_azimuth"],
    "comment": ["Комментарий", "comment"],
}


def resolve_column_map(headers: list[str] | None) -> dict[str, str]:
    if not headers:
        return {}

    normalized_to_actual = {normalize_header(h): h for h in headers}
    resolved: dict[str, str] = {}

    for target, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            matched = normalized_to_actual.get(normalize_header(alias))
            if matched is not None:
                resolved[target] = matched
                break

    return resolved


def _get(row: dict[str, Any], mapping: dict[str, str], key: str) -> Any:
    col = mapping.get(key)
    if col is None:
        return None
    return row.get(col)


def _extract_transport_protocol(*values: str | None) -> str | None:
    for value in values:
        if not value:
            continue
        lowered = value.lower()
        if "tcp" in lowered:
            return "TCP"
        if "udp" in lowered:
            return "UDP"
    return None


def _normalize_protocol_hint(*candidates: str | None) -> str | None:
    for value in candidates:
        if not value:
            continue
        lowered = value.lower()
        if "domain name server" in lowered:
            return "Domain Name Server"
        if "http protocol over tls/ssl" in lowered:
            return "http protocol over TLS/SSL"

    for value in candidates:
        if not value:
            continue
        lowered = value.lower()
        if lowered in {"tcp", "udp", "https"}:
            continue
        if parse_int(value) is not None:
            continue
        if value.startswith("{") and value.endswith("}"):
            continue
        return value

    return None


def normalize_row(
    row: dict[str, Any],
    column_map: dict[str, str],
    *,
    source_file: str,
    row_number: int,
    default_device_id: str | None = None,
    include_raw: bool = True,
) -> tuple[NormalizedEvent | None, str | None]:
    ts = parse_datetime(_get(row, column_map, "ts"))
    if ts is None:
        return (None, "no_timestamp")

    end_ts = parse_datetime(_get(row, column_map, "end_ts"))

    src_ip, src_port_from_endpoint = parse_endpoint(str(_get(row, column_map, "src_endpoint") or ""))
    src_port = src_port_from_endpoint if src_port_from_endpoint is not None else parse_int(_get(row, column_map, "src_port"))

    dst_endpoint_raw = _get(row, column_map, "dst_endpoint")
    dst_port_raw = _get(row, column_map, "dst_port")
    dst_ip, dst_port_from_endpoint = parse_endpoint(str(dst_endpoint_raw or ""))
    dst_port = dst_port_from_endpoint if dst_port_from_endpoint is not None else parse_int(dst_port_raw)

    nat_ip, nat_port = parse_endpoint(str(_get(row, column_map, "nat_endpoint") or ""))

    protocol_hint_raw = clean_text(_get(row, column_map, "protocol_hint"), treat_zero_as_null=True)
    app_protocol_raw = clean_text(_get(row, column_map, "app_protocol"), treat_zero_as_null=True)
    sni_raw = clean_text(_get(row, column_map, "sni"), treat_zero_as_null=True)
    comment_raw = clean_text(_get(row, column_map, "comment"), treat_zero_as_null=True)

    transport_protocol = _extract_transport_protocol(app_protocol_raw, sni_raw)

    app_protocol: str | None = None
    for candidate in (app_protocol_raw, protocol_hint_raw):
        if candidate and "https" in candidate.lower():
            app_protocol = "HTTPS"
            break

    if app_protocol is None and app_protocol_raw:
        lowered = app_protocol_raw.lower()
        if lowered not in {"tcp", "udp"} and parse_int(app_protocol_raw) is None:
            if not (app_protocol_raw.startswith("{") and app_protocol_raw.endswith("}")):
                app_protocol = app_protocol_raw

    protocol_hint = _normalize_protocol_hint(protocol_hint_raw, clean_text(dst_port_raw), app_protocol_raw)

    sni_list = parse_sni_list(sni_raw or "")
    if not sni_list and comment_raw:
        sni_list = parse_sni_list(comment_raw)
    sni = sni_list[0] if sni_list else None

    bytes_rx = parse_int(_get(row, column_map, "bytes_rx"))
    bytes_tx = parse_int(_get(row, column_map, "bytes_tx"))

    # Some SORM exports are shifted by one column near byte counters.
    next_numeric = parse_int(app_protocol_raw)
    if bytes_rx is None and bytes_tx is not None and next_numeric is not None:
        bytes_rx = bytes_tx
        bytes_tx = next_numeric

    event = NormalizedEvent(
        ts=ts,
        end_ts=end_ts,
        device_id=default_device_id,
        operator=clean_text(_get(row, column_map, "operator")),
        control_object_id=clean_text(_get(row, column_map, "control_object_id")),
        subscriber=clean_text(_get(row, column_map, "subscriber")),
        src_ip=src_ip,
        src_port=src_port,
        dst_ip=dst_ip,
        dst_port=dst_port,
        nat_ip=nat_ip,
        nat_port=nat_port,
        nat_type=clean_text(_get(row, column_map, "nat_type"), treat_zero_as_null=True),
        transport_protocol=transport_protocol,
        app_protocol=app_protocol,
        protocol_hint=protocol_hint,
        sni=sni,
        sni_list=sni_list,
        host=sni,
        etld1=extract_etld1(sni),
        bytes_rx=bytes_rx or 0,
        bytes_tx=bytes_tx or 0,
        cell_id=clean_text(_get(row, column_map, "cell_id")),
        cell_address=clean_text(_get(row, column_map, "cell_address")),
        cell_azimuth=parse_int(_get(row, column_map, "cell_azimuth")),
        flow_id=clean_text(_get(row, column_map, "flow_id")),
        task_id=clean_text(_get(row, column_map, "task_id")),
        content_load_errors=clean_text(_get(row, column_map, "content_load_errors")),
        raw={str(k): v for k, v in row.items()} if include_raw else {},
        source_file=source_file,
        row_number=row_number,
    )

    if not has_useful_signal(event):
        return (None, "no_signal")

    return (event, None)
