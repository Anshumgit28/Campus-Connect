"use strict";
/* ============================================================
   club-treasury.js — Club Budget & Expense Tracker
============================================================ */

let allTransactions = [];

document.addEventListener("DOMContentLoaded", () => {
  loadClubInfo();
  loadTransactions();

  const d = document.getElementById("txDate");
  if (d) d.value = new Date().toISOString().split("T")[0];
});

function loadClubInfo() {
  fetch("/club/data", { credentials: "include" })
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById("avatarLetter");
      if (el) el.innerText = (d.name || "C")[0].toUpperCase();
    }).catch(() => {});
}

/* ── LOAD TRANSACTIONS ── */
function loadTransactions() {
  fetch("/club/treasury/list", { credentials: "include" })
    .then(r => r.json())
    .then(txs => {
      allTransactions = txs;
      updateBalance(txs);
      renderRecentTx(txs.slice(0, 8));
      renderLedger(txs);
    })
    .catch(() => {
      document.getElementById("recentTxList").innerHTML =
        `<p style="color:var(--red);text-align:center;padding:20px;">Failed to load transactions</p>`;
    });
}

function updateBalance(txs) {
  const income  = txs.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const balance = income - expense;

  document.getElementById("balanceDisplay").innerText = "₹" + fmt(balance);
  document.getElementById("totalIncome").innerText    = "₹" + fmt(income);
  document.getElementById("totalExpense").innerText   = "₹" + fmt(expense);

  const note = document.getElementById("balanceNote");
  if (!txs.length) { note.innerText = "No transactions yet"; return; }
  note.innerText = `${txs.length} transaction${txs.length !== 1 ? "s" : ""} · ${balance >= 0 ? "Surplus" : "Deficit"}`;
}

/* ── RENDER RECENT ── */
function renderRecentTx(txs) {
  const el = document.getElementById("recentTxList");
  if (!txs.length) {
    el.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px;">No transactions yet</p>`;
    return;
  }
  el.innerHTML = txs.map(t => `
    <div class="item-row ${t.type === "income" ? "tx-income" : "tx-expense"}">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:14px;">${esc(t.description)}</div>
        <div style="font-size:12px;color:var(--muted);">${esc(t.category || "—")} · ${t.date ? t.date.slice(0,10) : "—"}</div>
      </div>
      <div class="${t.type === "income" ? "tx-amount-income" : "tx-amount-expense"}">
        ${t.type === "income" ? "+" : "−"}₹${fmt(t.amount)}
      </div>
    </div>`).join("");
}

/* ── RENDER LEDGER ── */
function renderLedger(txs) {
  const tbody = document.getElementById("ledgerBody");
  if (!txs.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No transactions found</td></tr>`;
    return;
  }
  tbody.innerHTML = txs.map(t => `
    <tr>
      <td style="font-weight:600;">${t.date ? t.date.slice(0,10) : "—"}</td>
      <td>
        <span class="badge ${t.type === "income" ? "badge-green" : "badge-red"}">
          ${t.type === "income" ? "💰 Income" : "💸 Expense"}
        </span>
      </td>
      <td>${esc(t.category || "—")}</td>
      <td>${esc(t.description)}</td>
      <td class="${t.type === "income" ? "tx-amount-income" : "tx-amount-expense"}">
        ${t.type === "income" ? "+" : "−"}₹${fmt(t.amount)}
      </td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteTx(${t.id})">🗑</button>
      </td>
    </tr>`).join("");
}

/* ── FILTER ── */
function filterTransactions() {
  const type = document.getElementById("filterType").value;
  const filtered = type ? allTransactions.filter(t => t.type === type) : allTransactions;
  renderLedger(filtered);
}

/* ── ADD TRANSACTION ── */
function openTxModal(type) {
  document.getElementById("txType").value = type;
}

function addTransaction() {
  const type     = document.getElementById("txType").value;
  const desc     = document.getElementById("txDesc").value.trim();
  const amount   = document.getElementById("txAmount").value;
  const date     = document.getElementById("txDate").value;
  const category = document.getElementById("txCategory").value;
  const msg      = document.getElementById("txMsg");

  if (!desc)                        { showMsg(msg, "error", "⚠️ Description required"); return; }
  if (!amount || parseFloat(amount) <= 0) { showMsg(msg, "error", "⚠️ Enter a valid amount"); return; }
  if (!date)                        { showMsg(msg, "error", "⚠️ Date required"); return; }

  showMsg(msg, "info", "⏳ Adding...");

  fetch("/club/treasury/add", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, description: desc, amount: parseFloat(amount), date, category })
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showMsg(msg, "success", "✅ Transaction added!");
      document.getElementById("txDesc").value = "";
      document.getElementById("txAmount").value = "";
      loadTransactions();
      setTimeout(() => { msg.style.display = "none"; }, 3000);
    } else {
      showMsg(msg, "error", "❌ " + (d.message || "Failed"));
    }
  })
  .catch(() => showMsg(msg, "error", "❌ Network error"));
}

/* ── DELETE TRANSACTION ── */
function deleteTx(id) {
  if (!confirm("Delete this transaction?")) return;
  fetch("/club/treasury/delete", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx_id: id })
  }).then(r => r.json()).then(d => { if (d.success) loadTransactions(); });
}

/* ── UTILITIES ── */
function fmt(n) {
  return parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function showMsg(el, type, text) { if (!el) return; el.className = "msg " + type; el.innerText = text; }
function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
