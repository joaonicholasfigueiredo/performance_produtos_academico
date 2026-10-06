from __future__ import annotations

import unittest
from contextlib import contextmanager
from datetime import date, datetime
from unittest.mock import MagicMock, patch

from psycopg import sql

from repo import database_logs


class DatabaseLogsTest(unittest.TestCase):
    def test_load_log_events_executes_composed_query(self) -> None:
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchall.return_value = [({"event_id": "newest"},), ({"event_id": "oldest"},)]

        @contextmanager
        def connection_context():
            yield connection

        identifiers = (
            sql.Identifier("performance_produtos"),
            sql.Identifier("dados"),
            sql.Identifier("logs_alteracoes"),
            sql.Identifier("importacoes_pendentes"),
        )
        with (
            patch.object(database_logs, "_connection", connection_context),
            patch.object(database_logs, "_storage_exists", return_value=True),
            patch.object(database_logs, "_identifiers", return_value=identifiers),
        ):
            events = database_logs.load_log_events()

        self.assertEqual(events, [{"event_id": "newest"}, {"event_id": "oldest"}])
        cursor.execute.assert_called_once()
        self.assertIsInstance(cursor.execute.call_args.args[0], sql.Composed)

    def test_insert_log_converts_event_values(self) -> None:
        cursor = MagicMock()
        event = {
            "event_id": "event-1",
            "occurred_at": "2026-08-27T12:13:36+00:00",
            "period": "2026-08",
            "period_label": "Agosto/2026",
            "source_file": "agosto.xlsx",
        }

        database_logs._insert_log(
            cursor,
            event,
            sql.Identifier("performance_produtos"),
            sql.Identifier("logs_alteracoes"),
        )

        parameters = cursor.execute.call_args.args[1]
        self.assertEqual(parameters[0], "event-1")
        self.assertEqual(parameters[1], datetime.fromisoformat(event["occurred_at"]))
        self.assertEqual(parameters[2], date(2026, 8, 1))
        self.assertEqual(parameters[3:5], ("Agosto/2026", "agosto.xlsx"))


if __name__ == "__main__":
    unittest.main()
