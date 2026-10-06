from __future__ import annotations

import os
import unittest
from unittest.mock import patch

import jwt

from app.auth import verificar_token


class JwtAuthenticationTest(unittest.TestCase):
    def test_valid_hs256_login_token_is_converted_to_user(self) -> None:
        secret = "test-secret-with-at-least-32-bytes"
        with patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "development",
                "SECRET_KEY": secret,
                "JWT_ALGORITHM": "HS256",
            },
            clear=True,
        ):
            token = jwt.encode(
                {
                    "sub": "user-123",
                    "email": "user@example.com",
                    "name": "User Example",
                    "tipo": "login",
                },
                secret,
                algorithm="HS256",
            )

            usuario = verificar_token(tipo="login", token=token)

        self.assertIsInstance(usuario, dict)
        self.assertEqual(usuario["uid"], "user-123")
        self.assertEqual(usuario["email"], "user@example.com")
        self.assertEqual(usuario["nome"], "User Example")

    def test_invalid_token_is_rejected(self) -> None:
        with patch.dict(
            os.environ,
            {"ENVIRONMENT": "development", "SECRET_KEY": "test-secret-with-at-least-32-bytes"},
            clear=True,
        ):
            usuario = verificar_token(tipo="login", token="not-a-jwt")

        self.assertEqual(usuario, "Token JWT inválido.")

    def test_profile_claims_include_organization_and_branch_data(self) -> None:
        secret = "test-secret-with-at-least-32-bytes"
        with patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "development",
                "SECRET_KEY": secret,
                "JWT_ALGORITHM": "HS256",
            },
            clear=True,
        ):
            token = jwt.encode(
                {
                    "sub": "user-123",
                    "email": "user@example.com",
                    "name": "User Example",
                    "profile": "analyst",
                    "department": "Products",
                    "numeroPa": "89",
                    "branch_name": "UAD",
                    "tipo": "login",
                },
                secret,
                algorithm="HS256",
            )

            usuario = verificar_token(tipo="login", token=token)

        self.assertIsInstance(usuario, dict)
        self.assertEqual(usuario["perfil"], "analyst")
        self.assertEqual(usuario["departamento"], "Products")
        self.assertEqual(usuario["numero_pa"], "89")
        self.assertEqual(usuario["nome_pa"], "UAD")

    def test_production_reads_the_public_key_path_from_environment(self) -> None:
        with patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "production",
                "PUBLIC_KEY_PATH": "C:/does-not-exist/jwt-public.pem",
            },
            clear=True,
        ):
            usuario = verificar_token(tipo="login", token="not-a-jwt")

        self.assertEqual(
            usuario,
            "Não foi possível ler a chave pública configurada em PUBLIC_KEY_PATH.",
        )


if __name__ == "__main__":
    unittest.main()
