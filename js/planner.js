// ==========================================
// DAILY PLANNER MODULE (js/planner.js)
// ==========================================

const PlannerManager = {
  load(cityId) {
    try {
      const data = localStorage.getItem(`app_${cityId}_planner`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  save(cityId, items) {
    try {
      localStorage.setItem(`app_${cityId}_planner`, JSON.stringify(items));
    } catch (e) {
      console.error('[Planner] Save failed:', e);
    }
  },

  addItem(cityId, text) {
    if (!text.trim()) return null;
    const items = this.load(cityId);
    const newItem = { id: Date.now().toString(), text: text.trim(), checked: false };
    items.push(newItem);
    this.save(cityId, items);
    return newItem;
  },

  toggleItem(cityId, itemId) {
    const items = this.load(cityId);
    const item = items.find(it => it.id === itemId);
    if (item) {
      item.checked = !item.checked;
      this.save(cityId, items);
    }
  },

  deleteItem(cityId, itemId) {
    const items = this.load(cityId);
    const filtered = items.filter(it => it.id !== itemId);
    this.save(cityId, filtered);
  }
};

// Global UI Handlers
function renderPlannerItems(cityId) {
  const container = document.getElementById(`planner-items-${cityId}`);
  if (!container) return;
  const items = PlannerManager.load(cityId);
  if (items.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic text-center py-2">Žádné plány na dnes. Přidej první výše!</p>`;
    return;
  }
  container.innerHTML = items.map(item => `
    <div class="flex items-center justify-between gap-3 p-2.5 bg-slate-950/20 border border-slate-800/40 rounded-xl">
      <label class="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0 select-none">
        <input type="checkbox" ${item.checked ? 'checked' : ''} 
               onchange="togglePlannerItem('${cityId}', '${item.id}')"
               class="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-800 text-yellow-500 focus:ring-yellow-500/20 cursor-pointer">
        <span class="text-xs ${item.checked ? 'line-through text-slate-500 font-medium' : 'text-slate-300'} break-words leading-relaxed">${item.text}</span>
      </label>
      <button onclick="deletePlannerItem('${cityId}', '${item.id}')" 
              class="text-slate-500 hover:text-red-400 text-sm px-1.5 py-1 transition cursor-pointer select-none" aria-label="Smazat plán">✕</button>
    </div>
  `).join('');
}

function addPlannerItem(cityId) {
  const input = document.getElementById(`planner-add-input-${cityId}`);
  if (!input) return;
  const text = input.value;
  if (!text.trim()) return;
  PlannerManager.addItem(cityId, text);
  input.value = '';
  renderPlannerItems(cityId);
}

function togglePlannerItem(cityId, itemId) {
  PlannerManager.toggleItem(cityId, itemId);
  renderPlannerItems(cityId);
}

function deletePlannerItem(cityId, itemId) {
  PlannerManager.deleteItem(cityId, itemId);
  renderPlannerItems(cityId);
}
