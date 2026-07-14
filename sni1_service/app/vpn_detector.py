from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import timedelta
from typing import Any

from .detection_models import (
    HARD_SCORE,
    VPN_CLEAN,
    VPN_DETECTED,
    VPN_LIKELY,
    VPN_LIKELY_THRESHOLD,
    VPN_SUSPICIOUS,
    VPN_SUSPICIOUS_THRESHOLD,
    DetectionDecision,
    DetectionResult,
)
from .domain_utils import extract_etld1, normalize_domain
from .enrich import enrich_event
from .models import EnrichedEvent, NormalizedEvent
from .references import ReferenceData, ip_in_network_records, parse_network
from .state import StateManager


def shannon_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = Counter(data)
    length = len(data)
    return -sum((count / length) * math.log2(count / length) for count in counts.values())


class VPNDetector:
    def __init__(self, refs: ReferenceData, state: StateManager | None = None):
        self.refs = refs
        self.state = state
        self._alt_dns_hits_by_ip: dict[str, list] = defaultdict(list)
        self._domain_event_count: Counter[str] = Counter()
        self._domain_ip_count: defaultdict[str, Counter[str]] = defaultdict(Counter)
        self._cloud_lookup_cache: dict[str, Any] = {}
        self._alt_dns_lookup_cache: dict[str, Any] = {}
        self._vpn_infra_lookup_cache: dict[str, Any] = {}
        self._event_ip_network_cache: dict[str, Any] = {}
        self._etld1_cache: dict[str, str | None] = {}
        self._normalized_domain_cache: dict[str, str | None] = {}
        self._custom_pair_networks_by_domain: dict[str, list[Any]] = defaultdict(list)
        for ref_domain, ref_net in self.refs.custom_pairs:
            parsed_ref = parse_network(ref_net)
            if parsed_ref is not None:
                self._custom_pair_networks_by_domain[ref_domain].append(parsed_ref)

    def analyze_event(self, event) -> EnrichedEvent:
        enriched = event if isinstance(event, EnrichedEvent) else enrich_event(event, self.refs)
        self._observe_domain_stats(enriched)

        if self.state is not None:
            self._observe_dns_if_present(enriched)
            self.state.cleanup(enriched.ts)

        hard_results = [
            result
            for result in [
                self.check_ja3_vpn_signature(enriched),
                self.check_vpn_infra_ip(enriched),
                self.check_sni_asn_mismatch(enriched),
                self.check_self_signed_certificate(enriched),
            ]
            if result is not None
        ]

        soft_results = [
            result
            for result in [
                self.check_missing_dns_query(enriched),
                self.check_alt_dns_gateway(enriched),
                self.check_alt_dns_stable_pattern(enriched),
                self.check_monodomain_tunnel_pattern(enriched),
                self.check_sni_ip_behavior_pattern(enriched),
                self.check_long_keepalive(enriched),
                self.check_high_entropy(enriched),
                self.check_rtt_geo_anomaly(enriched),
            ]
            if result is not None
        ]

        decision = self.make_decision(hard_results, soft_results, enriched)
        decision = self.apply_suppression(decision, enriched)

        alt_results = [r for r in soft_results if r.method == "ALT_DNS_GATEWAY_PATTERN" and r.score > 0]

        enriched.vpn_score = decision.total_score
        enriched.vpn_total_score = decision.total_score
        enriched.vpn_verdict = decision.verdict
        enriched.vpn_confidence = decision.confidence
        enriched.vpn_methods_triggered = decision.methods_triggered
        enriched.vpn_evidence = decision.evidence
        enriched.suppression_applied = decision.suppression_applied

        enriched.alternative_access_score = sum(r.score for r in alt_results)
        enriched.alternative_access_methods = [r.method for r in alt_results]
        enriched.alternative_access_evidence = [r.evidence for r in alt_results]

        if self.state is not None and getattr(enriched, "end_ts", None) is not None:
            self.state.observe_flow_end(enriched)

        return enriched

    def check_ja3_vpn_signature(self, event: EnrichedEvent) -> DetectionResult | None:
        ja3 = event.ja3.strip().lower() if isinstance(event.ja3, str) and event.ja3.strip() else None
        if not ja3:
            return None

        vpn_entry = self.refs.vpn_ja3.get(ja3)
        if vpn_entry is None:
            return None

        family = vpn_entry.get("family") or "unknown"
        conf = vpn_entry.get("confidence")
        evidence = f"JA3 matches VPN family: {family}, confidence: {conf}"

        app_entry = self.refs.app_ja3.get(ja3)
        if app_entry is not None:
            app_conf = _to_float(app_entry.get("confidence"))
            if app_conf is not None and app_conf > 0.8:
                app_name = app_entry.get("app_name") or "unknown"
                evidence += f". WARNING: JA3 also appears in legitimate app DB: {app_name}"

        return DetectionResult(
            method="JA3_VPN_SIGNATURE",
            score=HARD_SCORE,
            evidence=evidence,
            confidence=1.0,
            hard=True,
        )

    def check_vpn_infra_ip(self, event: EnrichedEvent) -> DetectionResult | None:
        if not event.dst_ip:
            return None

        provider = event.vpn_infra_provider
        infra_type = event.vpn_infra_type
        confidence = None

        if event.is_vpn_infra_ip:
            if provider is None:
                rec = self._lookup_vpn_infra(event.dst_ip)
                if rec is not None:
                    provider = rec.meta.get("provider")
                    infra_type = rec.meta.get("type")
                    confidence = rec.meta.get("confidence")
        else:
            rec = self._lookup_vpn_infra(event.dst_ip)
            if rec is None:
                return None
            provider = rec.meta.get("provider")
            infra_type = rec.meta.get("type")
            confidence = rec.meta.get("confidence")

        return DetectionResult(
            method="VPN_INFRA_IP_MATCH",
            score=HARD_SCORE,
            evidence=(
                "IP matches known VPN infra: "
                f"provider={provider}, type={infra_type}, confidence={confidence}."
            ),
            confidence=1.0,
            hard=True,
        )

    def check_sni_asn_mismatch(self, event: EnrichedEvent) -> DetectionResult | None:
        if not event.dst_ip:
            return None

        domain = self._normalize_cached(event.sni or event.host)
        etld1 = event.etld1 or self._etld1_cached(domain)
        if not domain or not etld1:
            return None

        expected_asn = self.refs.expected_asn.get(etld1)
        if not expected_asn:
            return None

        if event.is_cloud or self._lookup_cloud(event.dst_ip):
            return None

        actual_asn = event.asn
        as_name = event.as_name
        if actual_asn is None:
            asn_info = self.refs.asn_db.lookup(event.dst_ip)
            if asn_info is None:
                return None
            actual_asn = asn_info.asn
            as_name = asn_info.as_name

        if actual_asn in expected_asn:
            return None

        expected_text = ",".join(str(x) for x in sorted(expected_asn))
        return DetectionResult(
            method="SNI_ASN_MISMATCH",
            score=HARD_SCORE,
            evidence=(
                f"SNI {domain} expected ASN {expected_text}, "
                f"got ASN {actual_asn} ({as_name})."
            ),
            confidence=1.0,
            hard=True,
        )

    def check_self_signed_certificate(self, event: EnrichedEvent) -> DetectionResult | None:
        domain = normalize_domain(event.sni or event.host)
        if event.cert_self_signed is not True:
            return None
        if not domain:
            return None
        if event.top_rank is not None and event.top_rank <= 10000:
            return None

        return DetectionResult(
            method="SELF_SIGNED_CERTIFICATE",
            score=HARD_SCORE,
            evidence="Self-signed certificate on non-top domain.",
            confidence=1.0,
            hard=True,
        )

    def check_sni_ip_behavior_pattern(self, event: EnrichedEvent) -> DetectionResult | None:
        if not event.dst_ip:
            return None

        domain = self._normalize_cached(event.sni or event.host)
        etld1 = event.etld1 or self._etld1_cached(domain)
        event_ip = self._parse_event_ip_cached(event.dst_ip)
        if event_ip is None:
            return None
        for candidate in [domain, etld1]:
            if not candidate:
                continue
            for parsed_ref in self._custom_pair_networks_by_domain.get(candidate, []):
                if event_ip.version != parsed_ref.version:
                    continue
                if event_ip.network_address in parsed_ref:
                    return DetectionResult(
                        method="SNI_IP_BEHAVIOR_PATTERN",
                        score=40,
                        evidence=(
                            "SNI/IP pair matches known suspicious behavior pattern: "
                            f"{candidate} + {event.dst_ip}."
                        ),
                        confidence=0.8,
                        hard=False,
                    )

        return None

    def check_missing_dns_query(self, event: EnrichedEvent) -> DetectionResult | None:
        if self.state is None:
            return None
        if not self.state.dns_resolution_observed:
            return None
        if not (event.src_ip and event.dst_ip and event.ts):
            return None

        matches = self.state.find_dns_before_tls(event.src_ip, event.dst_ip, event.ts, window_sec=60)
        if matches:
            return None

        return DetectionResult(
            method="MISSING_DNS_QUERY",
            score=30,
            evidence="No DNS query resolved this IP within 60s before TLS",
            confidence=0.6,
            hard=False,
        )

    def check_alt_dns_gateway(self, event: EnrichedEvent) -> DetectionResult | None:
        if not event.dst_ip:
            return None

        provider = event.alt_dns_provider
        is_dns_proto = event.dst_port == 53 or (
            bool(event.protocol_hint) and "domain name server" in event.protocol_hint.lower()
        )
        if event.is_alt_dns:
            return DetectionResult(
                method="ALT_DNS_GATEWAY_PATTERN",
                score=25 if is_dns_proto else 15,
                evidence=(
                    f"Alternative DNS gateway pattern detected: {event.dst_ip}, "
                    f"provider={provider}, dns_proto={is_dns_proto}"
                ),
                confidence=0.75 if is_dns_proto else 0.6,
                hard=False,
            )

        rec = self._lookup_alt_dns(event.dst_ip)
        if rec is None:
            return None

        provider = rec.meta.get("provider")
        return DetectionResult(
            method="ALT_DNS_GATEWAY_PATTERN",
            score=25 if is_dns_proto else 15,
            evidence=(
                f"Alternative DNS gateway pattern detected: {event.dst_ip}, "
                f"provider={provider}, dns_proto={is_dns_proto}"
            ),
            confidence=0.75 if is_dns_proto else 0.6,
            hard=False,
        )

    def check_alt_dns_stable_pattern(self, event: EnrichedEvent) -> DetectionResult | None:
        if not event.dst_ip or event.ts is None:
            return None
        is_dns_proto = event.dst_port == 53 or (
            bool(event.protocol_hint) and "domain name server" in event.protocol_hint.lower()
        )
        if not is_dns_proto:
            return None
        if not (event.is_alt_dns or self._lookup_alt_dns(event.dst_ip)):
            return None

        history = self._alt_dns_hits_by_ip[event.dst_ip]
        history.append(event.ts)
        cutoff = event.ts - timedelta(hours=24)
        filtered = [ts for ts in history if ts >= cutoff]
        self._alt_dns_hits_by_ip[event.dst_ip] = filtered
        if len(filtered) < 20:
            return None

        span_sec = (filtered[-1] - filtered[0]).total_seconds()
        unique_minutes = len({ts.strftime("%Y-%m-%d %H:%M") for ts in filtered})
        if span_sec < 600 or unique_minutes < 5:
            return None

        return DetectionResult(
            method="ALT_DNS_STABLE_PATTERN",
            score=20,
            evidence=(
                f"Stable alternative DNS pattern for {event.dst_ip}: "
                f"events_24h={len(filtered)}, span_min={int(span_sec // 60)}, "
                f"active_minutes={unique_minutes}."
            ),
            confidence=0.72,
            hard=False,
        )

    def check_monodomain_tunnel_pattern(self, event: EnrichedEvent) -> DetectionResult | None:
        domain = normalize_domain(event.sni or event.host)
        if not domain:
            return None
        total = int(sum(self._domain_event_count.values()))
        if total < 500:
            return None
        domain_events = int(self._domain_event_count.get(domain, 0))
        if domain_events < 500:
            return None
        share = domain_events / max(total, 1)
        if share < 0.35:
            return None
        top_ip, top_ip_events = self._domain_ip_count[domain].most_common(1)[0]
        if (top_ip_events / max(domain_events, 1)) < 0.8:
            return None
        return DetectionResult(
            method="MONODOMAIN_TUNNEL_PATTERN",
            score=30,
            evidence=(
                f"High concentration on single domain/IP: domain={domain}, "
                f"domain_share={share:.2f}, top_ip={top_ip}, top_ip_share={top_ip_events / max(domain_events, 1):.2f}."
            ),
            confidence=0.7,
            hard=False,
        )

    def _observe_domain_stats(self, event: EnrichedEvent) -> None:
        domain = self._normalize_cached(event.sni or event.host)
        if not domain:
            return
        self._domain_event_count[domain] += 1
        if event.dst_ip:
            self._domain_ip_count[domain][event.dst_ip] += 1

    def check_long_keepalive(self, event: EnrichedEvent) -> DetectionResult | None:
        if event.duration_sec is None or event.avg_pkt_size is None or event.packets_total is None:
            return None

        if event.duration_sec > 3600 and event.avg_pkt_size < 300 and event.packets_total > 100:
            return DetectionResult(
                method="LONG_KEEPALIVE",
                score=25,
                evidence=(
                    f"Session duration {event.duration_sec}s with "
                    f"small avg packet size {event.avg_pkt_size}B."
                ),
                confidence=0.65,
                hard=False,
            )
        return None

    def check_high_entropy(self, event: EnrichedEvent) -> DetectionResult | None:
        if event.payload_bytes is None:
            return None

        entropy = shannon_entropy(event.payload_bytes)
        if entropy <= 7.5:
            return None

        return DetectionResult(
            method="HIGH_ENTROPY",
            score=25,
            evidence=f"Payload entropy {entropy:.2f} > 7.5.",
            confidence=0.7,
            hard=False,
            meta={"entropy": entropy},
        )

    def check_rtt_geo_anomaly(self, event: EnrichedEvent) -> DetectionResult | None:
        if event.rtt_ms is None:
            return None
        # Rule is only active when geo-ASN reference data is available.
        if not hasattr(self.refs, "asn_geo"):
            return None
        return None

    def make_decision(
        self,
        hard_results: list[DetectionResult],
        soft_results: list[DetectionResult],
        event: EnrichedEvent,
    ) -> DetectionDecision:
        del event
        hard_positive = [r for r in hard_results if r.score > 0]
        soft_positive = [r for r in soft_results if r.score > 0]

        if hard_positive:
            all_results = hard_positive + soft_positive
            return DetectionDecision(
                verdict=VPN_DETECTED,
                total_score=HARD_SCORE,
                confidence=1.0,
                methods_triggered=[r.method for r in all_results],
                evidence=[r.evidence for r in all_results],
                suppression_applied=[],
            )

        total = sum(r.score for r in soft_positive)
        if total >= VPN_LIKELY_THRESHOLD:
            verdict = VPN_LIKELY
        elif total >= VPN_SUSPICIOUS_THRESHOLD:
            verdict = VPN_SUSPICIOUS
        else:
            verdict = VPN_CLEAN

        return DetectionDecision(
            verdict=verdict,
            total_score=total,
            confidence=min(total / 100, 1.0),
            methods_triggered=[r.method for r in soft_positive],
            evidence=[r.evidence for r in soft_positive],
            suppression_applied=[],
        )

    def apply_suppression(self, decision: DetectionDecision, event: EnrichedEvent) -> DetectionDecision:
        if decision.verdict == VPN_DETECTED:
            return decision

        if event.is_cloud and decision.methods_triggered == ["MISSING_DNS_QUERY"]:
            decision.verdict = VPN_CLEAN
            decision.total_score = 0
            decision.confidence = 0.0
            decision.suppression_applied.append("CLOUD_DNS_SUPPRESSION")

        category = (event.domain_category or event.top_category or "").lower()
        blocked = {"proxy/anonymizer", "proxy", "vpn", "unknown"}
        if (
            decision.verdict != VPN_DETECTED
            and event.top_rank is not None
            and event.top_rank <= 500
            and category not in blocked
        ):
            self._downgrade_decision(decision)
            decision.suppression_applied.append("TOP_DOMAIN_SUPPRESSION")

        if decision.verdict != VPN_DETECTED and event.is_messenger:
            self._downgrade_decision(decision)
            decision.suppression_applied.append("MESSAGING_SUPPRESSION")
            decision.evidence.append("SNI matches known messaging service, suppressing.")

        return decision

    @staticmethod
    def _downgrade_decision(decision: DetectionDecision) -> None:
        if decision.verdict == VPN_LIKELY:
            decision.verdict = VPN_SUSPICIOUS
            decision.confidence *= 0.5
            return

        if decision.verdict == VPN_SUSPICIOUS:
            decision.verdict = VPN_CLEAN
            decision.confidence = 0.0
            decision.total_score = 0

    def _observe_dns_if_present(self, event: EnrichedEvent) -> None:
        if self.state is None:
            return

        is_dns = (event.dst_port == 53) or (
            bool(event.protocol_hint) and "domain name server" in event.protocol_hint.lower()
        )
        if not is_dns:
            return

        queried_names = list(event.sni_list)
        if not queried_names and event.sni:
            queried_names = [event.sni]

        resolved_ips = self._extract_resolved_ips(event)
        self.state.observe_dns(event.src_ip, queried_names, resolved_ips, event.ts)

    @staticmethod
    def _extract_resolved_ips(event: EnrichedEvent) -> list[str]:
        raw = event.raw or {}
        keys = ["resolved_ips", "resolved_ip", "dns_answer", "dns_answers", "answer_ip"]
        values: list[str] = []

        for key in keys:
            value = raw.get(key)
            if value is None:
                continue
            if isinstance(value, list):
                values.extend(str(v) for v in value)
            else:
                values.extend(str(value).split(","))

        cleaned: list[str] = []
        for item in values:
            candidate = item.strip()
            if candidate:
                cleaned.append(candidate)
        return cleaned

    def _lookup_cloud(self, ip: str):
        if ip not in self._cloud_lookup_cache:
            self._cloud_lookup_cache[ip] = ip_in_network_records(ip, self.refs.cloud_networks)
        return self._cloud_lookup_cache[ip]

    def _lookup_alt_dns(self, ip: str):
        if ip not in self._alt_dns_lookup_cache:
            self._alt_dns_lookup_cache[ip] = ip_in_network_records(ip, self.refs.alt_dns_networks)
        return self._alt_dns_lookup_cache[ip]

    def _lookup_vpn_infra(self, ip: str):
        if ip not in self._vpn_infra_lookup_cache:
            self._vpn_infra_lookup_cache[ip] = ip_in_network_records(ip, self.refs.vpn_infra_networks)
        return self._vpn_infra_lookup_cache[ip]

    def _parse_event_ip_cached(self, ip: str):
        if ip not in self._event_ip_network_cache:
            self._event_ip_network_cache[ip] = parse_network(ip)
        return self._event_ip_network_cache[ip]

    def _normalize_cached(self, domain: str | None) -> str | None:
        key = str(domain or "")
        if key not in self._normalized_domain_cache:
            self._normalized_domain_cache[key] = normalize_domain(domain)
        return self._normalized_domain_cache[key]

    def _etld1_cached(self, domain: str | None) -> str | None:
        key = str(domain or "")
        if key not in self._etld1_cache:
            self._etld1_cache[key] = extract_etld1(domain, self.refs) if domain else None
        return self._etld1_cache[key]


def analyze_events(
    events: list[NormalizedEvent | EnrichedEvent],
    refs: ReferenceData,
    state: StateManager | None = None,
) -> list[EnrichedEvent]:
    detector = VPNDetector(refs, state)
    return [detector.analyze_event(e) for e in events]


def detect_vpn_for_events(
    events: list[NormalizedEvent | EnrichedEvent],
    refs: ReferenceData,
    state: StateManager | None = None,
) -> list[EnrichedEvent]:
    detector = VPNDetector(refs, state)
    return [detector.analyze_event(e) for e in events]


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
