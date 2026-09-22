import internalProvider from "./internalProvider.js";
import copyleaksProvider from "./copyleaksProvider.js";

// Provider registry.
//
// The point of the abstraction is that the application never names a vendor.
// Adding a second external vendor means writing one module with this shape and
// registering it here; nothing in the controllers, the job queue or the library
// changes.
//
// Every provider exposes:
//   name                  identifier persisted on the analysis row
//   isConfigured()        false when the environment lacks credentials
//   describe()            diagnostics for the admin surface, never secrets
//   submit({ analysis, version, absoluteFilePath })   -> { externalScanId }
//   handleStatusWebhook({ analysis, event, payload }) -> { status, score, matches, ... }
//
// A provider that reports `isConfigured() === false` is simply not selectable;
// it is never an error to have no credentials installed.

const PROVIDERS = {
  internal: internalProvider,
  copyleaks: copyleaksProvider,
};

export const getProvider = (name) => PROVIDERS[String(name || "").toLowerCase()] || null;

export const listProviders = () =>
  Object.values(PROVIDERS).map((provider) => ({
    name: provider.name,
    ...provider.describe(),
  }));

// Which providers can actually run right now.
export const configuredProviders = () =>
  Object.values(PROVIDERS).filter((provider) => provider.isConfigured()).map((p) => p.name);

// Resolve what an analysis request should use.
//
// An explicitly requested provider is honoured only if it is configured, so a
// request cannot select a vendor the deployment has no credentials for. With no
// preference expressed, the external provider is preferred - it is the one that
// finds material from outside the institution, which is what a plagiarism check
// is for - and the internal engine is never silently substituted for it, because
// the two answer different questions.
export const resolveProvider = (requested) => {
  if (requested) {
    const provider = getProvider(requested);
    if (!provider) return { error: `Unknown provider: ${requested}` };
    if (!provider.isConfigured()) {
      return {
        error: `The ${requested} provider is not configured on this server.`,
        missing: provider.describe().missing || [],
      };
    }
    return { provider };
  }

  if (copyleaksProvider.isConfigured()) return { provider: copyleaksProvider };
  if (internalProvider.isConfigured()) return { provider: internalProvider };

  return {
    error:
      "No plagiarism provider is configured. Set COPYLEAKS_EMAIL, COPYLEAKS_API_KEY and PLAGIARISM_WEBHOOK_BASE_URL to enable external scanning.",
  };
};

export default { getProvider, listProviders, configuredProviders, resolveProvider };
