from app.models.console_registry import ConsolePythonPluginSetting
from app.services.console_executor_registry import _apply_python_plugin_setting


def test_python_plugin_setting_overrides_file_descriptor():
    descriptor = {
        "id": "demo",
        "name": "Demo",
        "menu_path": "Analysis/Default",
        "menu_order": 0,
        "is_active": True,
        "hidden_from_menu": False,
    }
    setting = ConsolePythonPluginSetting(
        plugin_id="demo",
        is_active=False,
        is_visible=False,
        menu_path="Analysis/Custom",
        menu_order=25,
    )

    result = _apply_python_plugin_setting(descriptor, setting)

    assert result["is_active"] is False
    assert result["hidden_from_menu"] is True
    assert result["menu_path"] == "Analysis/Custom"
    assert result["menu_order"] == 25
    assert descriptor["is_active"] is True


def test_python_plugin_without_setting_uses_file_defaults():
    descriptor = {
        "id": "demo",
        "menu_path": "Analysis/Default",
        "menu_order": 7,
    }

    result = _apply_python_plugin_setting(descriptor, None)

    assert result["is_active"] is True
    assert result["hidden_from_menu"] is False
    assert result["menu_path"] == "Analysis/Default"
    assert result["menu_order"] == 7
