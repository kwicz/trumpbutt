document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('extensionToggle');
  const wordCountEl = document.getElementById('wordCount');
  const statusEl = document.getElementById('statusText');

  // Function to safely access chrome APIs with retry
  async function safelyAccessChrome(operation, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (e) {
        if (e.message.includes('Extension context invalidated')) {
          if (attempt === maxRetries - 1) {
            console.warn('Extension context invalidated in popup');
            window.close(); // Close popup if extension is invalidated
            return null;
          }
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

  // Initialize the toggle state and load metrics
  safelyAccessChrome(
    () =>
      new Promise((resolve) => {
        chrome.storage.local.get(
          ['extensionActive', 'wordsReplaced'],
          (result) => {
            const isActive = result.extensionActive !== false; // Default to true if not set
            toggleSwitch.checked = isActive;

            // Update status display
            if (statusEl) {
              statusEl.textContent = isActive ? 'Active' : 'Disabled';
              statusEl.style.color = isActive ? '#2c1810' : '#666';
            }

            // Update word count with animation
            const wordsReplaced = result.wordsReplaced || 0;
            animateWordCount(wordsReplaced);
            resolve();
          }
        );
      })
  );

  // Add event listener to handle toggle changes
  toggleSwitch.addEventListener('change', async () => {
    const isActive = toggleSwitch.checked;

    // Update storage and notify other parts of the extension
    await safelyAccessChrome(async () => {
      await new Promise((resolve) => {
        chrome.storage.local.set({ extensionActive: isActive }, resolve);
      });

      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'toggleExtension',
            active: isActive,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          }
        );
      });

      // Update status display
      if (statusEl) {
        statusEl.textContent = isActive ? 'Active' : 'Disabled';
        statusEl.style.color = isActive ? '#2c1810' : '#666';
      }
    });
  });

  // Function to animate word count
  function animateWordCount(target) {
    let count = 0;
    const increment = Math.max(1, Math.ceil(target / 50));

    function animate() {
      if (count < target) {
        count = Math.min(count + increment, target);
        wordCountEl.textContent = count.toLocaleString();
        setTimeout(animate, 30);
      }
    }

    if (target > 0) {
      animate();
    } else {
      wordCountEl.textContent = '0';
    }
  }

  // Listen for messages from content scripts about word replacements
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'wordReplaced') {
      (async () => {
        try {
          await safelyAccessChrome(async () => {
            const result = await new Promise((resolve) => {
              chrome.storage.local.get(['wordsReplaced'], resolve);
            });

            const newCount = (result.wordsReplaced || 0) + request.count;
            await new Promise((resolve) => {
              chrome.storage.local.set({ wordsReplaced: newCount }, resolve);
            });

            wordCountEl.textContent = newCount.toLocaleString();
          });
          sendResponse({ success: true });
        } catch (e) {
          console.warn('Error updating word count:', e);
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true; // Keep the message channel open
    }
  });

  // Add click handler for logo (existing functionality)
  document.querySelector('.logo').addEventListener('click', function () {
    this.style.animation = 'none';
    setTimeout(() => {
      this.style.animation = 'bounce 2s infinite';
    }, 10);
  });
});
