from __future__ import annotations

import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent))
from vpn_detector import ReferenceData, VPNDetector


def _write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def _build_refs(tmp_path: Path) -> ReferenceData:
    _write(tmp_path / "vpn_ja3_signatures.csv", "ja3_hash,family,confidence\nvpn_ja3_hash,WireGuard,0.99\n")
    _write(
        tmp_path / "ja3_app_db_full.csv",
        "ja3_hash,app_name,notes,confidence\napp_ja3_hash,Chrome,browser,0.99\nvpn_note_hash,Unknown,looks like openvpn,0.8\n",
    )
    _write(
        tmp_path / "vpn_infra_ioc.csv",
        "cidr,provider,type\n203.0.113.0/24,TestVPN,exit\n",
    )
    _write(
        tmp_path / "vpn_infra_ioc_full.csv",
        "cidr,provider,type\n198.51.100.10/32,AnotherVPN,relay\n",
    )
    _write(tmp_path / "expected_asn_map.json", json.dumps({"example.com": ["AS111"]}, ensure_ascii=False))
    _write(tmp_path / "expected_asn_map_full.csv", "domain,expected_asn\nexample.net,AS222\n")
    _write(tmp_path / "cloud_prefixes.json", json.dumps(["198.18.0.0/15"], ensure_ascii=False))
    _write(tmp_path / "cloud_prefixes_full.json", json.dumps(["192.0.2.0/24"], ensure_ascii=False))
    _write(
        tmp_path / "asn_db.csv",
        "start_ip,end_ip,asn,asn_name,country\n203.0.113.0,203.0.113.255,333,VPN ASN,US\n93.184.216.0,93.184.216.255,555,Example ASN,US\n",
    )
    _write(tmp_path / "public_suffix_list.dat", "// minimal\ncom\nnet\n")
    _write(tmp_path / "known_messaging_domains.csv", "domain\ntelegram.org\n")
    _write(tmp_path / "top-1m.csv", "rank,domain,category\n1,example.com,General\n2,google.com,Search\n")

    cfg = {
        "vpn_ja3_signatures": str(tmp_path / "vpn_ja3_signatures.csv"),
        "ja3_app_db_full": str(tmp_path / "ja3_app_db_full.csv"),
        "vpn_infra_ioc": str(tmp_path / "vpn_infra_ioc.csv"),
        "vpn_infra_ioc_full": str(tmp_path / "vpn_infra_ioc_full.csv"),
        "expected_asn_map": str(tmp_path / "expected_asn_map.json"),
        "expected_asn_map_full": str(tmp_path / "expected_asn_map_full.csv"),
        "cloud_prefixes": str(tmp_path / "cloud_prefixes.json"),
        "cloud_prefixes_full": str(tmp_path / "cloud_prefixes_full.json"),
        "asn_db": str(tmp_path / "asn_db.csv"),
        "public_suffix_list": str(tmp_path / "public_suffix_list.dat"),
        "known_messaging_domains": str(tmp_path / "known_messaging_domains.csv"),
        "top_1m": str(tmp_path / "top-1m.csv"),
    }
    refs = ReferenceData(cfg)
    refs.load()
    return refs


def test_hard_ja3_signature(tmp_path: Path) -> None:
    detector = VPNDetector(_build_refs(tmp_path))
    event = {"timestamp": "2026-04-27 10:00:00", "ja3": "vpn_ja3_hash", "dst_ip": "8.8.8.8"}
    out = detector.score_event(event)
    assert out["vpn_verdict"] == "VPN_DETECTED"
    assert out["vpn_score"] == 100


def test_hard_ioc_ip_match(tmp_path: Path) -> None:
    detector = VPNDetector(_build_refs(tmp_path))
    event = {"timestamp": "2026-04-27 10:00:00", "dst_ip": "203.0.113.77", "sni": "foo.bar"}
    out = detector.score_event(event)
    assert out["vpn_verdict"] == "VPN_DETECTED"
    assert any("VPN_INFRA_IP_MATCH" in e for e in out["vpn_evidence"])


def test_asn_mismatch_detection(tmp_path: Path) -> None:
    detector = VPNDetector(_build_refs(tmp_path))
    event = {"timestamp": "2026-04-27 10:00:00", "sni": "example.com", "dst_ip": "203.0.113.88"}
    out = detector.score_event(event)
    assert out["vpn_verdict"] == "VPN_DETECTED"
    assert any("SNI_ASN_MISMATCH" in e for e in out["vpn_evidence"])


def test_soft_scoring_suspicious(tmp_path: Path) -> None:
    detector = VPNDetector(_build_refs(tmp_path))
    event = {
        "timestamp": "2026-04-27 10:00:00",
        "sni": "unknown.site",
        "dst_ip": "93.184.216.20",
        "protocol": "tls",
        "duration_sec": 3700,
        "packet_count": 120,
        "avg_packet_size": 120,
    }
    out = detector.score_event(event)
    assert out["vpn_verdict"] in {"VPN_SUSPICIOUS", "VPN_LIKELY"}
    assert out["vpn_score"] > 0


def test_custom_pair_hard_match(tmp_path: Path) -> None:
    detector = VPNDetector(_build_refs(tmp_path))
    event = {"timestamp": "2026-04-27 10:00:00", "sni": "www.amd.com", "dst_ip": "109.206.236.170"}
    out = detector.score_event(event)
    assert out["vpn_verdict"] == "VPN_DETECTED"
    assert any("CUSTOM_PAIR_MATCH" in e for e in out["vpn_evidence"])


def test_alt_dns_gateway_soft_signal(tmp_path: Path) -> None:
    detector = VPNDetector(_build_refs(tmp_path))
    event = {"timestamp": "2026-04-27 10:00:00", "sni": "example.org", "dst_ip": "176.99.11.77", "protocol": "tls"}
    out = detector.score_event(event)
    assert out["vpn_score"] >= 20
    assert any("ALT_DNS_GATEWAY" in e for e in out["vpn_evidence"])
