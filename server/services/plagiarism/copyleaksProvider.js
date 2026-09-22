import fs from "fs";
import {
  Copyleaks,
  CopyleaksFileSubmissionModel,
  CopyleaksStartRequestModel,
  CopyleaksStartErrorHandlings,
} from "plagiarism-checker";
import { classifySimilarity } from "../../utils/similarityThresholds.js";

// Copyleaks plagiarism provider.
//
// Uses the official `plagiarism-checker` SDK rather than hand-rolled REST calls.
// The submission and result payloads are large and versioned, and the SDK is
// published and maintained by Copyleaks, so coding against its published object
// model is far less likely to be subtly wrong than reconstructing the JSON from
// documentation prose.
//
// Credentials come from the environment (see `config`). Nothing here throws at
// import time when they are absent: `isConfigured()` reports the state and the
// registry leaves the provider unselected, so the application starts and runs
// normally on a machine with no Copyleaks account.

// Refresh a little before expiry rather than exactly at it, so a scan submitted
// across the boundary does not fail on a token that expires mid-request.
const TOKEN_SAFETY_WINDOW_MS = 5 * 60 * 1000;
const FALLBACK_TOKEN_LIFETIME_MS = 30 * 60 * 1000;

const client = new Copyleaks();

let cachedToken = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const config = () => {
  const email = process.env.COPYLEAKS_EMAIL || "";
  const apiKey = process.env.COPYLEAKS_API_KEY || "";

  return {
    email,
    apiKey,
    // Sandbox defaults to ON. A student project should not silently spend real
    // credits because a token happened to be present; real scans are opted into
    // explicitly with COPYLEAKS_SANDBOX=false.
    sandbox: String(process.env.COPYLEAKS_SANDBOX ?? "true").toLowerCase() !== "false",
    // 1 = fastest scan, 5 = most thorough.
    sensitivityLevel: clamp(Number(process.env.COPYLEAKS_SENSITIVITY_LEVEL) || 3, 1, 5),
    // Copyleaks must be able to reach this from the public internet, so it is
    // configuration rather than something derivable from the request.
    webhookBaseUrl: String(process.env.PLAGIARISM_WEBHOOK_BASE_URL || "").replace(/\/+$/, ""),
    webhookSecret: process.env.PLAGIARISM_WEBHOOK_SECRET || "",
    scanIdPrefix: process.env.COPYLEAKS_SCAN_ID_PREFIX || "internsmart",
  };
};

// A deterministic scan id.
//
// Copyleaks requires scan ids to be unique per account, and this one embeds the
// analysis row, so re-submitting the same analysis reuses the same id rather than
// creating a second scan - and an inbound webhook can be traced back to its row
// from the id alone if the row lookup ever fails.
const scanIdFor = (analysis) => `${config().scanIdPrefix}-a${analysis.id}-v${analysis.reportVersionId}`;

const isConfigured = () => {
  const c = config();
  return Boolean(c.email && c.apiKey && c.webhookBaseUrl);
};

const describe = () => {
  const c = config();
  const missing = [];
  if (!c.email) missing.push("COPYLEAKS_EMAIL");
  if (!c.apiKey) missing.push("COPYLEAKS_API_KEY");
  if (!c.webhookBaseUrl) missing.push("PLAGIARISM_WEBHOOK_BASE_URL");

  return {
    provider: "copyleaks",
    configured: missing.length === 0,
    missing,
    asynchronous: true,
    sandbox: c.sandbox,
    sensitivityLevel: c.sensitivityLevel,
    notes: c.sandbox
      ? "Running in Copyleaks sandbox mode: scans return mock results and consume no credits. Set COPYLEAKS_SANDBOX=false for real scans."
      : "Live mode: scans consume account credits.",
  };
};

const getToken = async () => {
  if (cachedToken && cachedToken.expiresAt - Date.now() > TOKEN_SAFETY_WINDOW_MS) {
    return cachedToken.token;
  }

  const c = config();
  const auth = await client.loginAsync(c.email, c.apiKey);

  // The SDK returns the raw token object; `expires` is a non-identifier property
  // name, so it is read off the response as Copyleaks sends it.
  const rawExpiry = auth?.[".expires"] ?? auth?.expires;
  const parsed = rawExpiry ? new Date(rawExpiry).getTime() : NaN;

  cachedToken = {
    token: auth,
    expiresAt: Number.isFinite(parsed) ? parsed : Date.now() + FALLBACK_TOKEN_LIFETIME_MS,
  };

  return cachedToken.token;
};

// Discard a cached token so the next call re-authenticates.
const invalidateToken = () => {
  cachedToken = null;
};

