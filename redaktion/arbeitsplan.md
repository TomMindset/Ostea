# Arbeitsplan: wöchentliche OSTEA-Redaktion

Stand: 26. Juli 2026

## 1. Ziel

Jede Woche entsteht ein fachlich nachvollziehbarer Gesundheitsartikel für
ostea.de und ein kurzer Facebook-Teaser. Die Inhalte positionieren Sonja
Hoffmann als ruhige, professionelle Osteopathin für Erwachsene, Mütter,
Schwangere, Babys, Kinder und ältere Menschen.

Die Texte informieren, geben alltagstaugliche Möglichkeiten zur Linderung und
zeigen Grenzen der Selbsthilfe. Sie geben keine Heilversprechen und ersetzen
keine ärztliche oder therapeutische Diagnose.

## 2. Wöchentlicher Ablauf

### Montagmorgen: Themen- und Quellenprüfung

1. Monatsfokus und Zielgruppe bestimmen.
2. Aktuelle saisonale Beschwerden, Suchinteressen und neue Fachinformationen
   prüfen.
3. Neue Quellen der vergangenen fünf Jahre suchen; ältere Leit- oder
   Grundlagenquellen nur ergänzend verwenden.
4. Thema nur übernehmen, wenn es sich verantwortungsvoll und ohne
   Wirkversprechen bearbeiten lässt.

Der Montag ist der feste Vorbereitungstermin. Der Veröffentlichungstag ist
nicht auf Dienstag festgelegt, sondern richtet sich nach Sonjas Freigabe.

### Montagvormittag: Redaktionspaket

Das Paket enthält:

- Arbeitstitel und Suchintention;
- Artikelentwurf mit Kurzfassung;
- praktische, risikoarme Tipps für zu Hause;
- Warnzeichen und Hinweis, wann fachliche Abklärung sinnvoll ist;
- Facebook-Teaser;
- Instagram-Karussell und Caption;
- final zugeschnittene KI-Bilder mit dem sichtbaren Hinweis „KI-generiert“;
- Quellenliste mit Abrufdatum;
- kurze Evidenzeinschätzung und erkennbare Unsicherheiten;
- Freigabekarte für Sonja.

### Technischer Cloud-Lauf

Der Wochenlauf wird durch GitHub Actions montags um 07:30 Uhr in der Zeitzone
`Europe/Berlin` gestartet und benötigt keinen laufenden Praxisrechner. Der
Cloud-Runner ruft für die Textrecherche aktuelle Webquellen ab, erstellt das
strukturierte Paket und erzeugt ein zunächst schriftfreies Grundmotiv.

Anschließend führt ein Windows-Runner das verbindliche Skript
`redaktion/scripts/add-ai-label.ps1` aus. Die so entstandene finale PNG- oder
hochwertige JPEG-Datei wird zusätzlich visuell darauf geprüft, dass ausschließlich der exakte,
lesbare Hinweis `KI-generiert` unten rechts vorhanden und nicht angeschnitten
ist. Erst danach werden Bild und Textpaket in das Freigabeportal übertragen.
Der Freigabelink bleibt im kurzlebigen Runner-Arbeitsverzeichnis und wird
unmittelbar über `osteapublishing@gmail.com` an Sonja gesendet. Er erscheint
weder in GitHub-Artefakten noch in den Workflow-Protokollen.

### Freigabe durch Sonja

Die Freigabemail geht an `s.hoffmann@ostea.de` und enthält nur eine
Schaltfläche: „Beitrag prüfen“. Sie öffnet einen sieben Tage gültigen,
nicht erratbaren Einmallink. Im mobil optimierten Portal sieht Sonja den
Website-Artikel, den Facebook-Teaser, das Instagram-Karussell und die Quellen.
Sie kann die Kanäle einzeln auswählen und anschließend eine von drei
Entscheidungen treffen:

1. **Freigeben:** Der vorgelegte Stand darf nur für die ausgewählten Kanäle
   verwendet werden.
2. **Änderung wünschen:** Sonja trägt einen kurzen Änderungswunsch ein; danach
   entsteht eine neue Version und eine neue Freigabekarte.
3. **Nicht veröffentlichen:** Der Entwurf wird archiviert und nicht publiziert.

Vor dem Speichern zeigt das Portal eine kurze Bestätigung. Danach ist der Link
verbraucht. Die Automation liest den Status über einen getrennt geschützten
Rückkanal; Antwortmails und Freitext gelten nicht als Freigabe. Ohne eine
formal gültige Portalentscheidung erfolgt keine Veröffentlichung.

### Veröffentlichung

