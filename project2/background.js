try {
  importScripts("ga4.js");
} catch (e) {
  console.warn("[sf-tracker-bg] importScripts ga4.js failed:", e);
}

// -------------------- BASIC CONFIG --------------------
let SESSION_ID = "sess-" + Math.random().toString(36).substring(2, 12);
console.log("[sf-tracker-bg] Initial SESSION_ID:", SESSION_ID);

// Replace with your GA4 values
const GA4_MEASUREMENT_ID = "G-Z122VH0227";
const GA4_API_SECRET = "tnqZD2NtSv-ULdemwjuTGw";
const GA4_BATCH_EVENT_NAME = "sf_event";

// Session cookie patterns Salesforce usually uses
const COOKIE_CANDIDATES = [
  "sid",
  "sid_rt",
  "sessionId",
  "sfdc",
  "sfdc_session",
  "sid_my",
  "sid_",
  "nimbus_sid"
];

// -------------------- queue TAB NAV CHANGE --------------------
async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}


//--------------------replacing the domain url-----------------
function convertLightningToMyDomain(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".lightning.force.com")) {
      const prefix = u.hostname.replace(".lightning.force.com", "");
      return `https://${prefix}.my.salesforce.com`;
    }
    if (u.hostname.includes(".develop.lightning.force.com")) {
      const prefix = u.hostname.replace(".develop.lightning.force.com", "");
      return `https://${prefix}.file.force.com`;
    }

    return u.origin;
  } catch (e) {
    return null;
  }
}

// -------------------- FIND SESSION COOKIE --------------------
function findSessionCookieForOrigin(origin) {
  return new Promise((resolve) => {
    if (!origin) return resolve(null);

    let tried = 0;
    for (const name of COOKIE_CANDIDATES) {
      tried++;
      chrome.cookies.get({ url: origin, name }, (cookie) => {
        if (chrome.runtime.lastError) {
          console.debug("[sf-tracker-bg] cookies.get lastError for", name, chrome.runtime.lastError.message);
        } else if (cookie && cookie.value) {
          console.log("[sf-tracker-bg] Found candidate cookie:", name, { domain: cookie.domain, httpOnly: !!cookie.httpOnly });
          return resolve(cookie.value);
        }
        if (tried === COOKIE_CANDIDATES.length) {
          chrome.cookies.getAll({ url: origin }, (cookies) => {
            if (chrome.runtime.lastError) {
              console.warn("[sf-tracker-bg] cookies.getAll lastError:", chrome.runtime.lastError.message);
              return resolve(null);
            }
            if (!cookies || !cookies.length) {
              console.debug("[sf-tracker-bg] cookies.getAll returned 0 for", origin);
              return resolve(null);
            }
            console.log("[sf-tracker-bg] cookies.getAll names:", cookies.map(c => c.name));
            let guessed = cookies.find(c => /sid|session|sfdc|nimbus|oauth/i.test(c.name));
            if (!guessed) guessed = cookies.sort((a, b) => (b.value?.length || 0) - (a.value?.length || 0))[0];
            if (guessed) {
              console.log("[sf-tracker-bg] Guessed cookie:", guessed.name, { domain: guessed.domain, httpOnly: !!guessed.httpOnly });
              return resolve(guessed.value);
            }
            resolve(null);
          });
        }
      });
    }
  });
}

//-------------------- UserDetails --------------------
async function fetchUserDetailsFromSalesforce(origin, sessionToken) {
  if (!origin || !sessionToken) return null;
  try {
    const url = `${origin.replace(/\/$/, '')}/services/data/v58.0/chatter/users/me`;
    console.log('[sf-tracker-bg] fetchUserDetailsFromSalesforce calling', url);
    console.log('[sf-tracker-bg] using session token preview:', sessionToken);
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Accept': 'application/json'
      }
    }, 8000);
    const text = await res.text().catch(() => "<no-body>");
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { }
    console.log('[sf-tracker-bg] chatter/me response', { status: res.status, bodyPreview: text && text.slice ? text.slice(0, 400) : text });
    if (!res.ok) {
      return null;
    }
    const id = json?.id || json?.userId || null;
    const displayName = json?.displayName || json?.username || null;
    console.log('[sf-tracker-bg] chatter/me success:', { id, displayName });
    return { id, displayName, raw: json, endpoint: url };
  } catch (err) {
    console.warn('[sf-tracker-bg] fetchUserDetailsFromSalesforce error:', err && (err.message || err));
    return null;
  }
}

