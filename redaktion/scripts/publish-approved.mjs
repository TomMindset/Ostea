import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";

const PORTAL_URL = requiredEnv("OSTEA_PORTAL_URL").replace(/\/+$/, "");
const TRIGGER_SECRET = requiredEnv("OSTEA_WEEKLY_TRIGGER_SECRET");
const OPENAI_API_KEY = requiredEnv("OPENAI_API_KEY");
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-5.6";
const SITE_ORIGIN = "https://ostea.de";
const ROOT = resolve(".");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Erforderliche Konfiguration fehlt: ${name}`);
  return value;
}

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
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

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonForHtml(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function slugify(value) {
  const slug = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 78)
    .replace(/-+$/g, "");
  if (!slug) throw new Error("Aus dem Artikeltitel konnte keine URL erzeugt werden.");
  return slug;
}

function berlinCalendarDay(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

function imageInfo(bytes) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(pngSignature)) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      contentType: "image/png",
      extension: "png",
    };
  }
  if (bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Eine freigegebene Mediendatei ist weder PNG noch JPEG.");
  }
  const frames = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xda) break;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (frames.has(marker)) {
      return {
        width: bytes.readUInt16BE(offset + 5),
        height: bytes.readUInt16BE(offset + 3),
        contentType: "image/jpeg",
        extension: "jpg",
      };
    }
    offset += length;
  }
  throw new Error("Die JPEG-Abmessungen konnten nicht geprüft werden.");
}

async function downloadAsset(asset) {
  const response = await fetch(asset.imageUrl, {
    headers: { Accept: "image/png,image/jpeg" },
  });
  if (!response.ok) {
    throw new Error(
      `Freigegebene Bilddatei ${asset.channel}/${asset.position} ist nicht abrufbar (HTTP ${response.status}).`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const info = imageInfo(bytes);
  if (
    info.width !== asset.width ||
    info.height !== asset.height ||
    info.width < 512 ||
    info.height < 512
  ) {
    throw new Error(
      `Freigegebene Bilddatei ${asset.channel}/${asset.position} stimmt nicht mit der geprüften Fassung überein.`,
    );
  }
  return { bytes, info };
}

async function visuallyVerifyFinalAsset(asset, bytes, info) {
  if (
    asset.aiGenerated &&
    (!asset.disclosure?.labelRequired ||
      asset.disclosure.visibleText !== "KI-generiert" ||
      asset.disclosure.mustBeInFinalPixels !== true)
  ) {
    throw new Error(
      `KI-Bild ${asset.channel}/${asset.position} hat keine verbindliche Pixelkennzeichnung.`,
    );
  }
  if (
    asset.disclosure?.labelRequired &&
    (asset.disclosure.visibleText !== "KI-generiert" ||
      asset.disclosure.verified !== true)
  ) {
    throw new Error(
      `Die Kennzeichnung von ${asset.channel}/${asset.position} wurde vor der Freigabe nicht bestätigt.`,
    );
  }

  const labelInstruction = asset.disclosure?.labelRequired
    ? `Der exakte Text "KI-generiert" muss vollständig, gut lesbar,
nicht angeschnitten und innerhalb der finalen Bildpixel sichtbar sein.`
    : `Das Bild ist laut Freigabedatensatz nicht KI-generiert und benötigt
keinen KI-Hinweis. Prüfe dennoch, ob die Datei vollständig und visuell nutzbar ist.`;
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
              text: `Prüfe ausschließlich die angehängte, final auszuliefernde
Bilddatei. ${labelInstruction}

Antworte streng nach Schema. Setze ein Feld nur dann auf true, wenn es visuell
eindeutig erfüllt ist.`,
            },
            {
              type: "input_image",
              image_url: `data:${info.contentType};base64,${bytes.toString("base64")}`,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ostea_publication_image_check",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "imageUsable",
              "labelVisible",
              "labelExact",
              "labelReadable",
              "labelCropped",
              "notes",
            ],
            properties: {
              imageUsable: { type: "boolean" },
              labelVisible: { type: "boolean" },
              labelExact: { type: "boolean" },
              labelReadable: { type: "boolean" },
              labelCropped: { type: "boolean" },
              notes: { type: "string" },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Sichtprüfung von ${asset.channel}/${asset.position} fehlgeschlagen (HTTP ${response.status}).`,
    );
  }
  const check = JSON.parse(responseOutputText(await response.json()));
  const labelOkay =
    !asset.disclosure?.labelRequired ||
    (check.labelVisible === true &&
      check.labelExact === true &&
      check.labelReadable === true &&
      check.labelCropped === false);
  if (check.imageUsable !== true || !labelOkay) {
    throw new Error(
      `Finale Bilddatei ${asset.channel}/${asset.position} hat die Sichtprüfung nicht bestanden: ${check.notes || "ohne Detail"}`,
    );
  }
}

