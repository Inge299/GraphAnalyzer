from app.services.project_domain_store import _entity, _fact_key, _relation


def test_entity_uses_type_and_external_key_as_identity():
    entity = _entity("msisdn", "7 (928) 310-01-98", attributes={"msisdn": "79283100198"})

    assert entity is not None
    assert entity["type_id"] == "msisdn"
    assert entity["external_key"] == "7 (928) 310-01-98"
    assert entity["label"] == "7 (928) 310-01-98"


def test_relation_is_stable_and_keeps_event_time_and_attributes():
    attributes = {"event_time": "2026-07-20T15:00:00", "source": "fixture"}
    relation = _relation(
        "ip_msisdn_link",
        "ip_address",
        "192.0.2.1",
        "msisdn",
        "79283100198",
        "2026-07-20T15:00:00",
        attributes,
        False,
    )

    assert relation is not None
    assert relation["from_type"] == "ip_address"
    assert relation["to_type"] == "msisdn"
    assert relation["occurred_at"] == "2026-07-20T15:00:00"
    assert relation["fact_key"] == _fact_key(
        "ip_msisdn_link",
        {
            "from_type": "ip_address",
            "from_key": "192.0.2.1",
            "to_type": "msisdn",
            "to_key": "79283100198",
            "occurred_at": "2026-07-20T15:00:00",
            "attributes": attributes,
        },
    )
