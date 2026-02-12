function normalizeGatewayUrlForSecureContext(upstreamUrl) {
    const urlObj = new URL(upstreamUrl);
    if (urlObj.hostname === '127.0.0.1' || urlObj.hostname === '::1' || urlObj.hostname === '0.0.0.0') {
        urlObj.hostname = 'localhost';
    }
    return urlObj.toString();
}

// Assume this is the existing resolveOriginForUpstream function
function resolveOriginForUpstream(upstreamUrl) {
    // ... existing logic ...
}

// Loading settings
const settings = loadSettings();
let upstreamUrl = settings.upstreamUrl;
upstreamUrl = normalizeGatewayUrlForSecureContext(upstreamUrl); // Normalize the URL

// ... continue with the rest of the proxy logic ...
