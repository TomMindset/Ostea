import {
  mkdir,
  readFile,
  writeFile,
  appendFile,
} from "node:fs/promises";
import { resolve } from "node:path";

const PORTAL_URL = requiredEnv("OSTEA_PORTAL_URL").replace(/\/+$/, "");
const TRIGGER_SECRET = requiredEnv("OSTEA_WEEKLY_TRIGGER_SECRET");
const OPENAI_API_KEY = requiredEnv("OPENAI_API_KEY");
const EXTERNAL_RUN_ID = requiredEnv("OSTEA_EXTERNAL_RUN_ID");
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-5.6";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Erforderliche Konfiguration fehlt: ${name}`);
  return value;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error(`Argument fehlt: ${name}`);
  }
  return process.argv[index + 1];
}

function berlinRunKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function githubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8");
}

async function portalRequest(path, init) {
  const response = await fetch(`${PORTAL_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TRIGGER_SECRET}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Portalaufruf ${path} fehlgeschlagen (HTTP ${response.status}).`);
  }
  return body;
}

async function openAiJson(path, body) {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`OpenAI-Aufruf ${path} fehlgeschlagen (HTTP ${response.status}).`);
  }
  return response.json();
}

function responseOutputText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  return (response.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text || "")
    .join("");
}

const editorialSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "audience", "imagePrompt", "payload"],
  properties: {
    title: { type: "string" },
    audience: { type: "string" },
    imagePrompt: { type: "string" },
    payload: {
      type: "object",
      additionalProperties: false,
      required: [
        "summary",
        "evidenceNote",
        "article",
        "facebook",
        "instagram",
        "sources",
      ],
      properties: {
        summary: { type: "string" },
        evidenceNote: { type: "string" },
        article: {
          type: "object",
          additionalProperties: false,
          required: [
            "eyebrow",
            "intro",
            "sections",
            "practicalTips",
            "redFlags",
          ],
          properties: {
            eyebrow: { type: "string" },
            intro: { type: "string" },
            sections: {
              type: "array",
              minItems: 5,
              maxItems: 9,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["heading", "body"],
                properties: {
                  heading: { type: "string" },
                  body: { type: "string" },
                },
              },
            },
            practicalTips: {
              type: "array",
              minItems: 4,
              maxItems: 10,
              items: { type: "string" },
            },
            redFlags: {
              type: "array",
              minItems: 3,
              maxItems: 10,
              items: { type: "string" },
            },
          },
        },
        facebook: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: { text: { type: "string" } },
        },
        instagram: {
          type: "object",
          additionalProperties: false,
          required: ["caption", "slides", "altText"],
          properties: {
            caption: { type: "string" },
            slides: {
              type: "array",
              minItems: 6,
              maxItems: 8,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "text"],
                properties: {
                  title: { type: "string" },
                  text: { type: "string" },
                },
              },
            },
            altText: { type: "string" },
          },
        },
        sources: {
          type: "array",
          minItems: 3,
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "publisher", "year", "url", "note"],
            properties: {
              title: { type: "string" },
              publisher: { type: "string" },
              year: { type: "string" },
              url: { type: "string" },
              note: { type: "string" },
            },
          },
        },
      },
    },
  },
};

