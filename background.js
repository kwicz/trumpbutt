// Function to safely access chrome APIs with retry
async function safelyAccessChrome(operation, maxRetries = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      if (e.message.includes('Extension context invalidated')) {
        // For background script, we don't need to retry as much since it will auto-reload
        console.warn('Background script context invalidated');
        return null;
      }
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * Math.pow(2, attempt))
        );
        continue;
      }
      throw e;
    }
  }
  return null;
}

// Initialize extension settings when installed
chrome.runtime.onInstalled.addListener(async () => {
  await safelyAccessChrome(async () => {
    await new Promise((resolve) => {
      chrome.storage.local.set(
        {
          extensionActive: true,
          wordsReplaced: 0,
        },
        resolve
      );
    });
  });
});

// Function to safely handle runtime errors
function handleRuntimeError(error) {
  if (
    error &&
    error.message &&
    error.message.includes('Extension context invalidated')
  ) {
    console.warn(
      'Background script context invalidated. Reloading extension...'
    );
    // The extension will automatically reload itself
    return;
  }
  console.error('Runtime error:', error);
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (request.action === 'toggleExtension') {
        await safelyAccessChrome(async () => {
          // Update the extension state
          await new Promise((resolve) => {
            chrome.storage.local.set(
              { extensionActive: request.active },
              resolve
            );
          });

          // Send message to all tabs to update their state
          const tabs = await new Promise((resolve) => {
            chrome.tabs.query({}, resolve);
          });

          await Promise.all(
            tabs.map(
              (tab) =>
                new Promise((resolve) => {
                  try {
                    chrome.tabs.sendMessage(
                      tab.id,
                      {
                        action: 'toggleExtension',
                        active: request.active,
                      },
                      () => {
                        // Ignore any chrome.runtime.lastError here as some tabs may not have content script
                        if (chrome.runtime.lastError) {
                          console.debug(
                            'Could not send message to tab:',
                            chrome.runtime.lastError
                          );
                        }
                        resolve();
                      }
                    );
                  } catch (e) {
                    console.debug('Error sending message to tab:', e);
                    resolve();
                  }
                })
            )
          );
        });

        sendResponse({ success: true });
      }

      if (request.action === 'getStats') {
        const result = await safelyAccessChrome(async () => {
          return await new Promise((resolve) => {
            chrome.storage.local.get(
              ['extensionActive', 'wordsReplaced'],
              resolve
            );
          });
        });

        sendResponse({
          active: result?.extensionActive ?? true,
          wordsReplaced: result?.wordsReplaced ?? 0,
        });
      }

      if (request.action === 'incrementWordCount') {
        await safelyAccessChrome(async () => {
          const result = await new Promise((resolve) => {
            chrome.storage.local.get(['wordsReplaced'], resolve);
          });

          const newCount = (result?.wordsReplaced || 0) + (request.count || 1);
          await new Promise((resolve) => {
            chrome.storage.local.set({ wordsReplaced: newCount }, resolve);
          });

          sendResponse({ success: true, newCount: newCount });
        });
      }

      if (request.action === 'resetStats') {
        await safelyAccessChrome(async () => {
          await new Promise((resolve) => {
            chrome.storage.local.set({ wordsReplaced: 0 }, resolve);
          });
          sendResponse({ success: true });
        });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // Keep message channel open for async response
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // This is handled by the manifest (popup.html), but we'll add error handling just in case
    await safelyAccessChrome(async () => {
      // You can add custom logic here if needed
    });
  } catch (error) {
    console.error('Error handling icon click:', error);
  }
});
