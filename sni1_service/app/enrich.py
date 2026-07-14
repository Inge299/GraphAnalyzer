from __future__ import annotations

from .categorizer import DomainCategorizer, MessengerDetector
from .domain_utils import extract_etld1, normalize_domain
from .models import EnrichedEvent, NormalizedEvent
from .references import ReferenceData, ip_in_network_records


def enrich_event(
    event: NormalizedEvent,
    refs: ReferenceData,
    categorizer: DomainCategorizer | None = None,
    messenger_detector: MessengerDetector | None = None,
    cloud_record=None,
    alt_dns_record=None,
    vpn_record=None,
) -> EnrichedEvent:
    primary_domain = normalize_domain(event.sni or event.host)
    etld1 = extract_etld1(primary_domain, refs)

    asn = None
    as_name = None
    cloud_provider = None
    is_cloud = False
    is_alt_dns = False
    alt_dns_provider = None
    is_vpn_infra_ip = False
    vpn_infra_provider = None
    vpn_infra_type = None

    if event.dst_ip:
        asn_info = refs.asn_db.lookup(event.dst_ip)
        if asn_info is not None:
            asn = asn_info.asn
            as_name = asn_info.as_name

        if cloud_record is None:
            cloud_record = ip_in_network_records(event.dst_ip, refs.cloud_networks)
        if cloud_record is not None:
            cloud_provider = cloud_record.meta.get("provider")
            is_cloud = True

        if alt_dns_record is None:
            alt_dns_record = ip_in_network_records(event.dst_ip, refs.alt_dns_networks)
        if alt_dns_record is not None:
            is_alt_dns = True
            alt_dns_provider = alt_dns_record.meta.get("provider")

        if vpn_record is None:
            vpn_record = ip_in_network_records(event.dst_ip, refs.vpn_infra_networks)
        if vpn_record is not None:
            is_vpn_infra_ip = True
            vpn_infra_provider = vpn_record.meta.get("provider")
            vpn_infra_type = vpn_record.meta.get("type")

    if categorizer is None:
        categorizer = DomainCategorizer(refs)
    category_result = categorizer.categorize(primary_domain)

    if messenger_detector is None:
        messenger_detector = MessengerDetector(refs)
    messenger_result = messenger_detector.detect(primary_domain)

    top_record = None
    if primary_domain:
        top_record = refs.top_domains.get(primary_domain)
    if top_record is None and etld1:
        top_record = refs.top_domains.get(etld1)

    enriched_data = event.model_dump()
    enriched_data.update(
        {
            "etld1": etld1,
            "asn": asn,
            "as_name": as_name,
            "cloud_provider": cloud_provider,
            "is_cloud": is_cloud,
            "domain_category": category_result.category,
            "domain_category_confidence": category_result.confidence,
            "domain_category_source": category_result.source,
            "is_messenger": messenger_result.is_messenger,
            "messenger_app": messenger_result.app_name,
            "messenger_confidence": messenger_result.confidence,
            "top_rank": top_record.rank if top_record else None,
            "top_category": top_record.category if top_record else None,
            "is_alt_dns": is_alt_dns,
            "alt_dns_provider": alt_dns_provider,
            "is_vpn_infra_ip": is_vpn_infra_ip,
            "vpn_infra_provider": vpn_infra_provider,
            "vpn_infra_type": vpn_infra_type,
        }
    )
    return EnrichedEvent(**enriched_data)


