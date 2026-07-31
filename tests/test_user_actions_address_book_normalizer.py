from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from app.import_plugins.user_actions_address_book_normalizer import normalize_user_actions_address_book


class UserActionsAddressBookNormalizerTests(unittest.TestCase):
    def test_normalizes_and_aggregates_recorded_as_text(self) -> None:
        headers = [
            "\u0414\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043c\u044f",
            "\u0422\u0435\u0445\u0434\u0430\u043d\u043d\u044b\u0435, \u0438\u0434\u0435\u043d\u0442. \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f",
            "\u0422\u0435\u043a\u0441\u0442 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f",
        ]
        row_one = [
            "23.01.2026 18:50",
            "IP-\u0430\u0434\u0440\u0435\u0441: 176.15.210.92/52072;\u041d\u043e\u043c\u0435\u0440: 79054471176;\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430: ANDROID/26.1.0 (Android 13 ru samsung SM-A127F)",
            "{''firstName'':''\u041f\u0438\u043a\u0442\u044b\u0441'',''lastName'':''\u0420\u041e\u041c\u0410\u041d'',''phone'':''79283174382'',''resolved'':false}",
        ]
        row_two = [
            "24.01.2026 09:20",
            "\u041d\u043e\u043c\u0435\u0440: 79054471177;\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430: Android",
            "{''firstName'':''\u0420\u043e\u043c\u0430'',''lastName'':'''',''phone'':''79283174382''}",
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "actions.csv"
            with path.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.writer(stream, delimiter=";")
                writer.writerow(headers)
                writer.writerow(row_one)
                writer.writerow(row_one)
                writer.writerow(row_two)
            sources = normalize_user_actions_address_book(Path(directory))

        self.assertEqual(len(sources["address_book_entries"]), 2)
        self.assertEqual(len(sources["recorded_as_entries"]), 2)
        aliases = sources["recorded_as_entries"]
        self.assertEqual({row["text_key"] for row in aliases}, {"recorded-as:79283174382"})
        self.assertEqual({row["text_label"] for row in aliases}, {"\u041a\u0430\u043a \u0437\u0430\u043f\u0438\u0441\u0430\u043d 79283174382"})
        self.assertEqual(
            {row["text"] for row in aliases},
            {"\u041f\u0438\u043a\u0442\u044b\u0441 \u0420\u041e\u041c\u0410\u041d \u0437\u0430\u043f\u0438\u0441\u0430\u043d \u0443 79054471176\n\u0420\u043e\u043c\u0430 \u0437\u0430\u043f\u0438\u0441\u0430\u043d \u0443 79054471177"},
        )
        self.assertEqual(len(sources["user_device_observations"]), 2)

    def test_skips_rows_without_contact_number(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "actions.csv"
            path.write_text(
                "\u0414\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043c\u044f;\u0422\u0435\u0445\u0434\u0430\u043d\u043d\u044b\u0435, \u0438\u0434\u0435\u043d\u0442. \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f;\u0422\u0435\u043a\u0441\u0442 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f\n"
                "01.01.2026 10:00;\u041d\u043e\u043c\u0435\u0440: 79283100198;\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430: Android;{''firstName'':''\u0411\u0435\u0437 \u043d\u043e\u043c\u0435\u0440\u0430''}\n",
                encoding="utf-8",
            )
            sources = normalize_user_actions_address_book(Path(directory))

        self.assertEqual(sources, {
            "address_book_entries": [],
            "recorded_as_entries": [],
            "user_device_observations": [],
        })


if __name__ == "__main__":
    unittest.main()