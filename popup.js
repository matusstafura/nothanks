const MIN_KEYWORD_LENGTH = 5;

const elements = {
  textarea: document.querySelector('textarea'),
  button: document.querySelector('button'),
  status: document.getElementById('status')
};

/**
 * Load saved keywords from storage
 */
function loadKeywords() {
  chrome.storage.local.get(['names'], (result) => {
    if (result.names) {
      elements.textarea.value = result.names;
      updateStats();
    }
  });
}

/**
 * Clean and validate keywords
 */
function cleanKeywords(input) {
  return input
    .split("\n")
    .map(keyword => keyword.trim())
    .filter(keyword => keyword.length >= MIN_KEYWORD_LENGTH)
    .filter((keyword, index, self) => self.indexOf(keyword) === index); // Remove duplicates
}

/**
 * Save keywords to storage
 */
function saveKeywords() {
  const input = elements.textarea.value;
  const cleaned = cleanKeywords(input);
  const savedText = cleaned.join("\n");
  
  chrome.storage.local.set({ 'names': savedText }, () => {
    console.log("Keywords saved:", cleaned);
    elements.textarea.value = savedText;
    showStatus(`Saved ${cleaned.length} keywords!`, 'success');
    updateStats();
  });
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  if (elements.status) {
    elements.status.textContent = message;
    elements.status.className = `status ${type}`;
    elements.status.style.display = 'block';
    
    setTimeout(() => {
      elements.status.style.display = 'none';
    }, 3000);
  }
}

/**
 * Update keyword statistics
 */
function updateStats() {
  const keywords = cleanKeywords(elements.textarea.value);
  const statsEl = document.getElementById('stats');
  if (statsEl) {
    statsEl.textContent = `${keywords.length} active keywords`;
  }
}

// Event listeners
elements.button.addEventListener('click', saveKeywords);

elements.textarea.addEventListener('input', () => {
  updateStats();
});

// Keyboard shortcut: Ctrl+S or Cmd+S to save
elements.textarea.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveKeywords();
  }
});

// Initialize
loadKeywords();
