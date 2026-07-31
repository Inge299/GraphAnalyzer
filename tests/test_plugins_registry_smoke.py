from plugins import AVAILABLE_PLUGINS


def test_required_plugins_are_discovered():
    required = {
        "create_typed_objects",
        "edge_weights",
        "expand_typed_relations",
    }
    discovered = set(AVAILABLE_PLUGINS.keys())
    missing = required - discovered
    assert not missing, f"Missing plugins: {sorted(missing)}"
