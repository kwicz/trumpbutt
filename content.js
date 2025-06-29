// Function to check if extension context is valid
function isExtensionValid() {
  try {
    chrome.runtime.getURL('');
    return true;
  } catch (e) {
    return false;
  }
}

// Function to safely access chrome APIs with retry and reconnection
async function safelyAccessChrome(operation, maxRetries = 3) {
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (!isExtensionValid()) {
      // Check if this is a full extension reload
      if (
        lastError &&
        lastError.message &&
        lastError.message.includes('Extension context invalidated')
      ) {
        // Wait longer for extension reload
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // If we've waited and the extension is still invalid, try reloading the page
        if (attempt === maxRetries - 1 && !isExtensionValid()) {
          console.warn(
            'Extension context invalidated. Attempting to reload...'
          );
          location.reload();
          return null;
        }
      } else {
        // Standard retry delay
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * Math.pow(2, attempt))
        );
      }
      continue;
    }

    try {
      return await operation();
    } catch (e) {
      lastError = e;
      if (e.message.includes('Extension context invalidated')) {
        if (attempt === maxRetries - 1) {
          console.warn(
            'Extension context invalidated. Attempting to reload...'
          );
          location.reload();
          return null;
        }
        // Wait longer between retries for context invalidation
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
        continue;
      }
      throw e;
    }
  }
  return null;
}

// Function to safely get storage data
async function getSafeStorageData(keys) {
  return await safelyAccessChrome(
    () =>
      new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        } catch (e) {
          reject(e);
        }
      })
  );
}

// Function to replace Trump with Butt
async function replaceTrumpWithButt() {
  const storageData = await getSafeStorageData(['extensionActive']);
  if (!storageData) return;

  // Check if extension is active (default to true if not set)
  if (storageData.extensionActive !== false) {
    let replacementCount = 0;

    // Function to replace text in a text node
    function replaceInTextNode(node) {
      const originalText = node.textContent;
      const newText = originalText.replace(/\bTrump\b/g, (match) => {
        replacementCount++;
        return 'Butt';
      });

      if (newText !== originalText) {
        node.textContent = newText;
        // Store the original text for reverting later
        node._originalText = originalText;
      }
    }

    // Function to walk through all text nodes
    function walkTextNodes(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        replaceInTextNode(node);
      } else {
        // Skip script and style elements
        if (node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
          for (let child of node.childNodes) {
            walkTextNodes(child);
          }
        }
      }
    }

    // Replace text in the entire document
    walkTextNodes(document.body);

    // Update the word count if any replacements were made
    if (replacementCount > 0) {
      await safelyAccessChrome(
        () =>
          new Promise((resolve, reject) => {
            try {
              chrome.runtime.sendMessage(
                {
                  action: 'incrementWordCount',
                  count: replacementCount,
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve(response);
                  }
                }
              );
            } catch (e) {
              reject(e);
            }
          })
      );
    }
  }
}

// Function to revert all "Butt" back to "Trump"
function revertChanges() {
  function revertTextNode(node) {
    if (node._originalText) {
      node.textContent = node._originalText;
      delete node._originalText;
    }
  }

  function walkAndRevert(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      revertTextNode(node);
    } else {
      // Skip script and style elements
      if (node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
        for (let child of node.childNodes) {
          walkAndRevert(child);
        }
      }
    }
  }

  walkAndRevert(document.body);
}

// Initialize extension on page load with error handling
async function initializeExtension() {
  if (!isExtensionValid()) return;

  try {
    await replaceTrumpWithButt();
    setupObserver();
  } catch (e) {
    console.warn('Failed to initialize extension:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Watch for dynamically added content with improved error handling
let observer;

async function setupObserver() {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    (async () => {
      if (!isExtensionValid()) {
        observer.disconnect();
        return;
      }

      try {
        const storageData = await getSafeStorageData(['extensionActive']);
        if (!storageData || storageData.extensionActive === false) return;

        let replacementCount = 0;

        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            try {
              if (node.nodeType === Node.TEXT_NODE) {
                const originalText = node.textContent;
                const newText = originalText.replace(/\bTrump\b/g, () => {
                  replacementCount++;
                  return 'Butt';
                });

                if (newText !== originalText) {
                  node._originalText = originalText;
                  node.textContent = newText;
                }
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Skip script and style elements
                if (node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
                  const textNodes = document.createTreeWalker(
                    node,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                  );

                  let textNode;
                  while ((textNode = textNodes.nextNode())) {
                    const originalText = textNode.textContent;
                    const newText = originalText.replace(/\bTrump\b/g, () => {
                      replacementCount++;
                      return 'Butt';
                    });

                    if (newText !== originalText) {
                      textNode._originalText = originalText;
                      textNode.textContent = newText;
                    }
                  }
                }
              }
            } catch (nodeError) {
              console.debug('Error processing node:', nodeError);
              // Continue with other nodes
            }
          }
        }

        // Update the word count if any replacements were made
        if (replacementCount > 0) {
          await safelyAccessChrome(
            () =>
              new Promise((resolve, reject) => {
                try {
                  chrome.runtime.sendMessage(
                    {
                      action: 'incrementWordCount',
                      count: replacementCount,
                    },
                    (response) => {
                      if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                      } else {
                        resolve(response);
                      }
                    }
                  );
                } catch (e) {
                  reject(e);
                }
              })
          );
        }
      } catch (error) {
        console.warn('Error in mutation observer:', error);
        // Don't disconnect observer on transient errors
        if (error.message.includes('Extension context invalidated')) {
          observer.disconnect();
        }
      }
    })();
  });

  try {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  } catch (e) {
    console.warn('Failed to set up observer:', e);
  }
}

// Listen for messages with improved error handling
try {
  if (isExtensionValid()) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!isExtensionValid()) {
        sendResponse({ success: false, error: 'Extension context invalid' });
        return false;
      }

      if (request.action === 'toggleExtension') {
        (async () => {
          try {
            if (request.active) {
              await replaceTrumpWithButt();
              setupObserver();
            } else {
              revertChanges();
              if (observer) {
                observer.disconnect();
              }
            }
            sendResponse({ success: true });
          } catch (e) {
            console.warn('Error handling toggle:', e);
            sendResponse({ success: false, error: e.message });
          }
        })();
        return true; // Keep the message channel open
      }

      return false; // Don't keep message channel open for unhandled messages
    });
  } else {
    console.warn('Extension context invalid — skipping onMessage listener');
  }
} catch (e) {
  console.warn('Failed to register message listener:', e);
}

// Global error handler for extension context invalidation
window.addEventListener('error', function (event) {
  if (
    event.error &&
    event.error.message &&
    event.error.message.includes('Extension context invalidated')
  ) {
    // Optionally reload or show a user-friendly message
    location.reload();
    event.preventDefault();
  }
});