async function portalJson(path, init = {}) {
  const response = await fetch(`${PORTAL_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${TRIGGER_SECRET}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : `Portal-Anfrage fehlgeschlagen (HTTP ${response.status}).`,
    );
  }
  return body;
}

function articleMetadata(candidate, slug, heroFile) {
  const publishedAt = candidate.decidedAt || new Date().toISOString();
  return {
    reviewId: candidate.reviewId,
    runKey: candidate.runKey,
    slug,
    url: `${SITE_ORIGIN}/wissen/${slug}/`,
    title: candidate.title,
    audience: candidate.audience,
    summary: candidate.payload.summary,
    intro: candidate.payload.article.intro,
    eyebrow: candidate.payload.article.eyebrow,
    publishedAt,
    heroFile,
    heroAlt:
      candidate.payload.media.assets.find(
        (asset) => asset.channel === "website" && asset.position === 1,
      )?.altText || candidate.title,
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

function renderArticle(candidate, metadata) {
  const article = candidate.payload.article;
  const sources = candidate.payload.sources;
  const description = (candidate.payload.summary || article.intro).slice(0, 260);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: candidate.title,
    description,
    datePublished: metadata.publishedAt,
    dateModified: metadata.publishedAt,
    image: `${metadata.url}${metadata.heroFile}`,
    author: {
      "@type": "Person",
      name: "Sonja Hoffmann",
      jobTitle: "Heilpraktikerin und Osteopathin",
    },
    publisher: {
      "@type": "Organization",
      name: "OSTEA – Praxis für Osteopathie",
      url: SITE_ORIGIN,
    },
    mainEntityOfPage: metadata.url,
  };
  const sections = article.sections
    .map(
      (section) => `
        <section class="article-section">
          <h2>${html(section.heading)}</h2>
          ${String(section.body)
            .split(/\n{2,}/)
            .map((paragraph) => `<p>${html(paragraph)}</p>`)
            .join("\n")}
        </section>`,
    )
    .join("\n");
  const tips = article.practicalTips
    .map((tip) => `<li>${html(tip)}</li>`)
    .join("\n");
  const redFlags = article.redFlags
    .map((item) => `<li>${html(item)}</li>`)
    .join("\n");
  const sourceItems = sources
    .map(
      (source) => `
        <li>
          <a href="${html(source.url)}" target="_blank" rel="noopener noreferrer">${html(source.title)}</a>
          <span>${html(source.publisher)}${source.year ? `, ${html(source.year)}` : ""}</span>
          ${source.note ? `<p>${html(source.note)}</p>` : ""}
        </li>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${html(candidate.title)} | OSTEA Wissen</title>
    <meta name="description" content="${html(description)}">
    <meta name="ostea-review-id" content="${html(candidate.reviewId)}">
    <link rel="canonical" href="${metadata.url}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${html(candidate.title)}">
    <meta property="og:description" content="${html(description)}">
    <meta property="og:url" content="${metadata.url}">
    <meta property="og:image" content="${metadata.url}${metadata.heroFile}">
    <link rel="stylesheet" href="../../assets/symptom-pages.css">
    <link rel="stylesheet" href="../../assets/wissen.css">
    <script type="application/ld+json">${jsonForHtml(schema)}</script>
  </head>
  <body>
    <!-- OSTEA_WISSEN_REVIEW:${html(candidate.reviewId)} -->
    <a class="skip-link" href="#inhalt">Direkt zum Inhalt</a>
    <header>
      <div class="nav">
        <a class="brand" href="../../">
          <img src="../../assets/ostea-logo.jpg" alt="OSTEA Logo" width="46" height="46">
          <span><strong>OSTEA</strong><span>Praxis für Osteopathie</span></span>
        </a>
        <nav aria-label="Hauptnavigation">
          <ul>
            <li><a href="../../#fuer-wen">Für wen</a></li>
            <li><a href="../../#leistungen">Leistungen</a></li>
            <li><a href="../../#wissen">Wissen</a></li>
            <li><a href="../../#kontakt">Kontakt</a></li>
          </ul>
        </nav>
      </div>
    </header>
    <main id="inhalt">
      <nav class="breadcrumb" aria-label="Brotkrumen">
        <ol>
          <li><a href="../../">Startseite</a></li>
          <li><a href="../../#wissen">Wissen</a></li>
          <li aria-current="page">${html(candidate.title)}</li>
        </ol>
      </nav>
      <article>
        <div class="article-hero">
          <div>
            <p class="eyebrow">${html(article.eyebrow || "OSTEA Wissen")}</p>
            <h1>${html(candidate.title)}</h1>
            <p class="lead">${html(article.intro)}</p>
            <p class="article-meta">Für ${html(candidate.audience)} · veröffentlicht am ${html(formatDate(metadata.publishedAt))}</p>
          </div>
          <figure class="article-image">
            <img src="${html(metadata.heroFile)}" alt="${html(metadata.heroAlt)}" width="1200" height="800">
          </figure>
        </div>
        <div class="article-layout">
          <div class="article-copy">
            ${sections}
            <section class="article-section tips">
              <h2>Praktische Tipps für zu Hause</h2>
              <ul>${tips}</ul>
            </section>
            <section class="article-section warning">
              <h2>Wann medizinische Hilfe wichtig ist</h2>
              <ul>${redFlags}</ul>
            </section>
            <aside class="medical-note">
              <strong>Wichtiger Hinweis</strong>
              <p>Diese Informationen ersetzen keine individuelle medizinische Untersuchung oder Behandlung. Die Tipps können das Wohlbefinden unterstützen oder Beschwerden lindern, geben aber kein Heilversprechen. Bei starken, neuen, anhaltenden oder unklaren Beschwerden wenden Sie sich bitte an eine Ärztin, einen Arzt oder den medizinischen Bereitschaftsdienst.</p>
            </aside>
          </div>
          <aside class="source-panel" aria-labelledby="quellen-title">
            <h2 id="quellen-title">Quellen und Einordnung</h2>
            <p>${html(candidate.payload.evidenceNote)}</p>
            <ol>${sourceItems}</ol>
          </aside>
        </div>
      </article>
      <section class="article-cta">
        <div>
          <p class="eyebrow">OSTEA in Waiblingen</p>
          <h2>Sie möchten Ihr Anliegen persönlich besprechen?</h2>
          <p>Sonja Hoffmann begleitet Mütter, Kinder und ältere Menschen osteopathisch und naturheilkundlich – individuell und ohne Heilversprechen.</p>
        </div>
        <a class="button" href="https://calendly.com/ostea/60min" target="_blank" rel="noopener">Termin buchen</a>
      </section>
    </main>
    <footer>
      <div class="footer-inner">
        <span>&copy; OSTEA – Praxis für Osteopathie, Sonja Hoffmann</span>
        <div class="footer-links">
          <a href="../../#impressum">Impressum</a>
          <a href="../../#datenschutz">Datenschutz</a>
        </div>
      </div>
    </footer>
  </body>
</html>
`;
}

async function readArticleMetadata() {
  const base = join(ROOT, "wissen");
  try {
    const entries = await readdir(base, { withFileTypes: true });
    const records = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        records.push(
          JSON.parse(
            await readFile(join(base, entry.name, "article.json"), "utf8"),
          ),
        );
      } catch {
        // Andere Dateien im Wissen-Verzeichnis werden nicht verändert.
      }
    }
    return records.sort(
      (left, right) =>
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime(),
    );
  } catch {
    return [];
  }
}

function renderHomepageSection(records) {
  const cards = records
    .slice(0, 6)
    .map(
      (record) => `
          <article class="wissen-card">
            <a class="wissen-card-image" href="/wissen/${html(record.slug)}/">
              <img src="/wissen/${html(record.slug)}/${html(record.heroFile)}" alt="${html(record.heroAlt)}" loading="lazy">
            </a>
            <div class="wissen-card-body">
              <p class="eyebrow">${html(record.eyebrow || "OSTEA Wissen")}</p>
              <h3><a href="/wissen/${html(record.slug)}/">${html(record.title)}</a></h3>
              <p>${html(record.summary)}</p>
              <span>${html(formatDate(record.publishedAt))} · ${html(record.audience)}</span>
            </div>
          </article>`,
    )
    .join("\n");
  return `<!-- OSTEA_WISSEN_START -->
      <section id="wissen" class="band wissen-home" aria-labelledby="wissen-title">
        <div class="section-inner">
          <div class="section-head">
            <div>
              <p class="eyebrow">Wissen für den Alltag</p>
              <h2 id="wissen-title">OSTEA Wissen</h2>
            </div>
            <p>Wissenschaftlich und naturheilkundlich eingeordnete Gesundheitstipps für Mütter, Kinder und ältere Menschen – verständlich, praktisch und ohne Heilversprechen.</p>
          </div>
          <div class="wissen-grid">${cards}
          </div>
        </div>
      </section>
      <!-- OSTEA_WISSEN_END -->`;
}

async function updateHomepage() {
  const path = join(ROOT, "index.html");
  let source = await readFile(path, "utf8");
  if (!source.includes('href="assets/wissen.css"')) {
    source = source.replace(
      "</head>",
      '    <link rel="stylesheet" href="assets/wissen.css">\n  </head>',
    );
  }
  if (!source.includes('href="#wissen"')) {
    source = source.replace(
      '<li><a href="#kontakt">Kontakt</a></li>',
      '<li><a href="#wissen">Wissen</a></li>\n            <li><a href="#kontakt">Kontakt</a></li>',
    );
  }
  const section = renderHomepageSection(await readArticleMetadata());
  const marker =
    /<!-- OSTEA_WISSEN_START -->[\s\S]*?<!-- OSTEA_WISSEN_END -->/;
  if (marker.test(source)) {
    source = source.replace(marker, section);
  } else {
    source = source.replace(
      '      <section id="kontakt"',
      `${section}\n\n      <section id="kontakt"`,
    );
  }
  await writeFile(path, source, "utf8");
}

async function updateSitemap(metadata) {
  const path = join(ROOT, "sitemap.xml");
  let source = await readFile(path, "utf8");
  const lastmod = metadata.publishedAt.slice(0, 10);
  const entry = `  <url>
    <loc>${metadata.url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
  const escapedUrl = metadata.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = new RegExp(
    `  <url>\\s*<loc>${escapedUrl}<\\/loc>[\\s\\S]*?<\\/url>`,
  );
  source = existing.test(source)
    ? source.replace(existing, entry)
    : source.replace("</urlset>", `${entry}\n</urlset>`);
  await writeFile(path, source, "utf8");
}

async function prepare() {
  const outputDir = resolve(argument("--output-dir"));
  await mkdir(outputDir, { recursive: true });
  const retryReviewId = argument("--review-id").trim();
  const retryChannels = argument("--retry-channels")
    .split(",")
    .map((channel) => channel.trim())
    .filter(Boolean);
  const invalidRetryChannel = retryChannels.find(
    (channel) => !["facebook", "instagram"].includes(channel),
  );
  if (invalidRetryChannel) {
    throw new Error(
      `Ungültiger Social-Retry-Kanal: ${invalidRetryChannel}.`,
    );
  }
  if (retryChannels.length > 0 && !retryReviewId) {
    throw new Error("Social-Retry-Kanäle benötigen eine konkrete Freigabe-ID.");
  }
  const confirmManualRetry = hasFlag("--confirm-manual-retry");
  const candidatePath = retryReviewId
    ? `/api/editorial/publication-candidate?review_id=${encodeURIComponent(retryReviewId)}`
    : "/api/editorial/publication-candidate";
  const result = await portalJson(candidatePath);
  const candidate = result.candidate;
  if (!candidate) {
    console.log("Keine freigegebene Veröffentlichung wartet.");
    for (const item of result.queue ?? []) {
      console.log(
        `Redaktionslauf ${item.runKey}: Status ${item.status}; finale Dateien Website/Facebook/Instagram ` +
          `${item.mediaReadiness?.website ? "ja" : "nein"}/` +
          `${item.mediaReadiness?.facebook ? "ja" : "nein"}/` +
          `${item.mediaReadiness?.instagram ? "ja" : "nein"}; ` +
          `automatisch bereit ${item.automaticPublicationReady ? "ja" : "nein"}.`,
      );
    }
    await githubOutput("should_publish", "false");
    return;
  }
  if (!candidate.approvedChannels?.includes("website")) {
    throw new Error(
      "Der freigegebene Social-Media-Lauf hat keinen freigegebenen Website-Artikel.",
    );
  }
  const selectedChannels =
    retryChannels.length > 0
      ? [...new Set(retryChannels)]
      : candidate.approvedChannels;
  if (
    selectedChannels.some(
      (channel) => !candidate.approvedChannels.includes(channel),
    )
  ) {
    throw new Error(
      "Ein angeforderter Social-Retry-Kanal wurde nicht freigegeben.",
    );
  }
  const manual = (candidate.publications || []).find(
    (publication) =>
      selectedChannels.includes(publication?.channel) &&
      publication?.status === "manual_check_required",
  );
  if (manual && !confirmManualRetry) {
    throw new Error(
      `${manual.channel} benötigt nach einem uneindeutigen Meta-Ergebnis eine manuelle Prüfung: ${manual.error || "ohne Detail"}`,
    );
  }

  const assets = candidate.payload?.media?.assets ?? [];
  console.log(
    `Auszuführende Kanäle: ${selectedChannels.join(", ")}; finale Dateien: ${assets.length}.`,
  );
  const requiredAssets = assets.filter((asset) =>
    selectedChannels.includes(asset.channel),
  );
  if (requiredAssets.length === 0) {
    throw new Error("Der freigegebene Entwurf enthält keine finalen Kanalbilder.");
  }
  const downloaded = new Map();
  for (const asset of requiredAssets) {
    console.log(
      `Finale Datei wird vor Veröffentlichung erneut geprüft: ${asset.channel} ${asset.position}.`,
    );
    const file = await downloadAsset(asset);
    await visuallyVerifyFinalAsset(asset, file.bytes, file.info);
    downloaded.set(asset.id, file);
  }

  let websiteUrl = "";
  if (selectedChannels.includes("website")) {
    const websiteAsset = requiredAssets.find(
      (asset) => asset.channel === "website" && asset.position === 1,
    );
    if (!websiteAsset) {
      throw new Error("Das freigegebene Website-Titelbild fehlt.");
    }
    const websiteFile = downloaded.get(websiteAsset.id);
    const slug = `${berlinCalendarDay(candidate.decidedAt || new Date())}-${slugify(candidate.title)}`;
    const articleDirectory = join(ROOT, "wissen", slug);
    await mkdir(articleDirectory, { recursive: true });
    const heroFile = `hero.${websiteFile.info.extension}`;
    await writeFile(join(articleDirectory, heroFile), websiteFile.bytes);
    const metadata = articleMetadata(candidate, slug, heroFile);
    await writeFile(
      join(articleDirectory, "index.html"),
      renderArticle(candidate, metadata),
      "utf8",
    );
    await writeFile(
      join(articleDirectory, "article.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8",
    );
    await updateHomepage();
    await updateSitemap(metadata);
    websiteUrl = metadata.url;
  } else {
    const websitePublication = (candidate.publications || []).find(
      (publication) =>
        publication?.channel === "website" &&
        publication?.status === "published",
    );
    websiteUrl = String(websitePublication?.platformObjectId || "").trim();
    if (!websiteUrl.startsWith("https://")) {
      throw new Error(
        "Für den Social-Retry fehlt die bereits veröffentlichte Artikel-URL.",
      );
    }
  }

  const state = {
    reviewId: candidate.reviewId,
    runKey: candidate.runKey,
    websiteUrl,
    marker: `OSTEA_WISSEN_REVIEW:${candidate.reviewId}`,
    approvedChannels: selectedChannels,
    confirmManualRetry,
    publicationStates: Object.fromEntries(
      (candidate.publications || [])
        .filter(Boolean)
        .map((publication) => [publication.channel, publication.status]),
    ),
    finalAssetDigests: requiredAssets.map((asset) => ({
      id: asset.id,
      channel: asset.channel,
      position: asset.position,
      sha256: createHash("sha256")
        .update(downloaded.get(asset.id).bytes)
        .digest("hex"),
    })),
  };
  const statePath = join(outputDir, "publication.json");
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await githubOutput("should_publish", "true");
  await githubOutput("state_file", statePath);
  await githubOutput("article_url", state.websiteUrl);
  await githubOutput(
    "website_pending",
    String(
      state.approvedChannels.includes("website") &&
        state.publicationStates.website !== "published",
    ),
  );
  await githubOutput(
    "facebook_pending",
    String(
      state.approvedChannels.includes("facebook") &&
        state.publicationStates.facebook !== "published",
    ),
  );
  await githubOutput(
    "instagram_pending",
    String(
      state.approvedChannels.includes("instagram") &&
        state.publicationStates.instagram !== "published",
    ),
  );
  console.log(
    hasFlag("--dry-run")
      ? "Freigegebener Lauf wurde vollständig vorbereitet (Testlauf)."
      : "Freigegebener Lauf wurde vollständig vorbereitet.",
  );
}

async function waitForWebsite() {
  const state = JSON.parse(
    await readFile(resolve(argument("--state")), "utf8"),
  );
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const response = await fetch(state.websiteUrl, {
      headers: { "Cache-Control": "no-cache" },
    }).catch(() => null);
    const body = response?.ok ? await response.text() : "";
    if (response?.ok && body.includes(state.marker)) {
      console.log("Der freigegebene Artikel ist öffentlich erreichbar.");
      return;
    }
    console.log(`Warte auf GitHub Pages (${attempt}/40).`);
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, 15_000),
    );
  }
  throw new Error("Der neue Artikel wurde innerhalb von zehn Minuten nicht öffentlich.");
}

