document.addEventListener('DOMContentLoaded', () => {
  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle');
  themeBtn.addEventListener('click', () => {
    const body = document.body;
    if(body.dataset.theme === 'light') body.dataset.theme = 'dark';
    else if(body.dataset.theme === 'dark') body.dataset.theme = 'neon';
    else body.dataset.theme = 'light';
  });

  // Category custom input
  const catSelect = document.getElementById('category-select');
  const customCatWrap = document.getElementById('custom-cat-wrap');
  catSelect.addEventListener('change', () => {
    customCatWrap.style.display = catSelect.value === '__custom__' ? 'block' : 'none';
  });

  const transactions = [];
  const groups = [];
  const budgets = [];

  const expenseTableBody = document.getElementById('expense-table-body');
  const categoryChartCtx = document.getElementById('categoryChart').getContext('2d');
  const monthlyChartCtx = document.getElementById('monthlyChart').getContext('2d');

  function showNotification(msg){
    const noti = document.getElementById('notification');
    noti.textContent = msg;
    noti.classList.remove('hidden');
    setTimeout(()=>noti.classList.add('hidden'),2000);
  }

  function renderTransactions(){
    expenseTableBody.innerHTML = '';
    transactions.forEach((t,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.type}</td>
        <td>${t.category}</td>
        <td>${t.amount}</td>
        <td>${t.date}</td>
        <td>${t.note}</td>
        <td>${t.group || ''}</td>
        <td>${t.payer || ''}</td>
        <td><button onclick="deleteTransaction(${i})" class="ghost">Delete</button></td>
      `;
      expenseTableBody.appendChild(tr);
    });
    renderCharts();
  }

  window.deleteTransaction = function(i){
    transactions.splice(i,1);
    renderTransactions();
    showNotification('Transaction deleted');
  }

  // Add Transaction
  document.getElementById('add-btn').addEventListener('click', () => {
    const type = document.getElementById('type-select').value;
    let category = catSelect.value === '__custom__' ? document.getElementById('custom-category').value : catSelect.value;
    const amount = document.getElementById('amount-input').value;
    const date = document.getElementById('date-input').value;
    const note = document.getElementById('note-input').value;
    const group = document.getElementById('group-select').value;
    const payer = document.getElementById('payer-select').value;

    if(!category || !amount || !date){ showNotification('Please fill required fields'); return; }
    transactions.push({type,category,amount:parseFloat(amount),date,note,group,payer});
    renderTransactions();
    showNotification('Transaction added');
  });

  document.getElementById('clear-form').addEventListener('click', ()=>{
    document.querySelectorAll('.field').forEach(f=>f.value='');
    customCatWrap.style.display='none';
  });

  // Charts
  let categoryChart, monthlyChart;
  function renderCharts(){
    const catData = {};
    transactions.forEach(t=>{ catData[t.category] = (catData[t.category]||0) + t.amount; });
    if(categoryChart) categoryChart.destroy();
    categoryChart = new Chart(categoryChartCtx,{
      type:'doughnut',
      data:{
        labels:Object.keys(catData),
        datasets:[{data:Object.values(catData),backgroundColor:['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899']}]
      },
      options:{plugins:{legend:{position:'bottom'}}}
    });

    const months = {};
    transactions.forEach(t=>{
      const m = new Date(t.date).toLocaleString('default',{month:'short',year:'numeric'});
      months[m] = months[m] || {income:0,expense:0};
      months[m][t.type] += t.amount;
    });
    if(monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(monthlyChartCtx,{
      type:'bar',
      data:{
        labels:Object.keys(months),
        datasets:[
          {label:'Income',data:Object.values(months).map(x=>x.income),backgroundColor:'#10b981'},
          {label:'Expense',data:Object.values(months).map(x=>x.expense),backgroundColor:'#ef4444'}
        ]
      },
      options:{responsive:true,plugins:{legend:{position:'bottom'}}}
    });
  }
});
