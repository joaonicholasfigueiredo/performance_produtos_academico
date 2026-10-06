from __future__ import annotations

import os
import unittest
from pathlib import Path
from unittest.mock import patch

from app.launcher import load_server_settings


class ServerSettingsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.config_path = Path.cwd() / "tests" / ".runtime" / "launcher.config"
        self.config_path.parent.mkdir(parents=True, exist_ok=True)

    def tearDown(self) -> None:
        self.config_path.unlink(missing_ok=True)

    def test_missing_server_section_uses_lan_defaults(self) -> None:
        self.config_path.write_text(
            "[postgresql]\nhost = 127.0.0.1\n",
            encoding="utf-8",
        )
        with patch.dict(os.environ, {}, clear=True):
            settings = load_server_settings(self.config_path)

        self.assertEqual(settings.host, "127.0.0.1")
        self.assertEqual(settings.port, 8000)

    def test_server_section_and_environment_are_supported(self) -> None:
        self.config_path.write_text(
            "[server]\nhost = 127.0.0.1\nport = 8010\n",
            encoding="utf-8",
        )
        with patch.dict(
            os.environ,
            {
                "ACOMPANHAMENTO_HOST": "127.0.0.1",
                "ACOMPANHAMENTO_PORT": "8020",
            },
            clear=True,
        ):
            settings = load_server_settings(self.config_path)

        self.assertEqual(settings.host, "127.0.0.1")
        self.assertEqual(settings.port, 8020)

    def test_invalid_port_is_rejected(self) -> None:
        self.config_path.write_text("[server]\nport = 70000\n", encoding="utf-8")
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "entre 1 e 65535"):
                load_server_settings(self.config_path)


if __name__ == "__main__":
    unittest.main()
