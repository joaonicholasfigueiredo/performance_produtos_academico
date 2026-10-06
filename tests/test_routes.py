from __future__ import annotations

import unittest

from fastapi import HTTPException, Request

from app.routes.auth import get_current_user
from app.routes.exports import _download_response


class RouteHelpersTest(unittest.TestCase):
    def test_download_response_sets_attachment_headers(self) -> None:
        response = _download_response(b"report", "report.xlsx", "application/test")

        self.assertEqual(response.body, b"report")
        self.assertEqual(response.media_type, "application/test")
        self.assertEqual(
            response.headers["content-disposition"],
            'attachment; filename="report.xlsx"',
        )

    def test_current_user_requires_an_authenticated_session(self) -> None:
        request = Request({"type": "http", "session": {}})

        with self.assertRaises(HTTPException) as raised:
            get_current_user(request)

        self.assertEqual(raised.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