def enrich_events(events: list[NormalizedEvent], refs: ReferenceData) -> list[EnrichedEvent]:
    categorizer = DomainCategorizer(refs)
    messenger_detector = MessengerDetector(refs)
    cloud_cache: dict[str, object] = {}
    alt_dns_cache: dict[str, object] = {}
    vpn_cache: dict[str, object] = {}
    asn_cache: dict[str, object] = {}
    domain_cache: dict[str, dict] = {}
    enriched_events: list[EnrichedEvent] = []

    for event in events:
        primary_domain = normalize_domain(event.sni or event.host)
        if primary_domain not in domain_cache:
            etld1 = extract_etld1(primary_domain, refs)
            category_result = categorizer.categorize(primary_domain)
            messenger_result = messenger_detector.detect(primary_domain)
            top_record = refs.top_domains.get(primary_domain) or (refs.top_domains.get(etld1) if etld1 else None)
            domain_cache[primary_domain] = {
                "etld1": etld1,
                "domain_category": category_result.category,
                "domain_category_confidence": category_result.confidence,
                "domain_category_source": category_result.source,
                "is_messenger": messenger_result.is_messenger,
                "messenger_app": messenger_result.app_name,
                "messenger_confidence": messenger_result.confidence,
                "top_rank": top_record.rank if top_record else None,
                "top_category": top_record.category if top_record else None,
            }
        domain_info = domain_cache[primary_domain]

        asn = None
        as_name = None
        cloud_record = None
        alt_dns_record = None
        vpn_record = None
        if event.dst_ip:
            ip = event.dst_ip
            if ip not in asn_cache:
                asn_cache[ip] = refs.asn_db.lookup(ip)
            if ip not in cloud_cache:
                cloud_cache[ip] = ip_in_network_records(ip, refs.cloud_networks)
            if ip not in alt_dns_cache:
                alt_dns_cache[ip] = ip_in_network_records(ip, refs.alt_dns_networks)
            if ip not in vpn_cache:
                vpn_cache[ip] = ip_in_network_records(ip, refs.vpn_infra_networks)
            asn_info = asn_cache.get(ip)
            if asn_info is not None:
                asn = asn_info.asn
                as_name = asn_info.as_name
            cloud_record = cloud_cache.get(ip)
            alt_dns_record = alt_dns_cache.get(ip)
            vpn_record = vpn_cache.get(ip)

        enriched_data = event.model_dump()
        ip_only_category = _infer_ip_only_category(
            domain_info["domain_category"],
            event.dst_port,
            cloud_record is not None,
            alt_dns_record is not None,
            event.protocol_hint,
        )
        enriched_data.update(
            {
                "etld1": domain_info["etld1"],
                "asn": asn,
                "as_name": as_name,
                "cloud_provider": cloud_record.meta.get("provider") if cloud_record is not None else None,
                "is_cloud": cloud_record is not None,
                "domain_category": ip_only_category or domain_info["domain_category"],
                "domain_category_confidence": domain_info["domain_category_confidence"],
                "domain_category_source": domain_info["domain_category_source"],
                "is_messenger": domain_info["is_messenger"],
                "messenger_app": domain_info["messenger_app"],
                "messenger_confidence": domain_info["messenger_confidence"],
                "top_rank": domain_info["top_rank"],
                "top_category": domain_info["top_category"],
                "is_alt_dns": alt_dns_record is not None,
                "alt_dns_provider": alt_dns_record.meta.get("provider") if alt_dns_record is not None else None,
                "is_vpn_infra_ip": vpn_record is not None,
                "vpn_infra_provider": vpn_record.meta.get("provider") if vpn_record is not None else None,
                "vpn_infra_type": vpn_record.meta.get("type") if vpn_record is not None else None,
            }
        )
        enriched = EnrichedEvent(**enriched_data)
        enriched_events.append(enriched)
    return enriched_events


def _infer_ip_only_category(
    domain_category: str | None,
    dst_port: int | None,
    is_cloud: bool,
    is_alt_dns: bool,
    protocol_hint: str | None,
) -> str | None:
    # Apply only when domain category was not resolved from SNI
    if domain_category and domain_category != "unknown":
        return None
    proto = str(protocol_hint or "").lower()
    if is_alt_dns or dst_port == 53 or "domain name server" in proto:
        return "dns"
    if dst_port == 123 or "ntp" in proto:
        return "system_update"
    if dst_port in {3478, 3479, 5349} or "stun" in proto:
        return "webrtc_stun"
    if is_cloud:
        return "background_service"
    return None
