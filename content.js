// Enable or disable logging
const enableLogging = false;

/**
 * Logs blocked content when logging is enabled.
 * @param {Object} details - The details of the blocked element.
 */
function logBlocked(details) {
  if (enableLogging) {
    console.log("Blocked:", details);
  }
}

/**
 * Retrieves the list of filtered names from storage.
 * @returns {Promise} - The list of filtered names.
 */
const filterList = () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['names'], function(result) {
      let all = [];
      if (result.names) {
        all = result.names.split("\n");
      }
      resolve(all);
    });
  });
}

// Array of objects specifying tag to search and parent to remove
const filterConfig = [
  {
    // Regular video results (homepage)
    tag: "yt-formatted-string#video-title", 
    parent: "ytd-rich-item-renderer"
  },
  {
    // Shorts in /shorts
    tag: "h2.ytShortsVideoTitleViewModelShortsVideoTitle span", 
    parent: "ytd-reel-video-renderer" 
  },
  {
    // Regular video results (search)
    tag: "yt-formatted-string", // Video results in search
    parent: "ytd-video-renderer"
  },
  {
    // Shorts in search
    tag: "ytm-shorts-lockup-view-model-v2 div h3 a span", 
    parent: "ytm-shorts-lockup-view-model-v2"
  }
];


/**
 * Hides elements based on the provided filter configuration.
 */
function hideFilteredResults() {
  filterList().then((filterList) => {
    filterConfig.forEach((config) => {
      const elements = document.querySelectorAll(config.tag);
      elements.forEach((element) => {
        filterList.forEach((filter) => {
          if (element.textContent.toLowerCase().includes(filter.toLowerCase())) {
            const parent = element.closest(config.parent);
            if (parent) {
              parent.style.display = 'none';
              logBlocked({ parent, element });
            }
          }
        });
      });
    });
  });
}

// Initial call
hideFilteredResults();

