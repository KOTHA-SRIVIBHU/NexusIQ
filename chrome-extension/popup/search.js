const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const resultsDiv = document.getElementById('results');
const searchStatus = document.getElementById('search-status');

async function init() {
  const { nexusSearch } = await chrome.storage.session.get('nexusSearch');
  if (nexusSearch?.query) {
    searchInput.value = nexusSearch.query;
    await chrome.storage.session.remove('nexusSearch');
    doSearch();
  }
}

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});
searchBtn.addEventListener('click', doSearch);

async function doSearch() {
  const q = searchInput.value.trim();
  if (!q) return;

  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';
  resultsDiv.innerHTML = '';
  searchStatus.classList.remove('hidden');
  searchStatus.textContent = 'Searching...';

  try {
    const data = await searchDocuments(q, 5);
    const results = data.results || [];
    searchStatus.classList.add('hidden');

    if (results.length === 0) {
      resultsDiv.innerHTML = '<div class="empty-state">No results found</div>';
      return;
    }

    for (const r of results) {
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `
        <div class="result-name">${escapeHtml(r.documentName || 'Unknown')}</div>
        ${r.score != null ? `<span class="result-score ${
          r.score >= 80 ? 'score-high' : r.score >= 50 ? 'score-mid' : 'score-low'
        }">${r.score}%</span>` : ''}
        <div class="result-text">${escapeHtml((r.chunk?.text || '').slice(0, 300))}</div>
      `;
      resultsDiv.appendChild(card);
    }
  } catch (err) {
    searchStatus.className = 'text-xs error text-center mt-2';
    searchStatus.textContent = err.message || 'Search failed';
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
}

document.getElementById('open-settings').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById('open-upload').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab?.id || !tab.url) return;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText?.slice(0, 50000) || '',
      });
      const content = `URL: ${tab.url}\nTitle: ${tab.title || ''}\n\n--- Page Content ---\n\n${result || ''}`;
      await chrome.storage.session.set({
        nexusShare: { type: 'page', text: content, pageUrl: tab.url, title: tab.title || '' },
      });
      window.close();
      chrome.windows.create({
        url: chrome.runtime.getURL('popup/upload.html'),
        type: 'popup',
        width: 480,
        height: 600,
      });
    } catch (e) {
      console.error(e);
    }
  });
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