// -------------------- message handler --------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || !msg.action) {
        return sendResponse && sendResponse({ ok: false, error: "no action" });
      }
      if (msg.action === "DumpCookiesForTab") {
        const tabUrl = sender?.tab?.url || null;
        console.log('sender ', sender);
        const origin = tabUrl ? new URL(tabUrl).origin : null;
        console.log('origin url', origin);
        if (!origin) return sendResponse({ ok: false, error: "no tab origin" });
        chrome.cookies.getAll({ url: origin }, (cookies) => {
          if (chrome.runtime.lastError) {
            return sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          }
          const rows = (cookies || []).map(c => {
            const v = c.value || "";
            const preview = (v.length > 12) ? (v.slice(0, 6) + "..." + v.slice(-6)) : v;
            return { name: c.name, domain: c.domain, httpOnly: !!c.httpOnly, secure: !!c.secure, preview, length: v.length };
          });
          return sendResponse({ ok: true, origin, count: rows.length, cookies: rows });
        });
        return true;
      }
      if (msg.action === "DebugFetchUser") {
        const tabUrl = sender?.tab?.url || null;
        const origin = convertLightningToMyDomain(tabUrl);
        if (!origin) return sendResponse({ ok: false, error: "no tab origin" });
        let cookieVal = null;
        try {
          cookieVal = await findSessionCookieForOrigin(origin);
        } catch (e) {
          console.debug("[sf-tracker-bg][DEBUG] findSessionCookieForOrigin error:", e && e.message);
        }
        if (!cookieVal) {
          chrome.cookies.getAll({ url: origin }, (cookies) => {
            if (chrome.runtime.lastError) return sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            const rows = (cookies || []).map(c => ({ name: c.name, domain: c.domain, httpOnly: !!c.httpOnly, length: (c.value || "").length }));
            return sendResponse({ ok: true, note: "no_cookie_value_found", origin, cookies: rows });
          });
          return true;
        }
        const endpoint = `${origin.replace(/\/$/, '')}/services/data/v58.0/chatter/users/me`;
        try {
          const res = await fetchWithTimeout(endpoint, { method: 'GET', headers: { Authorization: `Bearer ${cookieVal}`, Accept: 'application/json' } }, 10000);
          const text = await res.text().catch(() => "<no-body>");
          let json = null;
          try { json = text ? JSON.parse(text) : null; } catch (e) { }
          console.log("[sf-tracker-bg][DEBUG] fetch status:", res.status, "bodyPreview:", (text && text.slice ? text.slice(0, 800) : text));
          return sendResponse({ ok: true, status: res.status, textPreview: (text && text.slice ? text.slice(0, 800) : text), json });
        } catch (err) {
          console.warn("[sf-tracker-bg][DEBUG] fetch error:", err && (err.message || err));
          return sendResponse({ ok: false, error: err && (err.message || err) });
        }
      }
      if (msg.action === "sid") {
        let origin = null;
        let mydomain = null;
        let user = null;
        try {
          if (sender?.tab?.url) {
            origin = new URL(sender.tab.url).origin;
            mydomain = new URL(sender.tab.url).hostname;
          }
        } catch (e) {
          origin = null;
        }
        if ((!SESSION_ID || SESSION_ID.startsWith("sess-")) && origin) {
          console.log("[sf-tracker-bg] -------------------Attempting to find session cookie for-------", origin);
          console.log("[sf-tracker-bg] Current SESSION_ID:", SESSION_ID);
          const cookieVal = await findSessionCookieForOrigin(origin);
          if (cookieVal) {
            SESSION_ID = cookieVal;
            console.log("[sf-tracker-bg] Recovered SESSION_ID from cookies for", origin, "len:", (SESSION_ID || "").length);
          } else {
            console.debug("[sf-tracker-bg] No session cookie found for", origin);
          }
        }
        if (SESSION_ID && origin) {
          user = await fetchUserDetailsFromSalesforce(origin, SESSION_ID);
        }
        return sendResponse({ sessionId: SESSION_ID || null, mydomain, user });
      }
      if (msg.action === "logEventBatch" || msg.action === "BatchEvents") {
        const batch = Array.isArray(msg.data) ? msg.data : (Array.isArray(msg.events) ? msg.events : []);
        console.log(`[sf-tracker-bg] Received batch (${batch.length}) from tab ${sender?.tab?.id || "N/A"}`, batch);
        if (FORWARD_ENDPOINT) {
          try {
            await fetchWithTimeout(FORWARD_ENDPOINT, {
              method: 'POST', headers: { "Content-Type": "application/json", ...(FORWARD_API_KEY ? { "x-api-key": FORWARD_API_KEY } : {}) },
              body: JSON.stringify({
                sessionId: SESSION_ID || null,
                receivedAt: Date.now(),
                sourceTab: sender?.tab?.id || null,
                batchSize: batch.length,
                events: batch
              })
            }, 8000);
            console.log("[sf-tracker-bg] forwarded batch to custom endpoint");
          } catch (e) {
            console.warn("[sf-tracker-bg] forward error:", e && (e.message || e));
          }
        }
        try {
          //sendToGA4(batch);
          console.log("[sf-tracker] Sending to content forwardToGTM", batch);
          chrome.tabs.sendMessage(activeTabId, {
            action: "forwardToGTM",
            events: batch
          });
          
        } catch (e) {
          console.warn("[sf-tracker-bg] sendToGA4 failed:", e && (e.message || e));
        }
        return sendResponse({ ok: true });
      }
      return sendResponse({ ok: false, error: "unknown action" });
    } catch (err) {
      console.error("[sf-tracker-bg] onMessage handler error:", err && err.message ? err.message : err);
      try { sendResponse({ ok: false, error: err?.message || String(err) }); } catch (e) { }
    }
  })();
  return true;
});


// background-debug.js — paste whole file, then reload extension
console.log("[BG-DEBUG] service worker loaded at", new Date().toISOString());

chrome.runtime.onInstalled && chrome.runtime.onInstalled.addListener(() => {
  console.log("[BG-DEBUG] onInstalled fired");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[BG-DEBUG] onMessage received:", msg, " sender:", sender && (sender.tab ? `tab:${sender.tab.id}` : 'other'));
  // simple test responses
  if (msg && msg.action === "__PING__") {
    sendResponse({ ok: true, pong: Date.now() });
    return true;
  }
  if (msg && msg.action === "TEST_BATCH") {
    console.log("[BG-DEBUG] TEST_BATCH payload:", msg.payload);
    sendResponse({ ok: true, got: msg.payload });
    return true;
  }
  sendResponse({ ok: false, error: "unknown action" });
  return true; // keep sendResponse valid for async
});