Nach Freigabe wird der Artikel am nächsten geeigneten Werktag zwischen 09:00
und 11:00 Uhr veröffentlicht. Der Facebook-Teaser folgt etwa 15 Minuten später
und verlinkt auf den Artikel. Die Freigabe gilt nur für den vorgelegten Inhalt;
inhaltliche Änderungen erfordern eine neue Freigabe.

## 3. Quellenstandard

Die Recherche beginnt bei Quellen mit hoher Aussagekraft:

1. aktuelle Leitlinien, Behörden und anerkannte Gesundheitsportale, etwa AWMF,
   RKI, WHO, NICE, `gesund.bund.de` und Fachgesellschaften;
2. systematische Übersichtsarbeiten und Cochrane Reviews;
3. PubMed-indexierte kontrollierte Studien;
4. seriöse naturheilkundliche Quellen nur mit klarer Kennzeichnung und ohne
   Gleichsetzung mit klinisch gesicherter Wirksamkeit.

Für jeden Artikel werden nach Möglichkeit mindestens drei voneinander
unabhängige Quellen dokumentiert. Wenn verfügbar, muss mindestens eine
Leitlinie oder systematische Übersichtsarbeit enthalten sein.

Zu jeder Quelle werden Titel, Herausgeber oder Autoren, Jahr, URL/DOI,
Abrufdatum, Studientyp, untersuchte Gruppe, wichtigstes Ergebnis und
wesentliche Einschränkungen notiert. Einzelstudien mit kleiner Stichprobe
werden nicht als gesicherte Erkenntnis dargestellt.

## 4. Sprach- und Sicherheitsregeln

Erlaubte Formulierungen sind beispielsweise:

- „kann im Alltag entlasten“;
- „kann als angenehm empfunden werden“;
- „es gibt Hinweise, die Studienlage ist jedoch begrenzt“;
- „bei anhaltenden oder zunehmenden Beschwerden sollte dies abgeklärt werden“.

Nicht zulässig sind Aussagen wie:

- „beseitigt die Ursache“;
- „heilt“ oder „garantiert“;
- „wirkt sicher“;
- „stärkt nachweislich das Immunsystem“, wenn dies nicht belastbar belegt ist;
- „entgiftet“ oder vergleichbare unklare Wirkbehauptungen.

Jeder Beitrag nennt relevante Warnzeichen. Bei Babys, Kindern, Schwangeren und
älteren Menschen gelten besonders vorsichtige Schwellen für ärztliche
Abklärung. Notfälle und akute Verschlechterungen werden nicht mit
Selbsthilfetipps relativiert.

### Kennzeichnung von KI-Bildern

Jedes ganz oder teilweise KI-generierte redaktionelle Bild trägt im Bild
selbst den exakten, gut lesbaren Hinweis `KI-generiert`. Die Kennzeichnung wird
nach der Bilderzeugung technisch als Textebene auf die finalen Bildpixel
gesetzt, damit Schreibfehler des Bildmodells ausgeschlossen sind. Sie steht
unten rechts innerhalb der Sicherheitszone, erreicht mindestens 4,5:1
Kontrast und hat eine Schrifthöhe von mindestens 2,5 Prozent der Bildhöhe.

Geprüft wird immer die endgültig zugeschnittene und exportierte Datei. Ein
Hinweis nur in Caption, Alt-Text, Dateiname oder Metadaten genügt nicht. Fehlt
die Kennzeichnung, ist der Entwurf weder freigabe- noch veröffentlichungsfähig.
Unveränderte echte Praxis- und Personenfotos werden nicht fälschlich als
KI-generiert gekennzeichnet.

## 5. Monatlich optimierter Redaktionsplan

Die vier Wochen bilden in der Regel Erwachsene, Mütter/Schwangere,
Babys/Kinder und ältere Menschen ab. Ein fünfter Termin wird für einen
Mythencheck oder ein aktuelles Forschungsthema genutzt.