// The status URL Copyleaks will call. `{STATUS}` is a token Copyleaks replaces
// with completed / error / creditsChecked / indexed, so one endpoint serves all
// four events.
const statusWebhookUrl = () => {
  const c = config();
  const secret = c.webhookSecret ? `?secret=${encodeURIComponent(c.webhookSecret)}` : "";
  return `${c.webhookBaseUrl}/api/plagiarism/webhook/{STATUS}${secret}`;
};

const submit = async ({ analysis, version, absoluteFilePath }) => {
  if (!isConfigured()) {
    throw new Error("Copyleaks is not configured.");
  }

  if (!absoluteFilePath || !fs.existsSync(absoluteFilePath)) {
    throw new Error(`The report file could not be read at ${absoluteFilePath || "(no path)"}.`);
  }

  const c = config();
  const token = await getToken();
  const scanId = scanIdFor(analysis);
  const base64 = fs.readFileSync(absoluteFilePath).toString("base64");

  const submission = new CopyleaksFileSubmissionModel(
    base64,
    version.fileName || "report.pdf",
    {
      webhooks: { status: statusWebhookUrl() },
      sandbox: c.sandbox,
      sensitivityLevel: c.sensitivityLevel,
      // Echoed back on every webhook, so an event can be matched to its row even
      // if the scan id lookup fails.
      developerPayload: `analysis:${analysis.id}`,
    }
  );

  await client.submitFileAsync(token, scanId, submission);

  return { externalScanId: scanId };
};

// Both webhook-bearing actions arrive as unauthenticated POSTs, so this only
// translates the payload; the caller owns authentication and row lookup.
const handleStatusWebhook = async ({ analysis, event, payload }) => {
  if (event === "creditsChecked") {
    // Only produced when the account is configured for price-checking before a
    // scan. Submitting with the default action scans immediately, so this is
    // usually a no-op - but if it does arrive and is ignored, the scan never
    // runs and the analysis hangs forever, so it is handled explicitly.
    const token = await getToken();
    const model = new CopyleaksStartRequestModel(
      [analysis?.externalScanId || payload?.scanId].filter(Boolean),
      CopyleaksStartErrorHandlings.Ignore
    );
    await client.startAsync(token, model);
    return { status: "processing", message: "Credits checked; scan started." };
  }

  if (event === "indexed") {
    return { status: "processing", message: "Document indexed." };
  }

  if (event === "error") {
    const message =
      payload?.error?.message ||
      payload?.message ||
      "Copyleaks reported an error for this scan.";
    return { status: "failed", message };
  }

  if (event === "completed") {
    const score = payload?.results?.score ?? {};
    const scanned = payload?.scannedDocument ?? {};
    const aggregated = typeof score.aggregatedScore === "number" ? score.aggregatedScore : null;

    return {
      status: "completed",
      externalScore: aggregated,
      // Classified here as well as in the internal engine, so a band is present
      // whichever provider produced the number.
      plagiarismStatus: classifySimilarity(aggregated),
      totalWords: scanned.totalWords ?? null,
      matchedWords:
        (score.identicalWords ?? 0) +
        (score.minorChangedWords ?? 0) +
        (score.relatedMeaningWords ?? 0),
      // Kept verbatim. The exact shape of `internet[]` / `database[]` entries has
      // changed between API revisions, so the raw payload is retained as the
      // evidence of record and the match rows are derived tolerantly below.
      rawSummary: payload ?? null,
      matches: [
        ...toMatches(payload?.results?.internet, "external"),
        ...toMatches(payload?.results?.database, "external"),
      ],
    };
  }

  return { status: null, message: `Unhandled Copyleaks event: ${event}` };
};

// Tolerant mapping: different Copyleaks result revisions name these fields
// differently, and a missing field must degrade to a match without a title
// rather than throw away the whole result.
const toMatches = (entries, sourceType) => {
  if (!Array.isArray(entries)) return [];

  return entries.slice(0, 200).map((entry) => ({
    sourceType,
    sourceUrl: entry?.url ?? entry?.sourceUrl ?? null,
    sourceTitle: entry?.title ?? entry?.metadata?.title ?? null,
    matchedWords: entry?.matchedWords ?? entry?.totalWords ?? null,
    similarityPercentage:
      typeof entry?.score === "number"
        ? entry.score
        : typeof entry?.similarity === "number"
          ? entry.similarity
          : null,
    matchedText: Array.isArray(entry?.matchedText)
      ? entry.matchedText.join(" ").slice(0, 2000)
      : typeof entry?.matchedText === "string"
        ? entry.matchedText.slice(0, 2000)
        : null,
  }));
};

export default {
  name: "copyleaks",
  isConfigured,
  describe,
  submit,
  handleStatusWebhook,
  invalidateToken,
  config,
};
