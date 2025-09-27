document.addEventListener('DOMContentLoaded', () => {
  // state
  let expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  let budgets = JSON.parse(localStorage.getItem('budgets') || '{}'); 
  let groups = JSON.parse(localStorage.getItem('groups') || '{}');  
  // DOM
  const q = id => document.getElementById(id);
  const el = {
    type: q('type-select'),
    category: q('category-select'),
    customCatWrap: q('custom-cat-wrap'),
    customCat: q('custom-category'),
    amount: q('amount-input'),
    date: q('date-input'),
    note: q('note-input'),
    groupSelect: q('group-select'),
    payerSelect: q('payer-select'),
    addBtn: q('add-btn'),
    clearBtn: q('clear-form'),
    budgetMonth: q('budget-month'),
    budgetCategory: q('budget-category'),
    budgetAmount: q('budget-amount'),
    setBudgetBtn: q('set-budget-btn'),
    viewBudgetsBtn: q('view-budgets-btn'),
    budgetsList: q('budgets-list'),
    groupName: q('group-name'),
    groupMembers: q('group-members'),
    createGroupBtn: q('create-group'),
    groupBalances: q('group-balances'),
    expenseTable: q('expense-table-body'),
    notif: q('notification'),
    themeToggle: q('theme-toggle'),
    categoryChartCanvas: q('categoryChart'),
    monthlyChartCanvas: q('monthlyChart'),
  };

  // charts
  let categoryChart = null;
  let monthlyChart = null;
  Chart.register(ChartDataLabels);

  // helpers
  function saveAll(){
    localStorage.setItem('expenses', JSON.stringify(expenses));
    localStorage.setItem('budgets', JSON.stringify(budgets));
    localStorage.setItem('groups', JSON.stringify(groups));
  }
  function money(n){ return '₹' + Number(n || 0).toFixed(2); }
  function monthKeyFromDateStr(ds){ // returns 'YYYY-MM'
    if(!ds) return null;
    return ds.slice(0,7);
  }
  function notify(msg, type='info'){
    el.notif.textContent = msg;
    el.notif.classList.remove('hidden');
    el.notif.style.background = (type==='error' ? 'var(--danger)' : 'var(--accent)');
    setTimeout(()=> el.notif.classList.add('hidden'), 3000);
  }

  // initialize controls
  function initControls(){
    // default date for transaction
    el.date.value = new Date().toISOString().split('T')[0];
    // default budget month -> current month
    el.budgetMonth.value = new Date().toISOString().slice(0,7);
    // populate group select
    refreshGroupOptions();
  }

  // TRANSACTIONS
  function addTransaction(){
    let category = (el.category.value === '__custom__') ? el.customCat.value.trim() : el.category.value;
    const type = el.type.value;
    const amount = parseFloat(el.amount.value);
    const date = el.date.value;
    const note = el.note.value.trim();
    const group = el.groupSelect.value || '';
    const payer = el.payerSelect.value || '';

    if(!category || isNaN(amount) || !date){
      notify('Please enter category, amount and date', 'error'); return;
    }
    const tx = { id: Date.now(), type, category, amount: Number(amount), date, note, group, payer };
    expenses.push(tx);
    saveAll();
    clearTransactionForm();
    renderAll();
    notify('Transaction added');
  }
  function clearTransactionForm(){
    el.type.value = 'expense';
    el.category.value = '';
    el.customCat.value = '';
    el.customCatWrap.style.display = 'none';
    el.amount.value = '';
    el.date.value = new Date().toISOString().split('T')[0];
    el.note.value = '';
    el.groupSelect.value = '';
    el.payerSelect.innerHTML = '<option value="">Select payer</option>';
    el.payerSelect.disabled = true;
  }
  function deleteTransaction(id){
    if(!confirm('Delete this transaction?')) return;
    expenses = expenses.filter(t => t.id !== id);
    saveAll();
    renderAll();
    notify('Transaction deleted');
  }
  function editTransaction(id){
    const idx = expenses.findIndex(t => t.id === id);
    if(idx === -1) return;
    const t = expenses[idx];
    const newType = prompt('Type (expense/income):', t.type) || t.type;
    const newCategory = prompt('Category:', t.category) || t.category;
    const newAmount = prompt('Amount:', t.amount) || t.amount;
    const newDate = prompt('Date (YYYY-MM-DD):', t.date) || t.date;
    const newNote = prompt('Note:', t.note || '') || t.note;
    if(!newCategory || isNaN(Number(newAmount)) || !newDate){ notify('Invalid input','error'); return; }
    expenses[idx] = { ...t, type: newType, category: newCategory, amount: Number(newAmount), date: newDate, note: newNote };
    saveAll(); renderAll(); notify('Transaction updated');
  }

  // BUDGETS (per month)
  function setBudget(){
    const monthKey = el.budgetMonth.value || new Date().toISOString().slice(0,7);
    const cat = el.budgetCategory.value.trim();
    const amt = Number(el.budgetAmount.value);
    if(!cat || isNaN(amt) || amt <= 0){ notify('Enter valid category and limit','error'); return; }
    if(!budgets[monthKey]) budgets[monthKey] = {};
    budgets[monthKey][cat] = amt;
    saveAll();
    el.budgetCategory.value = ''; el.budgetAmount.value = '';
    renderBudgets();
    notify('Budget saved for ' + monthKey);
  }
  function editBudget(monthKey, category){
    const cur = budgets?.[monthKey]?.[category];
    const upd = prompt(`Update budget for ${category} (${monthKey}):`, cur);
    if(upd === null) return;
    const n = Number(upd);
    if(isNaN(n) || n <= 0){ notify('Invalid value','error'); return; }
    budgets[monthKey][category] = n;
    saveAll(); renderBudgets(); notify('Budget updated');
  }
  function deleteBudget(monthKey, category){
    if(!confirm(`Delete budget for ${category} in ${monthKey}?`)) return;
    delete budgets[monthKey][category];
    if(Object.keys(budgets[monthKey]).length === 0) delete budgets[monthKey];
    saveAll(); renderBudgets(); notify('Budget deleted');
  }
  function getSpentForCategoryInMonth(category, monthKey){
    return expenses
      .filter(e => e.type === 'expense' && monthKeyFromDateStr(e.date) === monthKey && e.category === category)
      .reduce((s, e) => s + Number(e.amount), 0);
  }
  function renderBudgets(){
    const monthKey = el.budgetMonth.value || new Date().toISOString().slice(0,7);
    const container = el.budgetsList;
    container.innerHTML = '';
    const monthBudgets = budgets[monthKey] || {};
    const keys = Object.keys(monthBudgets);
    if(keys.length === 0){
      container.innerHTML = `<div class="small-muted">No budgets set for ${monthKey}</div>`;
      return;
    }
    keys.forEach(cat => {
      const limit = Number(monthBudgets[cat]);
      const spent = getSpentForCategoryInMonth(cat, monthKey);
      const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
      const item = document.createElement('div');
      item.className = 'budget-item';
      item.innerHTML = `
        <div class="budget-left">
          <div class="budget-top"><div><strong>${cat}</strong><div class="small-muted">Month: ${monthKey}</div></div><div class="small-muted">${money(spent)} / ${money(limit)}</div></div>
          <div class="budget-progress"><div class="budget-fill" style="width:${pct}%; background:${pct>=100?getComputedStyle(document.documentElement).getPropertyValue('--danger'):'var(--accent)'}"></div></div>
        </div>
        <div class="budget-actions">
          <button class="ghost" data-month="${monthKey}" data-cat="${cat}" data-action="edit">✏️</button>
          <button class="ghost" data-month="${monthKey}" data-cat="${cat}" data-action="delete">❌</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  // GROUPS
  function createGroup(){
    const name = el.groupName.value.trim();
    const members = el.groupMembers.value.split(',').map(s => s.trim()).filter(Boolean);
    if(!name || members.length < 2){ notify('Provide group name and at least 2 members','error'); return; }
    groups[name] = members;
    saveAll();
    el.groupName.value = ''; el.groupMembers.value = '';
    refreshGroupOptions();
    renderGroups();
    notify('Group created');
  }
  function editGroup(name){
    const cur = (groups[name] || []).join(', ');
    const upd = prompt(`Edit members for "${name}" (comma separated):`, cur);
    if(upd === null) return;
    const arr = upd.split(',').map(s=>s.trim()).filter(Boolean);
    if(arr.length < 2){ notify('Group must have at least 2 members','error'); return; }
    groups[name] = arr; saveAll(); refreshGroupOptions(); renderGroups(); notify('Group updated');
  }
  function deleteGroup(name){
    if(!confirm(`Delete group "${name}"?`)) return;
    delete groups[name]; saveAll(); refreshGroupOptions(); renderGroups(); notify('Group deleted');
  }
  function computeGroupBalances(name){
    const members = groups[name] || [];
    if(members.length === 0) return { members: [], total: 0, balances: {}, settlements: [] };
    const groupTx = expenses.filter(e => e.group === name);
    const total = groupTx.reduce((s, t) => s + Number(t.amount), 0);
    const share = total / members.length || 0;
    const balances = {};
    members.forEach(m => balances[m] = -share);
    groupTx.forEach(tx => {
      const payer = tx.payer || members[0];
      if(!balances.hasOwnProperty(payer)) balances[payer] = 0;
      balances[payer] += Number(tx.amount);
    });
    // settlements
    const owes = Object.entries(balances).filter(([_,v]) => v < -0.01).map(([name,amt]) => ({ name, amount: -amt }));
    const owed = Object.entries(balances).filter(([_,v]) => v > 0.01).map(([name,amt]) => ({ name, amount: amt }));
    owes.sort((a,b) => b.amount - a.amount);
    owed.sort((a,b) => b.amount - a.amount);
    const settlements = [];
    while(owes.length && owed.length){
      const debt = owes.pop();
      const cred = owed.pop();
      const settleAmt = Math.min(debt.amount, cred.amount);
      settlements.push({ from: debt.name, to: cred.name, amount: settleAmt });
      debt.amount -= settleAmt; cred.amount -= settleAmt;
      if(debt.amount > 0.01) owes.push(debt);
      if(cred.amount > 0.01) owed.push(cred);
    }
    return { members, total, balances, settlements, share };
  }
  function renderGroups(){
    const container = el.groupBalances;
    container.innerHTML = '';
    const keys = Object.keys(groups);
    if(keys.length === 0){
      container.innerHTML = `<div class="small-muted">No groups created yet</div>`;
      return;
    }
    keys.forEach(name => {
      const info = computeGroupBalances(name);
      const div = document.createElement('div');
      div.className = 'group-balance-item';
      let html = `<div style="display:flex;justify-content:space-between;align-items:center;">
                    <div><strong>👥 ${name}</strong><div class="small-muted">Total: ${money(info.total)} • Share: ${money(info.share)}</div></div>
                    <div>
                      <button class="ghost" data-group="${name}" data-action="edit">✏️</button>
                      <button class="ghost" data-group="${name}" data-action="delete">❌</button>
                    </div>
                  </div>`;
      html += '<div class="member-row">';
      Object.keys(info.balances).forEach(m => {
        html += `<div class="member-badge">${m} <div style="font-size:0.85rem;color:var(--muted);margin-left:8px">${money(info.balances[m])}</div></div>`;
      });
      html += '</div>';
      html += '<div class="settlements" style="margin-top:8px"><strong>Settlements</strong>';
      if(info.settlements.length === 0) html += '<div class="small-muted">All settled</div>';
      else {
        info.settlements.forEach(s => {
          html += `<div class="settlement" style="display:flex;justify-content:space-between;margin-top:6px">
            <div>${s.from} → ${s.to}: <strong>${money(s.amount)}</strong></div>
            <div><button class="ghost" data-group="${name}" data-from="${s.from}" data-to="${s.to}" data-amt="${s.amount}" data-action="settle">Mark paid</button></div>
          </div>`;
        });
      }
      html += '</div>';
      div.innerHTML = html;
      container.appendChild(div);
    });
  }

  // settle action: record settlement log (keeps original transactions as history)
  let settlementsLog = JSON.parse(localStorage.getItem('settlements') || '[]');
  function markSettlementPaid(group, from, to, amount){
    if(!confirm(`${from} pays ${money(amount)} to ${to}?`)) return;
    settlementsLog.push({ group, from, to, amount, date: new Date().toISOString().split('T')[0] });
    localStorage.setItem('settlements', JSON.stringify(settlementsLog));
    notify('Settlement recorded');
    renderGroups();
  }

  // GROUP selection/payer select
  function refreshGroupOptions(){
    // groupSelect dropdown
    el.groupSelect.innerHTML = '<option value="">No group</option>';
    Object.keys(groups).forEach(g => {
      const opt = document.createElement('option'); opt.value = g; opt.textContent = g;
      el.groupSelect.appendChild(opt);
    });
    // also render groups section
    renderGroups();
  }
  el.groupSelect.addEventListener('change', () => {
    const g = el.groupSelect.value;
    if(!g){ el.payerSelect.innerHTML = '<option value="">Select payer</option>'; el.payerSelect.disabled = true; return; }
    const members = groups[g] || [];
    el.payerSelect.innerHTML = '<option value="">Select payer</option>';
    members.forEach(m => {
      const o = document.createElement('option'); o.value = m; o.textContent = m;
      el.payerSelect.appendChild(o);
    });
    el.payerSelect.disabled = false;
  });

  // CHARTS
  function renderCharts(){
    const monthKey = el.budgetMonth.value || new Date().toISOString().slice(0,7);
    // category doughnut for selected month only
    const catMap = {};
    expenses.filter(e => e.type === 'expense' && monthKeyFromDateStr(e.date) === monthKey)
      .forEach(e => catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount));
    const labels = Object.keys(catMap);
    const data = Object.values(catMap);
    if(categoryChart) categoryChart.destroy();
    categoryChart = new Chart(el.categoryChartCanvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4'] }] },
      options: {
        plugins: {
          datalabels: { color: '#fff', formatter: (value, ctx) => {
            const total = ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
            if(!total) return '';
            const pct = (value/total*100).toFixed(0);
            return pct + '%';
          }},
          legend: { position: 'bottom' }
        },
        maintainAspectRatio: false
      },
      plugins: [ChartDataLabels]
    });

    // monthly 6 months income vs expense
    const now = new Date();
    const months = [];
    for(let i=5;i>=0;i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.push({ key: d.toISOString().slice(0,7), label: d.toLocaleString('default',{month:'short', year:'2-digit'}) });
    }
    const incData = months.map(m => expenses.filter(e => e.type === 'income' && monthKeyFromDateStr(e.date) === m.key).reduce((s,t)=>s+Number(t.amount),0));
    const expData = months.map(m => expenses.filter(e => e.type === 'expense' && monthKeyFromDateStr(e.date) === m.key).reduce((s,t)=>s+Number(t.amount),0));
    if(monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(el.monthlyChartCanvas.getContext('2d'), {
      type: 'bar',
      data: { labels: months.map(m=>m.label), datasets: [{ label:'Income', data: incData, backgroundColor: '#10b981' }, { label:'Expense', data: expData, backgroundColor: '#ef4444' }]},
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
    });
  }

  // RENDER ALL
  function renderTransactions(){
    el.expenseTable.innerHTML = '';
    expenses.slice().reverse().forEach(tx => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${tx.type}</td>
        <td>${tx.category}</td>
        <td>${money(tx.amount)}</td>
        <td>${tx.date}</td>
        <td>${tx.note || '-'}</td>
        <td>${tx.group || '-'}</td>
        <td>${tx.payer || '-'}</td>
        <td>
          <button class="ghost" data-id="${tx.id}" data-action="edit">✏️</button>
          <button class="ghost" data-id="${tx.id}" data-action="delete">🗑️</button>
        </td>
      `;
      el.expenseTable.appendChild(tr);
    });
  }

  function renderAll(){
    renderTransactions();
    renderBudgets();
    renderGroups();
    renderCharts();
  }

  // EVENTS: delegated clicks for table / budgets / groups / settlements
  document.addEventListener('click', (e) => {
    // transactions table actions
    const tBtn = e.target.closest('#expense-table-body button[data-action]');
    if(tBtn){
      const id = Number(tBtn.dataset.id);
      const action = tBtn.dataset.action;
      if(action === 'delete') deleteTransaction(id);
      if(action === 'edit') editTransaction(id);
      return;
    }

    // budgets actions
    const bBtn = e.target.closest('.budget-actions button, .budget-item button[data-action]');
    if(bBtn){
      // some budget buttons created as .ghost with data attributes
      const month = bBtn.dataset.month;
      const cat = bBtn.dataset.cat;
      const action = bBtn.dataset.action;
      if(action === 'edit') editBudget(month, cat);
      if(action === 'delete') deleteBudget(month, cat);
      return;
    }
    // handle budget-actions implemented as buttons inside budget-item
    const budgetAction = e.target.closest('.budget-item button[data-action]');
    if(budgetAction){
      const month = budgetAction.dataset.month;
      const cat = budgetAction.dataset.cat;
      if(budgetAction.dataset.action === 'edit') editBudget(month, cat);
      else deleteBudget(month, cat);
      return;
    }

    // group actions: edit / delete / settle
    const gEdit = e.target.closest('[data-action="edit"][data-group]');
    if(gEdit){
      const g = gEdit.dataset.group; editGroup(g); return;
    }
    const gDel = e.target.closest('[data-action="delete"][data-group]');
    if(gDel){
      const g = gDel.dataset.group; deleteGroup(g); return;
    }
    const settleBtn = e.target.closest('button[data-action="settle"]');
    if(settleBtn){
      const group = settleBtn.dataset.group;
      const from = settleBtn.dataset.from;
      const to = settleBtn.dataset.to;
      const amt = Number(settleBtn.dataset.amt);
      markSettlementPaid(group, from, to, amt);
      return;
    }
  });

  // create group
  el.createGroupBtn.addEventListener('click', () => createGroup());

  // add transaction
  el.addBtn.addEventListener('click', () => addTransaction());

  // clear form
  el.clearBtn.addEventListener('click', () => clearTransactionForm());

  // set/update budget
  el.setBudgetBtn.addEventListener('click', () => setBudget());
  el.viewBudgetsBtn.addEventListener('click', () => renderBudgets());

  // when budget month changes: re-render budgets & category chart
  el.budgetMonth.addEventListener('change', () => { renderBudgets(); renderCharts(); });

  // when category custom selected -> show custom input
  el.category.addEventListener('change', () => {
    el.customCatWrap.style.display = (el.category.value === '__custom__') ? 'block' : 'none';
  });

  // groupSelect change updates payer select (done above)
  // createGroup button
  el.createGroupBtn.addEventListener('click', () => createGroup());

  // handle clicks inside group balances for edit/delete/settle by delegation setup earlier
  el.groupBalances.addEventListener('click', (e) => {
    const editBtn = e.target.closest('button[data-action="edit"]');
    if(editBtn){ editGroup(editBtn.dataset.group); return; }
    const delBtn = e.target.closest('button[data-action="delete"]');
    if(delBtn){ deleteGroup(delBtn.dataset.group); return; }
    const settleBtn = e.target.closest('button[data-action="settle"]');
    if(settleBtn){ markSettlementPaid(settleBtn.dataset.group, settleBtn.dataset.from, settleBtn.dataset.to, Number(settleBtn.dataset.amt)); return; }
  });

  // theme button cycles
  const themes = ['light','dark','neon'];
  let themeIndex = 0;
  el.themeToggle.addEventListener('click', () => {
    themeIndex = (themeIndex + 1) % themes.length;
    document.body.setAttribute('data-theme', themes[themeIndex]);
    el.themeToggle.textContent = themes[themeIndex] === 'light' ? '☀️' : themes[themeIndex] === 'dark' ? '🌙' : '⚡';
  });

  // initial render helpers
  function refreshGroupOptions(){
    el.groupSelect.innerHTML = '<option value="">No group</option>';
    Object.keys(groups).forEach(g => {
      const opt = document.createElement('option'); opt.value = g; opt.textContent = g;
      el.groupSelect.appendChild(opt);
    });
    renderGroups();
  }

  // when user picks group in transaction form, fill payer select
  el.groupSelect.addEventListener('change', () => {
    const g = el.groupSelect.value;
    if(!g){ el.payerSelect.innerHTML = '<option value="">Select payer</option>'; el.payerSelect.disabled = true; return; }
    const members = groups[g] || [];
    el.payerSelect.innerHTML = '<option value="">Select payer</option>';
    members.forEach(m => {
      const o = document.createElement('option'); o.value = m; o.textContent = m;
      el.payerSelect.appendChild(o);
    });
    el.payerSelect.disabled = false;
  });

  // initial values and render
  initControls();
  renderAll();

});
