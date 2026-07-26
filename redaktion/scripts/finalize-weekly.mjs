import {
  appendFile,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

const PORTAL_URL = requiredEnv("OSTEA_PORTAL_URL").replace(/\/+$/, "");
const TRIGGER_SECRET = requiredEnv("OSTEA_WEEKLY_TRIGGER_SECRET");
const OPENAI_API_KEY = requiredEnv("OPENAI_API_KEY");
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-5.6";

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

async function githubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8");
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

function pngDimensions(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error("Die finale Datei ist kein gültiges PNG.");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 512 || height < 512) {
    throw new Error("Die finale Bilddatei ist zu klein.");
  }
  return { width, height };
}

async function verifyFinalImage(bytes) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Prüfe ausschließlich die tatsächlich angehängte finale PNG-Datei.
Der exakte Text "KI-generiert" muss gut lesbar, vollständig, nicht angeschnitten
und unten rechts innerhalb des Bildes stehen. Außer diesem Pflichttext darf im
Grundmotiv keine weitere Schrift sichtbar sein. Antworte streng nach Schema.
Setze ein Prüffeld nur dann auf true, wenn es visuell eindeutig erfüllt ist.`,
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
          name: "ostea_ai_label_visual_check",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "labelVisible",
              "labelExact",
              "labelReadable",
              "labelBottomRight",
              "labelCropped",
              "noUnexpectedText",
              "notes",
            ],
            properties: {
              labelVisible: { type: "boolean" },
              labelExact: { type: "boolean" },
              labelReadable: { type: "boolean" },
              labelBottomRight: { type: "boolean" },
              labelCropped: { type: "boolean" },
              noUnexpectedText: { type: "boolean" },
              notes: { type: "string" },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Visuelle Bildprüfung fehlgeschlagen (HTTP ${response.status}).`);
  }
  const verification = JSON.parse(responseOutputText(await response.json()));
  if (
    verification.labelVisible !== true ||
    verification.labelExact !== true ||
    verification.labelReadable !== true ||
    verification.labelBottomRight !== true ||
    verification.labelCropped !== false ||
    verification.noUnexpectedText !== true
  ) {
    throw new Error(
      `Die finale Bilddatei hat die Sichtprüfung nicht bestanden: ${verification.notes || "ohne Detail"}`,
    );
  }
  return verification;
}

async function main() {
  const workDir = resolve(argument("--work-dir"));
  const state = JSON.parse(await readFile(resolve(workDir, "run.json"), "utf8"));
  const pkg = JSON.parse(
    await readFile(resolve(workDir, "portal-package.json"), "utf8"),
  );
  const image = await readFile(resolve(state.finalImagePath));
  const dimensions = pngDimensions(image);

  console.log("Die final gekennzeichnete PNG-Datei wird visuell geprüft.");
  const verification = await verifyFinalImage(image);
  pkg.payload.instagram.imageDisclosure = {
    aiGenerated: true,
    visibleText: "KI-generiert",
    mustBeInFinalPixels: true,
    verified: true,
    verifiedAt: new Date().toISOString(),
    verificationMethod:
      "OSTEA add-ai-label.ps1 plus visuelle OpenAI-Dateiprüfung",
    width: dimensions.width,
    height: dimensions.height,
  };
  await writeFile(
    resolve(workDir, "portal-package.json"),
    `${JSON.stringify(pkg, null, 2)}\n`,
    "utf8",
  );

  const form = new FormData();
  form.set("runKey", state.runKey);
  form.set("package", JSON.stringify(pkg));
  form.set("verification", JSON.stringify(verification));
  form.set("image", new Blob([image], { type: "image/png" }), "motiv-final.png");

  console.log("Bild und Redaktionspaket werden in die Freigabekarte übertragen.");
  const response = await fetch(`${PORTAL_URL}/api/editorial/weekly-complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TRIGGER_SECRET}` },
    body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.reviewUrl || !result.id) {
    throw new Error(`Freigabekarte konnte nicht erstellt werden (HTTP ${response.status}).`);
  }
  const reviewPath = resolve(workDir, "review-result.json");
  await writeFile(reviewPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await githubOutput("review_result", reviewPath);
  console.log("Freigabekarte wurde erstellt; der Einmallink bleibt im Runner geschützt.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unbekannter Fehler.");
  process.exitCode = 1;
});
