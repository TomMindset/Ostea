# OSTEA-Redaktion

Dieser Ordner ist die verbindliche Arbeitsgrundlage für die wöchentliche
OSTEA-Redaktion. Veröffentlichungen bleiben immer freigabepflichtig.

Für jedes ganz oder teilweise KI-generierte Bild ist der sichtbare Hinweis
`KI-generiert` in den finalen Bildpixeln verpflichtend. Die in
`config.json` festgelegte Kennzeichnung ist eine Freigabe- und
Veröffentlichungssperre; ein Hinweis nur in Begleittext oder Metadaten reicht
nicht aus.

Das Bildmodell erzeugt zunächst nur das Grundmotiv. Anschließend wird die
Kennzeichnung reproduzierbar eingefügt:

```powershell
.\redaktion\scripts\add-ai-label.ps1 `
  -InputPath .\redaktion\entwuerfe\...\motiv.png `
  -OutputPath .\redaktion\entwuerfe\...\motiv-final.png
```

Nur die so erzeugte und anschließend visuell geprüfte `*-final`-Datei darf in
die Freigabe oder Veröffentlichung gelangen. Das Skript überschreibt keine
vorhandene Datei.

## Aktueller Betriebszustand

- Die wöchentliche Recherche und Entwurfserstellung darf automatisiert laufen.
- Das Freigabeportal ist technisch fertig und als private Eigentümer-Vorschau
  veröffentlicht.
- Der Portalzugriff für Sonja und `approval.live` sind aktiviert.
- Als vorgesehener Absender ist `osteapublishing@gmail.com` hinterlegt.
- Das Gmail-Konto ist über ein projektgebundenes Google-App-Passwort angebunden;
  das Geheimnis liegt Windows-DPAPI-verschlüsselt außerhalb des Projekts.
- Für den rechnerunabhängigen Wochenlauf ist dasselbe App-Passwort zusätzlich
  als nicht auslesbares Repository-Secret `OSTEA_GMAIL_APP_PASSWORD` im
  privaten GitHub-Automationskontext hinterlegt.
- `mail.live` ist nach erfolgreichem IMAP-/SMTP- und Realversandtest aktiviert.
- GitHub Actions startet montags um 07:30 Uhr in der Zeitzone
  `Europe/Berlin`. Der Windows-Cloud-Runner recherchiert aktuelle Quellen,
  erstellt das Redaktionspaket, erzeugt das textfreie Grundmotiv, führt
  `scripts/add-ai-label.ps1` aus, prüft die finale Datei visuell, legt die
  Freigabekarte an und versendet sie an Sonja.
- Solange `publishing.live` auf `false` steht, dürfen weder Website noch
  Facebook automatisch veröffentlicht werden.
- Die öffentliche Kontaktadresse `s.hoffmann@ostea.de` auf der Website wird
  durch diesen Platzhalter nicht verändert.

## Aktivierung des echten Redaktionskontos

1. Das neue Gmail-Konto über den projektlokalen Skill anbinden.
2. Prüfen, dass das Gmail-Login exakt der neuen Adresse entspricht.
3. Prüfen, dass `mail.sender_address` auf `osteapublishing@gmail.com` gesetzt
   ist.
4. Den Portalzugriff ausdrücklich für Sonja freigeben und einen vollständigen
   Test mit Freigabelink durchführen.
5. Nach erfolgreichem Versand einer Testmail `mail.live` und nach dem
   Portaltest `approval.live` auf `true` setzen. Erledigt am 26.07.2026.
6. Facebook, Instagram und den Veröffentlichungsweg separat verbinden und
   testen.
7. Erst danach `publishing.live` auf `true` setzen.

Passwörter, Wiederherstellungscodes und OAuth-Tokens gehören niemals in diesen
Ordner oder in Git.
