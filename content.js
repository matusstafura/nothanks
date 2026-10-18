// ============================================
// CONFIGURATION - Easy to modify
// ============================================
const CONFIG = {
  enableLogging: false,
  minKeywordLength: 5,
  
  // Selector configurations - YouTube changes these frequently
  // Add new selectors here as YouTube updates its structure
  // Container-first: YouTube renames title elements often, containers less so.
  // Title selectors are tried in order; if none match, falls back to the
  // container's own text (minus channel/metadata when a title is found).
  selectors: [
    {
      name: "Video Cards",
      containerSelector: [
        "ytd-rich-item-renderer",
        "ytd-video-renderer",
        "ytd-grid-video-renderer",
        "ytd-compact-video-renderer",
        "ytd-playlist-renderer",
        "yt-lockup-view-model",
        "ytm-shorts-lockup-view-model",
        "ytm-shorts-lockup-view-model-v2",
        "ytd-reel-item-renderer"
      ].join(","),
      titleSelector: [
        "h3[title]",
        "a.yt-lockup-metadata-view-model__title",
        ".yt-lockup-metadata-view-model__title",
        "yt-formatted-string#video-title",
        "#video-title",
        "a[title]",
        ".shortsLockupViewModelHostMetadata",
        "h3",
        "span.yt-core-attributed-string"
      ],
      enabled: true
    }
  ]
};

// ============================================
// UTILITIES
// ============================================

/**
 * Logs information when logging is enabled
 */
function log(message, data = null) {
  if (CONFIG.enableLogging) {
    console.log(`[YouTube Blocker] ${message}`, data || '');
  }
}

/**
 * Logs blocked content with details
 */
function logBlocked(configName, keyword, element, container) {
  if (CONFIG.enableLogging) {
    console.log(`[YouTube Blocker] BLOCKED by "${keyword}"`, {
      config: configName,
      title: element.textContent.trim().substring(0, 100),
      element: element,
      container: container
    });
  }
}

/**
 * Retrieves keywords from storage
 */
async function getKeywords() {
  return new Promise((resolve) => {
    // After an extension reload/update, old content scripts lose their context
    if (!chrome.runtime?.id) return resolve([]);
    try {
      chrome.storage.local.get(['names'], (result) => {
        const keywords = result?.names ? result.names.split("\n").filter(k => k.trim()) : [];
        log(`Loaded ${keywords.length} keywords`);
        resolve(keywords);
      });
    } catch (e) {
      log('Extension context invalidated, reload the page');
      resolve([]);
    }
  });
}

// ============================================
// FILTERING LOGIC
// ============================================

/**
 * Checks if text matches any keyword (case-insensitive partial match)
 */
function matchesKeyword(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.find(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
}

/**
 * Returns the title text of a container, trying each title selector in order
 */
function getTitleElement(container, titleSelectors) {
  for (const sel of titleSelectors) {
    const el = container.querySelector(sel);
    const text = (el?.getAttribute('title') || el?.textContent || '').trim();
    if (text) return { el, text };
  }
  return null;
}

/**
 * Hides a single container if its title matches keywords
 */
function processContainer(container, config, keywords) {
  if (container.style.display === 'none') return false;

  // Match title first, then the whole card text (channel name, metadata)
  const title = getTitleElement(container, config.titleSelector);
  const text = (container.innerText || container.textContent || '').trim();
  if (!text) return false;

  const matchedKeyword = matchesKeyword(`${title?.text || ''}\n${text}`, keywords);
  if (!matchedKeyword) return false;

  // Hide the outermost matching card (e.g. rich-item wrapping a lockup)
  let target = container;
  const outer = container.parentElement?.closest(config.containerSelector);
  if (outer) target = outer;
  target.style.display = 'none';
  logBlocked(config.name, matchedKeyword, title?.el || container, target);
  return true;
}

/**
 * Processes all containers for a given configuration
 */
function processConfig(config, keywords) {
  if (!config.enabled) {
    log(`Skipping disabled config: ${config.name}`);
    return 0;
  }

  let blockedCount = 0;
  document.querySelectorAll(config.containerSelector).forEach(container => {
    if (processContainer(container, config, keywords)) blockedCount++;
  });

  if (blockedCount > 0) {
    log(`${config.name}: Blocked ${blockedCount} items`);
  }
  return blockedCount;
}

/**
 * Shorts player (/shorts/...): hiding a reel with display:none breaks the
 * scroller, so instead skip to the next short when the current one matches.
 */
let lastSkippedUrl = null;
function skipBlockedShort(keywords) {
  if (!location.pathname.startsWith('/shorts/')) return;
  const reel = document.querySelector('ytd-reel-video-renderer');
  const text = reel?.innerText?.trim();
  if (!text || lastSkippedUrl === location.href) return;

  const matchedKeyword = matchesKeyword(text, keywords);
  if (!matchedKeyword) return;

  const next = document.querySelector('#navigation-button-down button');
  if (!next) return;
  lastSkippedUrl = location.href;
  log(`Skipping short, matched "${matchedKeyword}"`);
  next.click();
}

/**
 * Main filtering function
 */
async function filterContent() {
  const keywords = await getKeywords();
  
  if (keywords.length === 0) {
    log('No keywords to filter');
    return;
  }

  log('Starting filter scan...');
  skipBlockedShort(keywords);
  let totalBlocked = 0;

  CONFIG.selectors.forEach(config => {
    totalBlocked += processConfig(config, keywords);
  });

  if (totalBlocked > 0) {
    log(`Total items blocked: ${totalBlocked}`);
  }
}

// ============================================
// OBSERVERS & INITIALIZATION
// ============================================

/**
 * Debounce function to avoid excessive filtering
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Debounced filter function (runs max once per 300ms)
const debouncedFilter = debounce(filterContent, 300);

/**
 * Set up MutationObserver to watch for DOM changes
 */
function initObserver() {
  const observer = new MutationObserver((mutations) => {
    // Check if any mutations actually added nodes
    const hasAddedNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
    if (hasAddedNodes) {
      debouncedFilter();
    }
  });

  // Start observing the document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  log('MutationObserver initialized');
  return observer;
}

// ============================================
// EVENT LISTENERS
// ============================================

// Listen for storage changes (when user updates keywords)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.names) {
    log('Keywords updated, re-filtering...');
    filterContent();
  }
});

// Listen for URL changes (YouTube is a SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    log('URL changed, re-filtering...');
    setTimeout(filterContent, 500); // Small delay for content to load
  }
}).observe(document, { subtree: true, childList: true });

// ============================================
// STARTUP
// ============================================

log('Extension loaded');
log('Configuration:', CONFIG);

// Initial filter
setTimeout(filterContent, 1000); // Wait for initial page load

// Start observing
initObserver();
