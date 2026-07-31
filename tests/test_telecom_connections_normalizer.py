from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.import_plugins.telecom_connections_normalizer import normalize_telecom_connections


class TelecomConnectionsNormalizerTests(unittest.TestCase):
    def test_normalizes_direction_station_and_identity_facts(self) -> None:
        headers = [
            "\u0412\u0440\u0435\u043c\u044f \u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f", "\u0422\u0438\u043f \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f", "\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c, \u0441\u0435\u043a", "\u041d\u043e\u043c\u0435\u0440 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "IMSI \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "IMEI \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430", "\u041d\u043e\u043c\u0435\u0440 \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430", "IMSI \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430", "IMEI \u043a\u043e\u043d\u0442\u0430\u043a\u0442\u0430", "\u041c/\u041f \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e", "\u0410\u0437\u0438\u043c\u0443\u0442 \u0430\u043d\u0442\u0435\u043d\u043d\u044b \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e", "\u0410\u0434\u0440\u0435\u0441 \u0411\u0421 \u0430\u0431\u043e\u043d\u0435\u043d\u0442\u0430 \u043d\u0430 \u043d\u0430\u0447\u0430\u043b\u043e", "\u041d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f",
        ]
        row = ["01.07.2026 09:45:24", "\u041f\u043e\u043f\u044b\u0442\u043a\u0430 \u0432\u044b\u0437\u043e\u0432\u0430", "12", "79283100198", "250028772665482", "86008205035995", "79068483666", "250028700000001", "86008205035996", "42615/67297568", "190", "\u0410\u0434\u0440\u0435\u0441 \u0411\u0421", "\u0412\u0445\u043e\u0434\u044f\u0449\u0435\u0435"]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "connections.csv"
            path.write_text(";".join(f'\"{value}\"' for value in headers) + "\n" + ";".join(f'\"{value}\"' for value in row) + "\n", encoding="utf-8")
            sources = normalize_telecom_connections(Path(directory))

        self.assertEqual(sources["telecom_connections"][0]["from_msisdn"], "79068483666")
        self.assertEqual(sources["telecom_connections"][0]["to_msisdn"], "79283100198")
        self.assertEqual(sources["telecom_connections"][0]["connection_type"], "\u041f\u043e\u043f\u044b\u0442\u043a\u0430 \u0432\u044b\u0437\u043e\u0432\u0430")
        self.assertEqual(sources["telecom_base_stations"][0]["base_station"], "250/02/42615/67297568")
        self.assertEqual(sources["telecom_base_stations"][0]["azimuth_deg"], "190")
        self.assertEqual(len(sources["telecom_msisdn_imsi"]), 2)
        self.assertEqual(len(sources["telecom_msisdn_imei"]), 2)


if __name__ == "__main__":
    unittest.main()
