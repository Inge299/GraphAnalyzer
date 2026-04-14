from app.api.routes.console import _load_profiles, _profile_public


def test_console_profiles_config_has_valid_ids():
    profiles = _load_profiles()
    assert profiles, "No console profiles configured"

    public_profiles = [_profile_public(profile) for profile in profiles]
    ids = [item.get("id") for item in public_profiles]

    assert all(isinstance(value, str) and value.strip() for value in ids), "Profile id must be non-empty string"
    assert len(ids) == len(set(ids)), "Console profile ids must be unique"
