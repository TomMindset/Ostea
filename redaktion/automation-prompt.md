# Auftrag der Automation „OSTEA Wochenredaktion“

Arbeite ausschließlich im Projekt `Ostea`. Lies vor jeder Aktion vollständig:

- `redaktion/README.md`
- `redaktion/config.json`
- `redaktion/arbeitsplan.md`
- `redaktion/state.json`

Behandle `config.json` als technische Sperre. Zugangsdaten oder Tokens dürfen
niemals in Git geschrieben werden.

## Bei jedem Lauf

1. Prüfe Datum, Wochentag, Zeitzone und `state.json`.
2. Prüfe zuerst über die geschützte Portal-Statusabfrage, ob eine offene
   Entscheidung zu einem vorhandenen Entwurf vorliegt.
3. Führe externe Aktionen nur aus, wenn alle zugehörigen `live`-Schalter aktiv
   sind.
4. Beende einen Lauf ohne externe Aktion, wenn ein Profil, Token, Dienst oder
   Freigabestatus nicht eindeutig ist. Unsicherheit ist niemals eine Freigabe.

## Wöchentliche Entwurfserstellung

Erstelle montags genau ein neues Redaktionspaket, sofern
`last_prepared_iso_week` nicht bereits der aktuellen ISO-Woche entspricht.

1. Wähle den Wochenfokus aus dem aktuellen Monat in `arbeitsplan.md`.
2. Prüfe vorhandene Website-Seiten und frühere Entwürfe, um Dopplungen zu
   vermeiden.
3. Recherchiere aktuell im Internet. Bevorzuge Leitlinien, Behörden,
   Fachgesellschaften, systematische Reviews, Cochrane und PubMed. Nutze nach
   Möglichkeit mindestens drei unabhängige Quellen, davon mindestens eine
   Leitlinie oder systematische Übersicht.
4. Prüfe Veröffentlichungsdatum, untersuchte Gruppe, Endpunkte und Grenzen der
   Quellen. Stelle naturheilkundliche Einordnung niemals als klinisch gesicherte
   Wirkung dar.
5. Verfasse einen eigenständigen Artikel mit ungefähr 900 bis 1.300 Wörtern,
   einen Facebook-Teaser mit 350 bis 650 Zeichen, ein Instagram-Karussell mit
   Bildtexten und Caption sowie eine Quellenakte.
6. Verwende keine Heilversprechen, keine unbelegte Ursachenbehauptung und keine
   garantierte Wirkung. Nenne praktische, risikoarme Tipps, klare Grenzen der
   Selbsthilfe und relevante Warnzeichen.
7. Erzeuge KI-Bilder ausschließlich nach den Bildregeln aus `config.json`.
   Bringe den exakten sichtbaren Hinweis `KI-generiert` nach der Bilderzeugung
   als deterministische Textebene in die finalen Bildpixel ein. Verlasse dich
   dafür nicht auf die Textdarstellung des Bildmodells. Der Hinweis steht unten
   rechts innerhalb der Sicherheitszone, hat mindestens 4,5:1 Kontrast und
   eine Schrifthöhe von mindestens 2,5 Prozent der Bildhöhe. Er muss auch nach
   dem endgültigen Zuschnitt lesbar sein.
8. Lege alles unter
   `redaktion/entwuerfe/YYYY-MM-DD-kurzbezeichnung/` ab:
   `artikel.md`, `facebook.md`, `instagram.md`, `quellen.md`,
   `bildprompt.txt`, das final gekennzeichnete Bild, `pruefbericht.md`,
   `portal-payload.json` und `meta.json`.
9. Vermerke im Prüfbericht Dateiname und Bildmaße sowie ausdrücklich, dass der
   Hinweis `KI-generiert` in den finalen Bildpixeln sichtbar geprüft wurde.
   Fehlt der Hinweis, ist schlecht lesbar oder wird er durch einen Zuschnitt
   entfernt, setze den Entwurf nicht auf `ready_for_approval`.
10. Aktualisiere `state.json` mit ISO-Woche, Entwurfs-ID, Version `1`,
   Status `ready_for_approval` und ohne Klartext-Freigabetoken.