function countArticleWords(pkg) {
  const article = pkg.payload.article;
  const text = [
    article.intro,
    ...article.sections.map((item) => `${item.heading} ${item.body}`),
    ...article.practicalTips,
    ...article.redFlags,
  ].join(" ");
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function validatePackage(pkg) {
  if (!pkg || typeof pkg !== "object") throw new Error("Leeres Redaktionspaket.");
  const sources = pkg.payload?.sources;
  const sections = pkg.payload?.article?.sections;
  const redFlags = pkg.payload?.article?.redFlags;
  const slides = pkg.payload?.instagram?.slides;
  if (!Array.isArray(sources) || sources.length < 3) {
    throw new Error("Zu wenige Quellen im Redaktionspaket.");
  }
  if (
    sources.some((source) => {
      try {
        return new URL(source.url).protocol !== "https:";
      } catch {
        return true;
      }
    })
  ) {
    throw new Error("Mindestens eine Quellen-URL ist ungültig.");
  }
  if (!Array.isArray(sections) || sections.length < 5) {
    throw new Error("Der Artikel ist nicht vollständig gegliedert.");
  }
  if (!Array.isArray(redFlags) || redFlags.length < 3) {
    throw new Error("Warnzeichen fehlen.");
  }
  if (!Array.isArray(slides) || slides.length < 6) {
    throw new Error("Das Instagram-Karussell ist unvollständig.");
  }
  const words = countArticleWords(pkg);
  if (words < 850 || words > 1400) {
    throw new Error(`Die Artikellänge liegt außerhalb des Korridors (${words} Wörter).`);
  }
  const facebookLength = String(pkg.payload.facebook?.text || "").length;
  if (facebookLength < 300 || facebookLength > 800) {
    throw new Error("Der Facebook-Teaser ist zu kurz oder zu lang.");
  }
  return pkg;
}

async function createEditorialPackage({
  plan,
  config,
  runKey,
  researchDate,
  topicBrief,
}) {
  const topicDirection = topicBrief
    ? `Verbindliche Themenvorgabe für diesen Wiederaufnahmelauf:
${topicBrief}

Diese Themenvorgabe hat Vorrang vor dem regulären Wochenfokus. Nutze den
Arbeitsplan ergänzend für Zielgruppe, Saisonbezug und redaktionelle Grenzen.
Der neue Beitrag muss eigenständig sein und darf keinen bereits vorbereiteten
Beitrag in Suchintention, Aufbau oder Kernaussagen bloß duplizieren.`
    : `Nutze den Monats- und Wochenfokus des Arbeitsplans, prüfe ihn aber anhand
der aktuellen Online-Recherche. Vermeide Dopplungen mit dem im Plan genannten
vorherigen Reisethema, falls es inhaltlich bereits abgedeckt ist.`;
  const instructions = `
Du bist die wissenschaftlich sorgfältige OSTEA-Redaktion für die Praxis von
Sonja Hoffmann. Erstelle auf Deutsch genau ein neues Wochenpaket für ${runKey}.
${topicDirection}

Recherche:
- Nutze mindestens drei voneinander unabhängige, tatsächlich geöffnete Quellen.
- Mindestens eine Quelle muss eine aktuelle Leitlinie, Behörde, systematische
  Übersicht oder Cochrane-Arbeit sein.
- Bevorzuge Quellen der letzten fünf Jahre; ältere Grundlagenquellen nur, wenn
  weiterhin maßgeblich.
- Erfinde keine URL, keinen Studientyp, keine Population und kein Ergebnis.
- Notiere zu jeder Quelle in "note": Studientyp/Quellebene, untersuchte Gruppe,
  Kernaussage, wichtigste Grenze und Abrufdatum ${researchDate}.
- Naturheilkundliche Einordnungen ausdrücklich von klinisch gesicherter
  Evidenz unterscheiden.

Inhalt:
- Eigenständiger Artikel mit 900 bis 1.300 Wörtern.
- Zielgruppen sind Erwachsene, Mütter/Schwangere, Kinder oder ältere Menschen;
  wähle passend zum Monatsfokus.
- Keine Heilversprechen, keine garantierte Wirkung, keine unbelegte
  Ursachenbeseitigung und keine Diagnose aus der Ferne.
- Praktische, risikoarme Möglichkeiten zur Linderung, klare Grenzen der
  Selbsthilfe und konkrete Warnzeichen.
- Osteopathie vorsichtig als mögliche individuelle Ergänzung einordnen und
  notwendige ärztliche Diagnostik nicht ersetzen.
- Facebook-Teaser mit 350 bis 650 Zeichen.
- Instagram-Caption und sechs bis acht textliche Carousel-Folien.

Bild:
- imagePrompt beschreibt ein ruhiges, professionelles, realistisches
  redaktionelles Gesundheitsmotiv im OSTEA-Stil.
- Keine Schrift, Buchstaben, Zahlen, Logos, Wasserzeichen oder eingeblendeten
  Hinweise im Grundmotiv. Der Pflichttext wird erst danach technisch ergänzt.
- Keine manipulative Vorher-Nachher-Darstellung und keine visuelle
  Erfolgszusage. Keine erkennbare reale Person.

Gib ausschließlich das verlangte strukturierte JSON aus.
`;
  const response = await openAiJson("/responses", {
    model: TEXT_MODEL,
    reasoning: { effort: "medium" },
    tools: [
      {
        type: "web_search",
        search_context_size: "high",
        filters: {
          allowed_domains: [
            "gesund.bund.de",
            "gesundheitsinformation.de",
            "awmf.org",
            "leitlinien.de",
            "rki.de",
            "who.int",
            "nice.org.uk",
            "cochranelibrary.com",
            "pubmed.ncbi.nlm.nih.gov",
            "ncbi.nlm.nih.gov",
            "kindergesundheit-info.de",
            "cdc.gov",
            "nhs.uk",
          ],
        },
      },
    ],
    include: ["web_search_call.action.sources"],
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: instructions }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Verbindlicher Arbeitsplan:\n${plan}\n\nTechnische Sicherheitsregeln:\n${config}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ostea_weekly_editorial_package",
        strict: true,
        schema: editorialSchema,
      },
    },
  });
  return validatePackage(JSON.parse(responseOutputText(response)));
}

