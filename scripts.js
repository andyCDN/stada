const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')];
const total = checkboxes.length;

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

const saved = JSON.parse(localStorage.getItem('cleaning-progress') || '[]');
checkboxes.forEach((box, index) => {
  box.checked = Boolean(saved[index]);
  box.addEventListener('change', updateProgress);
});

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

updateProgress();
