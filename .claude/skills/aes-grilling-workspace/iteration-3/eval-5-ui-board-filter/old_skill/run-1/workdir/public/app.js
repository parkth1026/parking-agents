async function load() {
  const tasks = await (await fetch('/api/tasks')).json();
  for (const task of tasks) {
    const list = document.querySelector(`[data-status="${task.status}"] ul`);
    const li = document.createElement('li');
    li.className = 'card';
    li.textContent = `${task.title} — ${task.assignee}`;
    list.append(li);
  }
}
load();
