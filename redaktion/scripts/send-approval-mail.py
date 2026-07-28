#!/usr/bin/env python3
"""Send exactly one OSTEA approval mail from a GitHub-hosted Windows runner."""

from __future__ import annotations

import argparse
from datetime import datetime
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
import html
import json
import os
from pathlib import Path
import re
import smtplib
import ssl
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


FROM_ADDRESS = "osteapublishing@gmail.com"
FROM_DISPLAY_NAME = "OSTEA Redaktion"
TO_ADDRESS = "s.hoffmann@ostea.de"
SUBJECT_PREFIX = "[OSTEA-Freigabe]"
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465
PORTAL_HOST = "ostea-freigabeportal.hoffmann877528.chatgpt.site"
REVIEW_PATH = re.compile(r"^/review/[A-Za-z0-9_-]{32,128}$")


class ApprovalMailError(RuntimeError):
    pass


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ApprovalMailError(f"Erforderliche Konfiguration fehlt: {name}")
    return value


def normalize_app_password(value: str) -> str:
    normalized = "".join(value.split())
    if len(normalized) != 16 or not normalized.isascii() or not normalized.isalnum():
        raise ApprovalMailError("Das Gmail-App-Passwort hat nicht das erwartete Format.")
    return normalized


def load_json(path: str) -> dict:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ApprovalMailError("Ungültige JSON-Datei.")
    return value


def validate_review_url(value: str) -> str:
    parsed = urlparse(value)
    if (
        parsed.scheme != "https"
        or parsed.hostname != PORTAL_HOST
        or parsed.query
        or parsed.fragment
        or not REVIEW_PATH.fullmatch(parsed.path)
    ):
        raise ApprovalMailError("Die Freigabe-URL gehört nicht zum OSTEA-Portal.")
    return value


def replace_template(template: str, values: dict[str, str]) -> str:
    result = template
    for key, value in values.items():
        result = result.replace("{{" + key + "}}", html.escape(value))
    if re.search(r"\{\{[a-z_]+\}\}", result):
        raise ApprovalMailError("Die Freigabemail enthält unersetzte Platzhalter.")
    return result


def build_message(review: dict, package: dict, template: str) -> EmailMessage:
    review_url = validate_review_url(str(review.get("reviewUrl", "")))
    title = str(package.get("title", "")).strip()
    audience = str(package.get("audience", "")).strip()
    payload = package.get("payload") or {}
    summary = str(payload.get("summary", "")).strip()
    evidence = str(payload.get("evidenceNote", "")).strip()
    version = int(package.get("version", 1))
    review_id = str(review.get("id", "")).strip()
    expires_at = str(review.get("expiresAt", "")).strip()
    if not all([title, audience, summary, evidence, review_id, expires_at]):
        raise ApprovalMailError("Das Freigabepaket ist unvollständig.")

    values = {
        "titel": title,
        "zielgruppe": audience,
        "fenster": (
            "Frühestens am nächsten Werktag zwischen 09:00 und 11:00 Uhr; "
            "höchstens ein Artikel pro Kalenderwoche"
        ),
        "kurzfassung": summary,
        "evidenzhinweis": evidence,
        "review_url": review_url,
        "draft_id": review_id,
        "version": str(version),
        "expires_at": expires_at,
    }
    html_body = replace_template(template, values)
    text_body = f"""Hallo Sonja,

der neue OSTEA-Beitrag ist zur Prüfung bereit.

Thema: {title}
Zielgruppe: {audience}
Geplantes Veröffentlichungsfenster: {values["fenster"]}

Kurzfassung:
{summary}

Quellen und fachliche Einschränkungen:
{evidence}

Beitrag prüfen:
{review_url}

Der Link öffnet die mobile Freigabekarte. Dort können Website, Facebook und
Instagram einzeln ausgewählt und anschließend freigegeben, zur Änderung
zurückgegeben oder abgelehnt werden. Ohne formal gültige Portalentscheidung
wird nichts veröffentlicht.

Viele Grüße
OSTEA Redaktion
"""
    message = EmailMessage()
    message["From"] = f"{FROM_DISPLAY_NAME} <{FROM_ADDRESS}>"
    message["To"] = TO_ADDRESS
    message["Reply-To"] = FROM_ADDRESS
    message["Subject"] = f"{SUBJECT_PREFIX} {title} · Version {version}"
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid(domain="gmail.com")
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    return message


def confirm_delivery(run_key: str, review_id: str, message_id: str) -> bool:
    portal_url = required_env("OSTEA_PORTAL_URL").rstrip("/")
    secret = required_env("OSTEA_WEEKLY_TRIGGER_SECRET")
    body = json.dumps(
        {"runKey": run_key, "reviewId": review_id, "messageId": message_id}
    ).encode("utf-8")
    request = Request(
        portal_url + "/api/editorial/weekly-mail-status",
        data=body,
        method="POST",
        headers={
            "Authorization": "Bearer " + secret,
            "Content-Type": "application/json",
        },
    )
    for attempt in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                return response.status == 200
        except (HTTPError, URLError, TimeoutError):
            if attempt < 2:
                time.sleep(2**attempt)
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--review", required=True)
    parser.add_argument("--package", required=True)
    parser.add_argument("--template", required=True)
    parser.add_argument("--run-state", required=True)
    args = parser.parse_args()

    review = load_json(args.review)
    package = load_json(args.package)
    run_state = load_json(args.run_state)
    template = Path(args.template).read_text(encoding="utf-8")
    message = build_message(review, package, template)
    password = normalize_app_password(required_env("OSTEA_GMAIL_APP_PASSWORD"))
    try:
        with smtplib.SMTP_SSL(
            SMTP_HOST,
            SMTP_PORT,
            context=ssl.create_default_context(),
            timeout=30,
        ) as smtp:
            smtp.login(FROM_ADDRESS, password)
            refused = smtp.send_message(
                message,
                from_addr=FROM_ADDRESS,
                to_addrs=[TO_ADDRESS],
            )
    except smtplib.SMTPAuthenticationError as exc:
        raise ApprovalMailError("Gmail-Anmeldung fehlgeschlagen; nichts gesendet.") from exc
    except (smtplib.SMTPException, OSError, ssl.SSLError) as exc:
        raise ApprovalMailError(
            "SMTP-Fehler mit unklarem Versandstatus; nicht automatisch wiederholen."
        ) from exc
    finally:
        password = ""

    if refused:
        raise ApprovalMailError("Gmail hat die feste Freigabeadresse abgewiesen.")
    confirmed = confirm_delivery(
        str(run_state.get("runKey", "")),
        str(review.get("id", "")),
        str(message["Message-ID"]),
    )
    if confirmed:
        print("Freigabemail versendet und Portalstatus bestätigt.")
    else:
        print(
            "Freigabemail versendet; Portalstatus konnte nicht bestätigt werden. "
            "Kein automatischer Neuversand.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ApprovalMailError as exc:
        print(f"Fehler: {exc}", file=sys.stderr)
        raise SystemExit(2)
