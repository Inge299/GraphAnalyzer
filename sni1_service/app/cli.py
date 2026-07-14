from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .analytics import analyze_input


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="sni_traffic_report")
    sub = parser.add_subparsers(dest="command", required=True)

    analyze = sub.add_parser("analyze", help="Run full SNI traffic analysis")
    analyze.add_argument("--input", required=True, dest="input_path")
    analyze.add_argument("--device-id", default=None)
    analyze.add_argument("--refs-dir", default=None)
    analyze.add_argument("--top-n", type=int, default=None)
    analyze.add_argument("--gap-minutes", type=int, default=None)
    analyze.add_argument("--document-title", default=None)
    analyze.add_argument("--console-title", default=None)
    analyze.add_argument("--out", default=None)
    analyze.add_argument("--tables-out", default=None)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command != "analyze":
        parser.error("Unsupported command")

    if (args.top_n is not None and args.top_n <= 0) or (args.gap_minutes is not None and args.gap_minutes <= 0):
        print("top-n and gap-minutes must be > 0", file=sys.stderr)
        return 2

    try:
        result = analyze_input(
            input_path=args.input_path,
            device_id=args.device_id,
            top_n=args.top_n,
            gap_minutes=args.gap_minutes,
            document_title=args.document_title,
            console_title=args.console_title,
            refs_dir=args.refs_dir,
        )
    except Exception as exc:
        print(f"analysis failed: {exc}", file=sys.stderr)
        return 1

    if args.out:
        Path(args.out).write_text(result.document_markdown, encoding="utf-8")
    else:
        print(result.document_markdown)

    if args.tables_out:
        Path(args.tables_out).write_text(json.dumps(result.tables, ensure_ascii=False, indent=2), encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