| Monat | Woche 1 | Woche 2 | Woche 3 | Woche 4 | Optional Woche 5 |
| --- | --- | --- | --- | --- | --- |
| Januar | Rücken und Nacken nach ruhigen Feiertagen | Becken und Rücken nach der Geburt | Kinderschlaf und Abendroutine | Sicher aktiv bleiben im Alter | Bewegungsmythen zum Jahresstart |
| Februar | Kieferanspannung und Kopfschmerz | Entlastung in Schwangerschaft und Alltag | Hustenzeit: schonende Bewegung und Warnzeichen | Gelenksteifigkeit bei Kälte | Was Wärme leisten kann und was nicht |
| März | Sicherer Wiedereinstieg in Bewegung | Tragen, Heben und Stillpositionen | Wachstum, Bewegung und unspezifische „Wachstumsschmerzen“ | Gleichgewicht und Sturzprävention | Neue Studie verständlich eingeordnet |
| April | Gartenarbeit ohne unnötige Rückenbelastung | Beckenboden: Alltagstipps und Grenzen | Allergiesaison: Schlaf, Lüften und Abklärung | Mobilität nach der Winterpause | Mythos „Blockaden lösen“ |
| Mai | Nacken und Schulter bei Rad- und Outdoor-Aktivität | Bewegung in der Schwangerschaft | Kinderfüße, Schuhe und Barfußzeiten | Krafttraining im höheren Alter | Forschungsupdate Osteopathie |
| Juni | Reisevorbereitung für Rücken und Beine | Becken und Rücken im Wochenbett | Autofahrten mit Babys und Kindern | Trinken, Hitze und Kreislaufwarnzeichen | Sommersport und Regeneration |
| Juli | Schlaf und Nacken in warmen Nächten | Schwangerschaft bei Hitze | Sichere Bewegung und Flüssigkeit bei Kindern | Hitze: besondere Risiken im Alter | Was Dehnen realistisch bewirken kann |
| August | Rückenfreundliches Reisen | Familienalltag nach den Ferien | Schulstart, Rucksack und Sitzpausen | Trittsicherheit zu Hause | Bildschirmzeit und Haltung |
| September | Schreibtisch, Nacken und Bewegungspausen | Rückkehr in den Arbeitsalltag nach Geburt | Konzentration, Schlaf und Bewegungsroutinen | Beweglichkeit erhalten | Kieferstress seriös einordnen |
| Oktober | Brustkorb und Rücken in der Erkältungszeit | Tragen bei nassem und kaltem Wetter | Fieber und Infekte: klare Grenzen der Selbsthilfe | Gelenke bei Wetterwechsel | Mythos „Immunsystem stärken“ |
| November | Kopfschmerz, Kiefer und Jahresendstress | Entlastende Pausen für Mütter | Kinderschlaf bei Zeitumstellung | Sicher aktiv trotz Dunkelheit | Aktuelle Leitlinie im Kurzcheck |
| Dezember | Nacken und Rücken beim Tragen und Verpacken | Ruheinseln im Familienalltag | Aufregung und Schlaf bei Kindern | Sturzgefahr im Winter | Verdauung, Bewegung und Feiertage |

Der konkrete Titel wird vor jeder Erstellung anhand aktueller seriöser
Gesundheitsquellen, saisonaler Lage und bereits veröffentlichter OSTEA-Inhalte
geprüft. Es werden keine Diagnosen allein nach Suchvolumen ausgewählt.

## 6. Technische Sperren und Platzhalterbetrieb

Das Freigabeportal ist unter
`https://ostea-freigabeportal.hoffmann877528.chatgpt.site`
öffentlich erreichbar. Die neutrale Startseite enthält keine Entwürfe.
Freigabeentwürfe sind ausschließlich über zufällige, sieben Tage gültige
Einmallinks erreichbar; der Verwaltungsbereich verlangt weiterhin eine
berechtigte Anmeldung. Bis zur Einrichtung des neuen Gmail-Kontos gilt:

- interner Absender: `ostea.redaktion@example.invalid`;
- `mail.live = false`;
- keine Mail darf über das derzeit verbundene private Gmail-Konto versendet
  werden;
- `approval.live = false`;
- Freigabelinks dürfen erst nach erfolgreichem Ende-zu-Ende-Test automatisiert
  an Sonja versendet werden;
- Entwürfe werden ausschließlich lokal unter `redaktion/entwuerfe/` abgelegt;
- `publishing.live = false`;
- kein Website-Push und kein Facebook-Post.

Nach Verbindung des echten Kontos müssen Absenderprofil, Testmail,
Portalzugriff, Freigabeschaltfläche, Statusrückkanal und Meta-Zugriffe separat
erfolgreich geprüft werden.

## 7. Vorbereitete Meta-Ziele

Stand 26. Juli 2026:

- Facebook-Seite:
  `https://www.facebook.com/profile.php?id=61592114716986`;
- Facebook-Profilreferenz aus dem öffentlichen Link: `61592114716986`;
- Facebook-Seiten-ID der Graph API: `1233044893228412`;
- Instagram: `https://www.instagram.com/ostea.osteopathie/`;
- Instagram-Konto-ID der Graph API: `17841438043600514`;
- Facebook-Seite und Instagram-Konto sind im Meta Business Portfolio
  hinterlegt und miteinander verbunden;
- Meta-Entwickler-App „OSTEA Redaktion“ ist erstellt; App-ID:
  `1047438204438097`;
- die Inhaltsberechtigungen für Instagram wurden im Meta-Assistenten
  hinzugefügt; Messaging- und Kommentarberechtigungen bleiben deaktiviert;
- die abgesicherten OAuth-, Deautorisierungs- und Datenlöschungs-Endpunkte sind
  im Freigabeportal implementiert, getestet und in der öffentlichen Version
  veröffentlicht;
