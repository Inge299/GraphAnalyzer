from __future__ import annotations

import csv
import io
import os
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterable, TextIO

from .data_quality import add_parsed_event_quality, mark_skip
from .domain_utils import extract_device_id_from_filename
from .models import DataQualityReport, ParseResult
from .normalizer import normalize_row, resolve_column_map
from .utils import get_logger, log_event

SUPPORTED_ENCODINGS = ("utf-8-sig", "cp1251", "latin-1")
CSV_DELIMITER = ";"
CSV_QUOTECHAR = '"'
CSV_EXTRAS_KEY = "__extra__"


def _decode_with_fallback(payload: bytes) -> tuple[str, str]:
    last_error: Exception | None = None
    for enc in SUPPORTED_ENCODINGS:
        try:
            return payload.decode(enc), enc
        except UnicodeDecodeError as exc:
            last_error = exc
            continue
    if last_error is not None:
        raise last_error
    raise UnicodeDecodeError("unknown", b"", 0, 1, "No encoding candidates available")


def _detect_encoding(sample: bytes) -> str:
    for enc in SUPPORTED_ENCODINGS:
        try:
            sample.decode(enc)
            return enc
        except UnicodeDecodeError:
            continue
    return SUPPORTED_ENCODINGS[-1]


def _parse_csv_text_stream(
    text_stream: TextIO,
    *,
    source_file: str,
    default_device_id: str | None,
    quality: DataQualityReport,
    include_raw: bool,
) -> list:
    reader = csv.DictReader(
        text_stream,
        delimiter=CSV_DELIMITER,
        quotechar=CSV_QUOTECHAR,
        restkey=CSV_EXTRAS_KEY,
        restval=None,
    )
    column_map = resolve_column_map(reader.fieldnames)

    events = []
    for row_idx, row in enumerate(reader, start=2):
        quality.total_rows += 1
        if row.get(CSV_EXTRAS_KEY):
            quality.warnings.append(
                f"{source_file}: row {row_idx} has extra columns ({len(row[CSV_EXTRAS_KEY])})"
            )

        try:
            event, skip_reason = normalize_row(
                row,
                column_map,
                source_file=source_file,
                row_number=row_idx,
                default_device_id=default_device_id,
                include_raw=include_raw,
            )

            if event is None:
                mark_skip(quality, skip_reason or "parse_error")
                continue

            quality.parsed_rows += 1
            add_parsed_event_quality(quality, event)
            events.append(event)
        except Exception as exc:
            mark_skip(quality, "parse_error")
            quality.warnings.append(f"{source_file}: row {row_idx} parse error: {exc}")

    return events


def _parse_csv_payload(
    payload: bytes,
    *,
    source_file: str,
    default_device_id: str | None,
    quality: DataQualityReport,
    include_raw: bool,
) -> list:
    if not payload.strip():
        quality.warnings.append(f"CSV is empty: {source_file}")
        return []

    decoded, encoding = _decode_with_fallback(payload)
    quality.encodings_used[encoding] = quality.encodings_used.get(encoding, 0) + 1
    return _parse_csv_text_stream(
        io.StringIO(decoded),
        source_file=source_file,
        default_device_id=default_device_id,
        quality=quality,
        include_raw=include_raw,
    )


def parse_input(input_path: str | Path, device_id: str | None = None) -> ParseResult:
    """Parse CSV or ZIP input into normalized events and data quality report."""
    logger = get_logger(__name__)
    path = Path(input_path)
    suffix = path.suffix.lower()

    if not path.exists():
        raise FileNotFoundError(f"Input path does not exist: {path}")

    quality = DataQualityReport()
    events = []
    include_raw = os.getenv("SNI_KEEP_RAW", "0").strip() in {"1", "true", "yes"}

    log_event(logger, "parse_input.start", input_path=str(path), suffix=suffix)

    if suffix == ".csv":
        payload = path.read_bytes()
        inferred_device_id = device_id or extract_device_id_from_filename(path.name)
        try:
            events.extend(
                _parse_csv_payload(
                    payload,
                    source_file=str(path),
                    default_device_id=inferred_device_id,
                    quality=quality,
                    include_raw=include_raw,
                )
            )
            quality.csv_files_processed += 1
        except Exception as exc:
            quality.csv_files_failed += 1
            quality.warnings.append(f"Failed to parse CSV {path}: {exc}")

    elif suffix == ".zip":
        zip_device_id = device_id or extract_device_id_from_filename(path.name)
        try:
            with zipfile.ZipFile(path, "r") as zf:
                csv_members = []
                for member in zf.infolist():
                    if member.is_dir():
                        continue
                    normalized_name = member.filename.replace("\\", "/")
                    pure = PurePosixPath(normalized_name)
                    if pure.is_absolute() or ".." in pure.parts:
                        quality.warnings.append(f"Skipping unsafe ZIP member path: {member.filename}")
                        continue
                    if normalized_name.lower().endswith(".csv"):
                        csv_members.append(member)

                if not csv_members:
                    raise ValueError(f"ZIP archive does not contain CSV files: {path}")

                log_event(
                    logger,
                    "parse_input.zip_members",
                    input_path=str(path),
                    csv_members=[m.filename for m in csv_members],
                )

                for member in csv_members:
                    try:
                        with zf.open(member, "r") as sample_stream:
                            sample = sample_stream.read(65536)
                        encoding = _detect_encoding(sample)
                        quality.encodings_used[encoding] = quality.encodings_used.get(encoding, 0) + 1

                        with zf.open(member, "r") as bin_stream:
                            text_stream = io.TextIOWrapper(bin_stream, encoding=encoding, newline="")
                            member_device_id = (
                                device_id
                                or extract_device_id_from_filename(member.filename)
                                or zip_device_id
                            )
                            events.extend(
                                _parse_csv_text_stream(
                                    text_stream,
                                    source_file=f"{path}!{member.filename}",
                                    default_device_id=member_device_id,
                                    quality=quality,
                                    include_raw=include_raw,
                                )
                            )
                            text_stream.detach()
                        quality.csv_files_processed += 1
                    except Exception as exc:
                        quality.csv_files_failed += 1
                        quality.warnings.append(
                            f"Failed to parse CSV member {member.filename} in {path}: {exc}"
                        )
        except zipfile.BadZipFile as exc:
            raise ValueError(f"Invalid ZIP archive: {path}") from exc

    else:
        raise ValueError("Unsupported input format. Expected .csv or .zip")

    quality.skipped_rows = (
        quality.skip_reason_no_timestamp
        + quality.skip_reason_no_signal
        + quality.skip_reason_parse_error
    )

    log_event(
        logger,
        "parse_input.done",
        input_path=str(path),
        csv_files_processed=quality.csv_files_processed,
        csv_files_failed=quality.csv_files_failed,
        total_rows=quality.total_rows,
        parsed_rows=quality.parsed_rows,
        skipped_rows=quality.skipped_rows,
        encodings_used=quality.encodings_used,
        warnings_count=len(quality.warnings),
    )

    return ParseResult(events=events, data_quality=quality)
