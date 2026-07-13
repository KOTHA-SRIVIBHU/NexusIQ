const folderSelect = document.getElementById('folder-select');
const fileNameInput = document.getElementById('file-name');
const contentPreview = document.getElementById('content-preview');
const sourceInfo = document.getElementById('source-info');
const uploadBtn = document.getElementById('upload-btn');
const uploadStatus = document.getElementById('upload-status');

let shareData = null;

async function init() {
  shareData = (await chrome.storage.session.get('nexusShare')).nexusShare;
  if (!shareData) {
    contentPreview.textContent = 'No data to share. Right-click text on any page and select "Share selection to NexusIQ".';
    uploadBtn.disabled = true;
    return;
  }

  if (shareData.title) {
    sourceInfo.textContent = `From: ${shareData.title}`;
  }

  fileNameInput.value = shareData.title
    ? `${shareData.title.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 60)}.txt`
    : 'shared-content.txt';

  contentPreview.textContent = (shareData.text || '').slice(0, 2000);

  try {
    const folders = await getFolders();
    folderSelect.innerHTML = '<option value="">No folder</option>';
    for (const f of folders) {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.team ? `${f.team.name} / ${f.name}` : f.name;
      folderSelect.appendChild(opt);
    }
  } catch (err) {
    folderSelect.innerHTML = '<option value="">Failed to load folders</option>';
    console.error('Folder fetch error:', err);
  }
}

uploadBtn.addEventListener('click', async () => {
  if (!shareData) return;
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading...';
  uploadStatus.classList.remove('hidden', 'error');
  uploadStatus.textContent = 'Uploading...';

  try {
    const name = fileNameInput.value.trim() || 'shared-content.txt';
    await api('POST', '/api/documents/upload', {
      _fileText: shareData.text,
      _fileName: name,
      _fileType: 'text/plain',
      folderId: folderSelect.value || undefined,
    });
    uploadStatus.className = 'text-sm success';
    uploadStatus.textContent = 'Uploaded successfully! Document is being processed.';
    uploadBtn.textContent = 'Done';
    setTimeout(() => window.close(), 2000);
  } catch (err) {
    uploadStatus.className = 'text-sm error';
    uploadStatus.textContent = err.message || 'Upload failed';
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload to NexusIQ';
  }
});

init();
