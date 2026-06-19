const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const passwordInput = document.getElementById('password');
const unlockBtn = document.getElementById('unlock-btn');
const statusEl = document.getElementById('status');

let currentFile = null;
let busy = false;

function setStatus(type, msg) {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + type;
}

function clearStatus() {
  statusEl.textContent = '';
  statusEl.className = 'status';
}

function tryAutoUnlock() {
  if (!busy && currentFile && passwordInput.value) doUnlock();
}

function doUnlock() {
  if (busy) return;
  if (!currentFile) { setStatus('error', 'Drop or select a PDF first.'); return; }

  busy = true;
  unlockBtn.disabled = true;
  setStatus('working', 'Decrypting…');

  const file = currentFile;
  const password = passwordInput.value;

  const reader = new FileReader();
  reader.onload = ({ target: { result } }) => {
    const bytes = new Uint8Array(result);
    const worker = new Worker('./worker.js', { type: 'module' });

    worker.onmessage = ({ data }) => {
      busy = false;
      unlockBtn.disabled = false;

      if (data.ok) {
        const blob = new Blob([data.bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const base = file.name.replace(/\.pdf$/i, '');
        a.href = url;
        a.download = base + '-unlocked.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatus('success', '✓ Saved as ' + a.download);
      } else {
        if (data.code === 2) {
          setStatus('error', 'Incorrect password.');
        } else {
          setStatus('error', data.message || 'qpdf error (code ' + data.code + ').');
        }
      }
    };

    worker.onerror = (e) => {
      busy = false;
      unlockBtn.disabled = false;
      setStatus('error', 'Worker error: ' + (e.message || e));
    };

    worker.postMessage({ bytes, password, name: file.name }, [bytes.buffer]);
  };
  reader.readAsArrayBuffer(file);
}

function acceptFile(file) {
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    setStatus('error', 'Please select a PDF file.');
    return;
  }
  currentFile = file;
  document.getElementById('drop-label').textContent = file.name;
  dropZone.classList.add('has-file');
  clearStatus();
  tryAutoUnlock();
}

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  acceptFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) acceptFile(fileInput.files[0]);
  fileInput.value = '';
});

passwordInput.addEventListener('input', tryAutoUnlock);
unlockBtn.addEventListener('click', doUnlock);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
