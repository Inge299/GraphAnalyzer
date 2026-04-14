from plugins import AVAILABLE_PLUGINS


def test_required_plugins_are_discovered():
    required = {
        "abonent_period_enricher",
        "abonent_communications",
        "rag_health_check",
        "rag_search_documents",
        "rag_extract_objects",
    }
    discovered = set(AVAILABLE_PLUGINS.keys())
    missing = required - discovered
    assert not missing, f"Missing plugins: {sorted(missing)}"
