try { importScripts('shared.js'); } catch (e) { /* ignore */ }

const MENU_IDS = {
  SHARE_SELECTION: 'nexusiq-share-selection',
  SEARCH_SELECTION: 'nexusiq-search-selection',
  SHARE_PAGE: 'nexusiq-share-page',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_IDS.SHARE_SELECTION,
    title: 'Share selection to NexusIQ',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: MENU_IDS.SEARCH_SELECTION,
    title: 'Search NexusIQ for "%s"',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: MENU_IDS.SHARE_PAGE,
    title: 'Share this page to NexusIQ',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const loggedIn = await isLoggedIn();
  if (!loggedIn) {
    chrome.runtime.openOptionsPage();
    return;
  }

  switch (info.menuItemId) {
    case MENU_IDS.SHARE_SELECTION:
      await chrome.storage.session.set({
        nexusShare: { type: 'text', text: info.selectionText, pageUrl: info.pageUrl, title: tab?.title || '' },
      });
      chrome.windows.create({
        url: chrome.runtime.getURL('popup/upload.html'),
        type: 'popup',
        width: 480,
        height: 600,
      });
      break;

    case MENU_IDS.SEARCH_SELECTION:
      await chrome.storage.session.set({
        nexusSearch: { query: info.selectionText },
      });
      chrome.windows.create({
        url: chrome.runtime.getURL('popup/search.html'),
        type: 'popup',
        width: 520,
        height: 600,
      });
      break;

    case MENU_IDS.SHARE_PAGE:
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
            const text = document.body.innerText || '';
            return { description: metaDesc, text: text.slice(0, 50000) };
          },
        });
        const content = `URL: ${info.pageUrl}\nTitle: ${tab?.title || ''}\nDescription: ${result?.description || ''}\n\n--- Page Content ---\n\n${result?.text || ''}`;
        await chrome.storage.session.set({
          nexusShare: { type: 'page', text: content, pageUrl: info.pageUrl, title: tab?.title || '' },
        });
        chrome.windows.create({
          url: chrome.runtime.getURL('popup/upload.html'),
          type: 'popup',
          width: 480,
          height: 600,
        });
      } catch (e) {
        console.error('Failed to extract page content:', e);
      }
      break;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'search-nexusiq') {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) { chrome.runtime.openOptionsPage(); return; }
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/search.html'),
      type: 'popup',
      width: 520,
      height: 600,
    });
  }
});

// API proxy: popup → background → gateway
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'api') {
    handleApi(request).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
    return true; // keep channel open for async response
  }
});

async function handleApi({ method, path, body, isFormData }) {
  const { gatewayUrl, token } = await getConfig();
  const url = `${gatewayUrl}${path}`;
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let fetchBody = body;

  if (isFormData && body?._fileText) {
    const fd = new FormData();
    const blob = new Blob([body._fileText], { type: body._fileType || 'text/plain' });
    fd.append('file', blob, body._fileName || 'shared-content.txt');
    if (body.folderId) fd.append('folderId', body.folderId);
    fetchBody = fd;
  } else if (body && !isFormData) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers, body: fetchBody });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.detail || 'Request failed');
  return data;
}