async function createBaseImage(imagePrompt) {
  const response = await openAiJson("/images/generations", {
    model: IMAGE_MODEL,
    prompt: `${imagePrompt}

Create only the clean base motif. Do not render any text, letters, numbers,
logos, labels, captions, signatures or watermarks anywhere in the image.
Landscape editorial composition with the main subject near the center and
calm crop-safe areas on every edge.`,
    size: "1536x1024",
    quality: "medium",
    output_format: "png",
    n: 1,
  });
  const encoded = response.data?.[0]?.b64_json;
  if (typeof encoded !== "string" || encoded.length < 1000) {
    throw new Error("Die Bildgenerierung lieferte keine PNG-Datei.");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("Die Bildgenerierung lieferte kein gültiges PNG.");
  }
  return bytes;
}

async function classifyPhotoLabelRequirement(bytes) {
  try {
    const response = await openAiJson("/responses", {
      model: TEXT_MODEL,
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Prüfe dieses KI-erzeugte Grundmotiv für die OSTEA-Kennzeichnung.
"deepfakeRisk" ist genau dann true, wenn eine fotorealistische menschliche
Person zu sehen ist, die wie die Aufnahme eines realen Menschen wirken könnte.
Reine Illustrationen, Gegenstände, Räume, Körperdiagramme oder abstrakte
Grafiken ohne fotorealistische Person haben deepfakeRisk=false. Antworte
ausschließlich nach Schema.`,
            },
            {
              type: "input_image",
              image_url: `data:image/png;base64,${bytes.toString("base64")}`,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ostea_deepfake_risk_check",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["deepfakeRisk", "reason"],
            properties: {
              deepfakeRisk: { type: "boolean" },
              reason: { type: "string" },
            },
          },
        },
      },
    });
    const result = JSON.parse(responseOutputText(response));
    return {
      required: result.deepfakeRisk === true,
      reason: String(result.reason || "").slice(0, 500),
      method: "OpenAI-Sichtprüfung des KI-Grundmotivs",
    };
  } catch {
    return {
      required: true,
      reason:
        "Die automatische Risikoprüfung war nicht eindeutig; Kennzeichnung vorsorglich aktiviert.",
      method: "Sicherheitsrückfall bei fehlender Sichtprüfung",
    };
  }
}

async function main() {
  const outputDir = resolve(argument("--output-dir"));
  await mkdir(outputDir, { recursive: true });
  const runKey = process.env.OSTEA_RUN_KEY?.trim() || berlinRunKey();
  const researchDate = berlinRunKey();
  const topicBrief = String(process.env.OSTEA_TOPIC_BRIEF || "")
    .trim()
    .slice(0, 2000);

  console.log("Wochenstart wird im OSTEA-Portal registriert.");
  const trigger = await portalRequest("/api/editorial/weekly-trigger", {
    method: "POST",
    body: JSON.stringify({
      runKey,
      source: "github-actions",
      externalRunId: EXTERNAL_RUN_ID,
    }),
  });
  if (
    trigger.reviewCreated === true ||
    trigger.status === "review_created" ||
    trigger.status === "approval_sent"
  ) {
    console.log("Für diese Woche existiert bereits eine Freigabekarte; Lauf beendet.");
    await githubOutput("should_continue", "false");
    return;
  }
  if (!["queued", "failed"].includes(trigger.status)) {
    throw new Error(`Der Wochenlauf hat einen unerwarteten Status: ${trigger.status}`);
  }

  const [plan, config] = await Promise.all([
    readFile(resolve("redaktion/arbeitsplan.md"), "utf8"),
    readFile(resolve("redaktion/config.json"), "utf8"),
  ]);
  console.log("Aktuelle Fachquellen werden recherchiert und das Redaktionspaket erstellt.");
  const pkg = await createEditorialPackage({
    plan,
    config,
    runKey,
    researchDate,
    topicBrief,
  });
  console.log("Das textfreie Grundmotiv wird erzeugt.");
  const image = await createBaseImage(pkg.imagePrompt);
  console.log("Das Grundmotiv wird auf ein mögliches Deepfake-Risiko geprüft.");
  const photoDisclosure = await classifyPhotoLabelRequirement(image);

  const packagePath = resolve(outputDir, "portal-package.json");
  const rawImagePath = resolve(outputDir, "motiv.png");
  const finalAssetsDirectory = resolve(outputDir, "final-assets");
  const assetManifestPath = resolve(outputDir, "asset-manifest.json");
  const statePath = resolve(outputDir, "run.json");
  await Promise.all([
    writeFile(packagePath, `${JSON.stringify({ ...pkg, version: 1 }, null, 2)}\n`, "utf8"),
    writeFile(rawImagePath, image),
    writeFile(
      statePath,
      `${JSON.stringify({
        runKey,
        packagePath,
        rawImagePath,
        finalAssetsDirectory,
        assetManifestPath,
        photoLabelRequired: photoDisclosure.required,
        photoLabelAssessment: photoDisclosure,
      }, null, 2)}\n`,
      "utf8",
    ),
  ]);

  await githubOutput("should_continue", "true");
  await githubOutput("work_dir", outputDir);
  console.log("Redaktionspaket und Grundmotiv sind für die Kanalbilder bereit.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unbekannter Fehler.");
  process.exitCode = 1;
});
