const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')];
const syncStatus = document.querySelector('#sync-status');
const total = checkboxes.length;
let applyingRemoteState = false;

function updateProgress() {
  const done = checkboxes.filter((box) => box.checked).length;
  const percent = Math.round((done / total) * 100);
  document.querySelector('#percent').textContent = `${percent}%`;
  document.querySelector('#done-count').textContent = `${done} av ${total}`;
  document.querySelector('.ring').style.setProperty('--progress', `${percent * 3.6}deg`);

  document.querySelectorAll('.task-card').forEach((card) => {
    const cardBoxes = [...card.querySelectorAll('input')];
    const cardDone = cardBoxes.filter((box) => box.checked).length;
    card.querySelector('.count').textContent = `${cardDone} / ${cardBoxes.length}`;
  });
  localStorage.setItem('cleaning-progress', JSON.stringify(checkboxes.map((box) => box.checked)));
}

function applyState(state) {
  applyingRemoteState = true;
  checkboxes.forEach((box, index) => { box.checked = Boolean(state[index]); });
  updateProgress();
  applyingRemoteState = false;
}

async function shareChange(index, checked) {
  try {
    const response = await fetch('/api/checklist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, checked })
    });
    if (!response.ok) throw new Error('Sync failed');
  } catch {
    syncStatus.className = 'sync-pill offline';
    syncStatus.innerHTML = '<span>●</span> Sparad på enheten';
  }
}

const saved = JSON.parse(localStorage.getItem('cleaning-progress') || '[]');
applyState(saved);
checkboxes.forEach((box, index) => {
  box.addEventListener('change', () => {
    updateProgress();
    if (!applyingRemoteState) shareChange(index, box.checked);
  });
});

function connectSync() {
  const events = new EventSource('/api/events');
  events.addEventListener('state', (event) => {
    const payload = JSON.parse(event.data);
    applyState(payload.state);
    syncStatus.className = 'sync-pill online';
    syncStatus.innerHTML = `<span>●</span> ${payload.users} ${payload.users === 1 ? 'ansluten' : 'anslutna'}`;
  });
  events.onerror = () => {
    syncStatus.className = 'sync-pill offline';
    syncStatus.innerHTML = '<span>●</span> Sparad på enheten';
  };
}

document.querySelectorAll('.tabs button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.tabs .active').classList.remove('active');
    button.classList.add('active');
    const filter = button.dataset.filter;
    document.querySelectorAll('.task-card').forEach((card) => {
      card.classList.toggle('hidden', filter !== 'all' && card.dataset.day !== filter);
    });
  });
});

connectSync();
