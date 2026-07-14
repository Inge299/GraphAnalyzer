from __future__ import annotations

from .models import DataQualityReport, NormalizedEvent


def add_parsed_event_quality(report: DataQualityReport, event: NormalizedEvent) -> None:
    if event.sni:
        report.rows_with_sni += 1
    if event.dst_ip:
        report.rows_with_dst_ip += 1
    if event.bytes_total > 0:
        report.rows_with_bytes += 1
    if event.transport_protocol or event.app_protocol or event.protocol_hint:
        report.rows_with_protocol += 1
    if event.end_ts is not None:
        report.rows_with_end_ts += 1


def mark_skip(report: DataQualityReport, reason: str) -> None:
    report.skipped_rows += 1
    if reason == "no_timestamp":
        report.skip_reason_no_timestamp += 1
    elif reason == "no_signal":
        report.skip_reason_no_signal += 1
    else:
        report.skip_reason_parse_error += 1


def has_useful_signal(event: NormalizedEvent) -> bool:
    return any(
        [
            bool(event.sni),
            bool(event.dst_ip),
            bool(event.protocol_hint),
            bool(event.app_protocol),
            bool(event.transport_protocol),
            event.bytes_total > 0,
        ]
    )
