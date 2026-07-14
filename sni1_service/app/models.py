from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


class NormalizedEvent(BaseModel):
    ts: datetime
    end_ts: datetime | None = None
    duration_sec: float | None = None

    device_id: str | None = None

    operator: str | None = None
    control_object_id: str | None = None
    subscriber: str | None = None

    src_ip: str | None = None
    src_port: int | None = None
    dst_ip: str | None = None
    dst_port: int | None = None

    nat_ip: str | None = None
    nat_port: int | None = None
    nat_type: str | None = None

    transport_protocol: str | None = None
    app_protocol: str | None = None
    protocol_hint: str | None = None

    sni: str | None = None
    sni_list: list[str] = Field(default_factory=list)
    host: str | None = None
    etld1: str | None = None

    bytes_rx: int = 0
    bytes_tx: int = 0
    bytes_total: int = 0

    cell_id: str | None = None
    cell_address: str | None = None
    cell_azimuth: int | None = None

    flow_id: str | None = None
    task_id: str | None = None
    content_load_errors: str | None = None

    ja3: str | None = None
    cert_self_signed: bool | None = None
    rtt_ms: float | None = None
    payload_bytes: bytes | None = None
    packets_total: int | None = None
    avg_pkt_size: float | None = None

    raw: dict[str, Any] = Field(default_factory=dict)
    source_file: str | None = None
    row_number: int | None = None

    @model_validator(mode="after")
    def _fill_derived_fields(self) -> "NormalizedEvent":
        self.bytes_rx = int(self.bytes_rx or 0)
        self.bytes_tx = int(self.bytes_tx or 0)
        self.bytes_total = self.bytes_rx + self.bytes_tx

        if self.end_ts is not None and self.duration_sec is None:
            self.duration_sec = (self.end_ts - self.ts).total_seconds()

        if self.host is None and self.sni:
            self.host = self.sni

        return self


class EnrichedEvent(NormalizedEvent):
    asn: int | None = None
    as_name: str | None = None

    cloud_provider: str | None = None
    is_cloud: bool = False

    domain_category: str | None = None
    domain_category_confidence: float | None = None
    domain_category_source: str | None = None

    is_messenger: bool = False
    messenger_app: str | None = None
    messenger_confidence: float | None = None

    top_rank: int | None = None
    top_category: str | None = None

    is_alt_dns: bool = False
    alt_dns_provider: str | None = None

    is_vpn_infra_ip: bool = False
    vpn_infra_provider: str | None = None
    vpn_infra_type: str | None = None

    vpn_score: int = 0
    vpn_total_score: int = 0
    vpn_verdict: str = "CLEAN"
    vpn_confidence: float = 0.0
    vpn_methods_triggered: list[str] = Field(default_factory=list)
    vpn_evidence: list[str] = Field(default_factory=list)
    suppression_applied: list[str] = Field(default_factory=list)

    alternative_access_score: int = 0
    alternative_access_methods: list[str] = Field(default_factory=list)
    alternative_access_evidence: list[str] = Field(default_factory=list)


class DataQualityReport(BaseModel):
    total_rows: int = 0
    parsed_rows: int = 0
    skipped_rows: int = 0

    skip_reason_no_timestamp: int = 0
    skip_reason_no_signal: int = 0
    skip_reason_parse_error: int = 0

    rows_with_sni: int = 0
    rows_with_dst_ip: int = 0
    rows_with_bytes: int = 0
    rows_with_protocol: int = 0
    rows_with_end_ts: int = 0

    csv_files_processed: int = 0
    csv_files_failed: int = 0
    encodings_used: dict[str, int] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class ParseResult(BaseModel):
    events: list[NormalizedEvent] = Field(default_factory=list)
    data_quality: DataQualityReport = Field(default_factory=DataQualityReport)


@dataclass
class AnalysisResult:
    document_markdown: str
    tables: dict[str, list[dict]]
    meta: dict[str, Any]
    analytics: dict | None = None
