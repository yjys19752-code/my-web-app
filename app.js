/* ===== State ===== */
let todos = [];
let currentFilter = 'all';

/* ===== DOM References ===== */
const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const emptyState = document.getElementById('emptyState');
const stats = document.getElementById('stats');
const filterBtns = document.querySelectorAll('.filter-btn');
const footerActions = document.getElementById('footerActions');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const dateDisplay = document.getElementById('dateDisplay');

/* ===== Date Display ===== */
function updateDate() {
    const now = new Date();
    const opts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    dateDisplay.textContent = now.toLocaleDateString('zh-CN', opts);
}

/* ===== Storage ===== */
const STORAGE_KEY = 'todo_app_data';

function loadTodos() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            todos = JSON.parse(stored);
            // ensure each todo has a createdAt timestamp
            todos = todos.map(t => ({
                ...t,
                createdAt: t.createdAt || Date.now(),
            }));
        } catch {
            todos = [];
        }
    }
}

function saveTodos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

/* ===== Todo Operations ===== */
function addTodo(text) {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const todo = {
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        text: trimmed,
        completed: false,
        createdAt: Date.now(),
    };
    todos.unshift(todo);
    saveTodos();
    render();
    showToast('✅ 任务已添加');
    return todo;
}

function deleteTodo(id) {
    const item = document.querySelector(`[data-id="${id}"]`);
    if (item) {
        item.classList.add('removing');
        item.addEventListener('animationend', () => {
            todos = todos.filter(t => t.id !== id);
            saveTodos();
            render();
            showToast('🗑️ 任务已删除');
        }, { once: true });
    } else {
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        render();
    }
}

function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    todo.completed = !todo.completed;
    saveTodos();
    render();
    if (todo.completed) {
        showToast('🎉 任务已完成');
    }
}

function clearCompleted() {
    const completed = todos.filter(t => t.completed);
    if (!completed.length) return;

    const allItems = document.querySelectorAll('.todo-item.completed');
    let removed = 0;
    allItems.forEach(item => {
        item.classList.add('removing');
        item.addEventListener('animationend', () => {
            removed++;
            if (removed === allItems.length) {
                todos = todos.filter(t => !t.completed);
                saveTodos();
                render();
                showToast(`🧹 已清除 ${removed} 项`);
            }
        }, { once: true });
    });
    // Fallback: if no DOM items are animating (filter hides them)
    if (allItems.length === 0) {
        todos = todos.filter(t => !t.completed);
        saveTodos();
        render();
        showToast('🧹 已完成项已清除');
    }
}

function editTodoText(id, newText) {
    const trimmed = newText.trim();
    if (!trimmed) return false;
    const todo = todos.find(t => t.id === id);
    if (!todo) return false;
    todo.text = trimmed;
    saveTodos();
    render();
    showToast('✏️ 任务已更新');
    return true;
}

/* ===== Filter ===== */
function setFilter(filter) {
    currentFilter = filter;
    filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    render();
}

function getFilteredTodos() {
    switch (currentFilter) {
        case 'active':
            return todos.filter(t => !t.completed);
        case 'completed':
            return todos.filter(t => t.completed);
        default:
            return todos;
    }
}

/* ===== Stats ===== */
function updateStats() {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const active = total - completed;

    const parts = [];
    if (total > 0) {
        parts.push(`待办 ${active}`);
        if (completed > 0) parts.push(`已完成 ${completed}`);
        parts.push(`共 ${total} 项`);
    } else {
        parts.push('0 项');
    }
    stats.textContent = parts.join(' · ');
}

/* ===== Render ===== */
function render() {
    const filtered = getFilteredTodos();

    // Clear list but keep DOM alive
    while (todoList.firstChild) {
        todoList.removeChild(todoList.firstChild);
    }

    if (filtered.length === 0) {
        emptyState.classList.add('visible');
        todoList.style.display = 'none';
    } else {
        emptyState.classList.remove('visible');
        todoList.style.display = '';
    }

    // Show/hide clear-completed button
    const hasCompleted = todos.some(t => t.completed);
    footerActions.classList.toggle('visible', hasCompleted);

    // Build items (insert in order, so newest are at top)
    const fragment = document.createDocumentFragment();
    filtered.forEach(todo => {
        const li = document.createElement('li');
        li.className = 'todo-item' + (todo.completed ? ' completed' : '');
        li.dataset.id = todo.id;

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'todo-checkbox';
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', () => toggleTodo(todo.id));

        // Text
        const textSpan = document.createElement('span');
        textSpan.className = 'todo-text';
        textSpan.textContent = todo.text;
        textSpan.setAttribute('contenteditable', 'false');
        // Double-click to edit
        textSpan.addEventListener('dblclick', function () {
            this.setAttribute('contenteditable', 'true');
            this.focus();
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(this);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });
        textSpan.addEventListener('blur', function () {
            this.removeAttribute('contenteditable');
            const oldText = todos.find(t => t.id === todo.id)?.text;
            if (this.textContent !== oldText) {
                editTodoText(todo.id, this.textContent);
            }
        });
        textSpan.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.blur();
            }
            if (e.key === 'Escape') {
                this.textContent = todos.find(t => t.id === todo.id)?.text || '';
                this.blur();
            }
        });
        // Click on text to toggle (but not when selecting text)
        textSpan.addEventListener('click', function (e) {
            if (this.getAttribute('contenteditable') === 'true') return;
            toggleTodo(todo.id);
        });

        // Time
        const timeSpan = document.createElement('span');
        timeSpan.className = 'todo-time';
        timeSpan.textContent = formatTime(todo.createdAt);

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'todo-delete';
        delBtn.textContent = '✕';
        delBtn.title = '删除';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTodo(todo.id);
        });

        li.appendChild(checkbox);
        li.appendChild(textSpan);
        li.appendChild(timeSpan);
        li.appendChild(delBtn);
        fragment.appendChild(li);
    });

    todoList.appendChild(fragment);
    updateStats();
}

/* ===== Time Format ===== */
function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minute = 60000;
    const hour = 3600000;
    const day = 86400000;

    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + ' 分钟前';
    if (diff < day) return Math.floor(diff / hour) + ' 小时前';

    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dayNum = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${dayNum} ${hours}:${mins}`;
}

/* ===== Toast ===== */
let toastTimer = null;

function showToast(message) {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;
    toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 2000);
}

/* ===== Event Listeners ===== */

// Add todo
addBtn.addEventListener('click', () => {
    const text = todoInput.value;
    if (addTodo(text)) {
        todoInput.value = '';
        todoInput.focus();
    }
});

todoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addBtn.click();
    }
});

// Filter buttons
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

// Clear completed
clearCompletedBtn.addEventListener('click', clearCompleted);

// Keyboard shortcut: Ctrl+Z to undo last delete? No — keep it simple.
// Keyboard shortcut: Escape to clear input
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        todoInput.blur();
    }
});

/* ===== Init ===== */
updateDate();
loadTodos();
render();