Der Entwurf darf zu diesem Zeitpunkt weder in die öffentliche Website kopiert
noch zu GitHub gepusht werden.

## Portal und Mailversand

Versende keine Mail, wenn `mail.live` nicht `true` ist, die Absenderadresse auf
`.invalid` endet oder das verbundene Gmail-Profil nicht exakt
`mail.sender_address` entspricht. Verwende insbesondere niemals ein anderes,
privates Gmail-Konto als Ersatz.

Lege keine Freigabe im Portal an, solange `approval.live` nicht `true` ist,
der Portalzugang noch `owner_only_private_preview` lautet oder das nur im
Hosting hinterlegte `PORTAL_INGEST_SECRET` nicht verfügbar ist.

Lege außerdem keine Freigabe für einen Entwurf mit KI-Bild an, solange im
Prüfbericht nicht bestätigt ist, dass der exakte Hinweis `KI-generiert` im
finalen, zugeschnittenen Bild selbst sichtbar und lesbar ist. Eine Caption,
ein Alt-Text, Metadaten oder ein Hinweis außerhalb des Bildes ersetzen die
Kennzeichnung nicht.

Wenn Portal und Mailversand freigeschaltet und ein Entwurf bereit sind:

1. Übermittle das validierte `portal-payload.json` per `POST /api/reviews` mit
   dem Hosting-Secret als Bearer-Authentifizierung.
2. Übernimm aus der Antwort nur Freigabe-ID, Ablaufdatum und den einmaligen
   `reviewUrl`. Das Portal speichert den Linktoken ausschließlich als
   SHA-256-Hash.
3. Erzeuge die Freigabemail aus `redaktion/templates/freigabe-mail.html` und
   setze den `reviewUrl` in die Schaltfläche „Beitrag prüfen“ ein.
4. Sende an die exakt konfigurierte `approval_recipient`-Adresse. Speichere in
   `state.json` Gmail-Nachrichten-ID, Freigabe-ID und Version, aber niemals den
   vollständigen Freigabelink oder Klartexttoken.

## Auswertung der Portalentscheidung

Rufe bei jedem Automationslauf für die gespeicherte Freigabe-ID
`GET /api/reviews/status/{id}` mit Bearer-Authentifizierung auf.

- `pending`: nichts veröffentlichen.
- `approved`: nur die im Portal bestätigten Kanäle übernehmen.
- `changes_requested`: Änderungswunsch übernehmen, Version erhöhen, fachlich
  erneut prüfen und eine neue Freigabe anlegen.
- `rejected`: Entwurf archivieren und nicht veröffentlichen.

Eine Antwortmail oder Freitextnachricht gilt niemals als Freigabe. Der
Portalstatus ist die einzige technische Entscheidungsquelle.

## Veröffentlichung

Veröffentliche nur bei Status `approved`, für den ausdrücklich freigegebenen
Kanal und bei `publishing.live = true`.
Prüfe unmittelbar vor jeder Veröffentlichung eines KI-Bildes erneut die
tatsächlich auszuliefernde Datei. Fehlt der sichtbare Hinweis `KI-generiert`
oder wurde er durch Export beziehungsweise Zuschnitt entfernt, stoppe den
betroffenen Kanal.
Erstelle eine statische Artikelseite im Stil der vorhandenen OSTEA-Seiten,
verlinke sie in einem Ratgeberbereich und ergänze die Sitemap. Prüfe HTML,
interne Links, strukturierte Daten, Mobilansicht und die Quellenangaben.

Veröffentliche Facebook und Instagram erst nach erfolgreicher
Website-Veröffentlichung und nur über die ausdrücklich verbundenen
OSTEA-Meta-Ziele. Wenn ein Ziel nicht eindeutig verbunden ist, stoppe nur den
betroffenen Kanal und melde die fehlende Verbindung; verwende niemals ein
privates Profil als Ersatz.

Nach erfolgreicher Veröffentlichung dokumentiere URL, Zeitpunkt, freigegebene
Version und Zielkanäle in `state.json`.
