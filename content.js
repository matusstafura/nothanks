// ============================================
// CONFIGURATION - Easy to modify
// ============================================
const CONFIG = {
  enableLogging: false,
  minKeywordLength: 5,
  
  // Selector configurations - YouTube changes these frequently
  // Add new selectors here as YouTube updates its structure
  selectors: [
    {
      name: "Homepage Videos",
      titleSelector: "span.yt-core-attributed-string",
      containerSelector: "ytd-rich-item-renderer",
      enabled: true
    },
    {
      name: "Shorts Feed",
      titleSelector: "span.yt-core-attributed-string",
      containerSelector: "div.reel-video-in-sequence-new",
      enabled: true
    },
    {
      name: "Search Results",
      titleSelector: "yt-formatted-string#video-title",
      containerSelector: "ytd-video-renderer",
      enabled: true
    },
    {
      name: "Subscription Feed",
      titleSelector: "yt-formatted-string#video-title",
      containerSelector: "ytd-grid-video-renderer",
      enabled: true
    }
    // Add more configurations as needed
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
    chrome.storage.local.get(['names'], (result) => {
      const keywords = result.names ? result.names.split("\n").filter(k => k.trim()) : [];
      log(`Loaded ${keywords.length} keywords`);
      resolve(keywords);
    });
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
 * Hides a single element if it matches keywords
 */
function processElement(element, config, keywords) {
  const text = element.textContent?.trim();
  if (!text) return false;

  const matchedKeyword = matchesKeyword(text, keywords);
  
  if (matchedKeyword) {
    const container = element.closest(config.containerSelector);
    if (container && container.style.display !== 'none') {
      container.style.display = 'none';
      logBlocked(config.name, matchedKeyword, element, container);
      return true;
    }
  }
  
  return false;
}

/**
 * Processes all elements for a given configuration
 */
function processConfig(config, keywords) {
  if (!config.enabled) {
    log(`Skipping disabled config: ${config.name}`);
    return 0;
  }

  const elements = document.querySelectorAll(config.titleSelector);
  let blockedCount = 0;

  elements.forEach(element => {
    if (processElement(element, config, keywords)) {
      blockedCount++;
    }
  });

  if (blockedCount > 0) {
    log(`${config.name}: Blocked ${blockedCount} items`);
  }

  return blockedCount;
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