- die Rückruf-Endpunkte sind öffentlich erreichbar; unautorisierte Aufrufe der
  Deautorisierungs- und Datenlöschungs-Endpunkte werden abgewiesen;
- OAuth-Redirect-URI, Deautorisierungs-Callback und URL für
  Datenlöschungsanfragen sind in der Meta-App gespeichert und validiert;
- die Facebook-Login-for-Business-Konfiguration
  „OSTEA Redaktion - F & I“ wurde mit Systemnutzer-Zugriffstoken sowie den
  erforderlichen Seiten- und Instagram-Assets erstellt; Konfigurations-ID:
  `1716090582996609`;
- die Facebook-Login-Konfigurations-ID ist in der öffentlichen
  Hosting-Umgebung aktiviert;
- die geschützte Meta-Eingabe ist unter
  `https://ostea-freigabeportal.hoffmann877528.chatgpt.site/meta/connect`
  öffentlich bereitgestellt, verlangt aber die Anmeldung des freigegebenen
  Portal-Administrators;
- der Portal-Administrator kann dort einen Einmallink für Sonjas Mobilgerät
  erzeugen; Sonja benötigt dafür kein ChatGPT-Konto;
- der Mobil-Code wird nur als SHA-256-Hash gespeichert, ist 15 Minuten gültig
  und wird beim ersten Öffnen verbraucht;
- das App-Secret wird dort ausschließlich serverseitig verschlüsselt
  gespeichert, niemals erneut angezeigt und nicht protokolliert;
- App-Secret und Graph-API-Version sind über die geschützte Eingabe
  serverseitig gespeichert; der Geheimcode wird im Portal nicht erneut
  angezeigt;
- der Systemnutzer `Ostea-Publishing` ist der App sowie den OSTEA-Assets
  zugewiesen; sein Zugriffstoken ist als nicht auslesbares Hosting-Secret
  hinterlegt;
- der schreibgeschützte Live-Test bestätigt den Systemnutzer, alle benötigten
  Berechtigungen, die Facebook-Seite `OSTEA.Osteopathie` und das verknüpfte
  Instagram-Konto `ostea.osteopathie`;
- der nicht öffentliche Schreibtest ist bestanden: Auf Facebook wurde ein
  ausdrücklich unveröffentlichter Seitenbeitrag erstellt, als unveröffentlicht
  bestätigt und unmittelbar wieder gelöscht;
- auf Instagram wurde ausschließlich ein Mediencontainer erzeugt und bis
  `FINISHED` geprüft; der getrennte Veröffentlichungsschritt wurde nicht
  aufgerufen, daher erschien kein Instagram-Beitrag;
- der Veröffentlichungskern leitet für Facebook den Seiten-Zugriffstoken
  serverseitig aus dem Systemnutzer-Token ab und trennt bei Instagram das
  Erstellen des Mediencontainers ausdrücklich vom Veröffentlichen;
- sichtbare Facebook- und Instagram-Veröffentlichungen bleiben durch
  `META_PUBLICATION_ENABLED = false` serverseitig gesperrt, bis Versandroute,
  Website-Veröffentlichung und Instagram-Bilderzeugung gemeinsam in einem
  freigegebenen Ende-zu-Ende-Lauf geprüft sind;
- die geschützte Versandroute verarbeitet ausschließlich Entwürfe mit Status
  `approved` und ausschließlich die von Sonja ausgewählten Kanäle; der
  Automationszugriff benötigt das bestehende serverseitige
  `PORTAL_INGEST_SECRET`;
- für jeden Entwurf und Kanal existiert genau ein Versanddatensatz. Bereits
  veröffentlichte Kanäle werden nicht erneut versendet; bei einem uneindeutigen
  Meta-Ergebnis wird statt eines automatischen Wiederholungsversuchs der Status
  `manual_check_required` gesetzt;
- wurde auch die Website freigegeben, warten Facebook und Instagram auf die
  öffentlich erreichbare Artikel-URL. Instagram wartet zusätzlich auf die
  freigegebene, öffentlich erreichbare Bilddatei;
- die tatsächliche Graph-API-Seiten-ID unterscheidet sich von der Referenz-ID
  des öffentlichen mobilen Facebook-Links und wurde in der Serverkonfiguration
  korrigiert;
- `meta.live` und `publishing.live` bleiben bis zum ersten vollständig
  freigegebenen Ende-zu-Ende-Lauf auf `false`.

App-Secret, Zugriffstoken und Wiederherstellungscodes dürfen ausschließlich als
serverseitige Geheimnisse gespeichert werden. Sie gehören weder in diesen
Arbeitsplan noch in Git, E-Mails oder den Codex-Chat.