async function dispatch() {
  const state = JSON.parse(
    await readFile(resolve(argument("--state")), "utf8"),
  );
  const channel = argument("--channel");
  if (!["website", "facebook", "instagram"].includes(channel)) {
    throw new Error("Für den Versand fehlt ein gültiger Kanal.");
  }
  if (!state.approvedChannels.includes(channel)) {
    console.log(`${channel} wurde nicht freigegeben; Schritt entfällt.`);
    return;
  }

  for (let attempt = 1; attempt <= 24; attempt += 1) {
    const result = await portalJson(
      "/api/editorial/publication-dispatch",
      {
        method: "POST",
        body: JSON.stringify({
          reviewId: state.reviewId,
          websiteUrl: state.websiteUrl,
          channels: [channel],
          confirmManualRetry: state.confirmManualRetry === true,
        }),
      },
    );
    const publication = result.channels?.find(
      (item) => item.channel === channel,
    );
    if (!publication) {
      throw new Error(`Das Portal lieferte keinen Status für ${channel}.`);
    }
    if (publication.status === "published") {
      console.log(`${channel} wurde veröffentlicht.`);
      return;
    }
    if (
      publication.status === "manual_check_required" ||
      publication.status === "blocked_by_server_gate"
    ) {
      throw new Error(
        `${channel} konnte nicht automatisch bestätigt werden: ${publication.error || publication.status}`,
      );
    }
    if (
      channel !== "instagram" ||
      !["container_created", "container_processing", "processing"].includes(
        publication.status,
      )
    ) {
      throw new Error(
        `${channel} blieb im unerwarteten Status ${publication.status}.`,
      );
    }
    console.log(`Instagram verarbeitet die finalen Bilder (${attempt}/24).`);
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, 15_000),
    );
  }
  throw new Error("Instagram hat die Veröffentlichung nicht rechtzeitig bestätigt.");
}

async function main() {
  const command = process.argv[2];
  if (command === "prepare") return prepare();
  if (command === "wait") return waitForWebsite();
  if (command === "dispatch") return dispatch();
  throw new Error("Unterbefehl muss prepare, wait oder dispatch sein.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unbekannter Fehler.");
  process.exitCode = 1;
});
