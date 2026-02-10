const REWARD_SERVICE_URL = "/rewards/api/rewards";
const CALENDAR_SERVICE_URL = "/calendar/api/points";

const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !currentUser) {
  window.location.href = "/";
}

// ---------------- UI helpers ----------------
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.className =
    "fixed top-5 right-5 z-[9999] px-5 py-3 rounded-2xl text-white shadow-xl";
  const map = {
    success: "bg-emerald-600",
    error: "bg-red-600",
    warning: "bg-amber-600",
    info: "bg-blue-600",
  };
  toast.classList.add(map[type] || map.info);
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------------- State ----------------
let allRewards = [];
let selectedReward = null;

// ---------------- Elements ----------------
const pointsBalanceEl = document.getElementById("pointsBalance");
const rewardsGridEl = document.getElementById("rewardsGrid");
const rewardsEmptyEl = document.getElementById("rewardsEmpty");
const searchInputEl = document.getElementById("searchInput");

const historyListEl = document.getElementById("historyList");
const historyEmptyEl = document.getElementById("historyEmpty");

const redeemModalEl = document.getElementById("redeemModal");
const modalTitleEl = document.getElementById("modalTitle");
const modalSubtitleEl = document.getElementById("modalSubtitle");
const modalCostTextEl = document.getElementById("modalCostText");

const deliveryFieldsEl = document.getElementById("deliveryFields");
const redeemFormEl = document.getElementById("redeemForm");

const quantityInputEl = document.getElementById("quantityInput");
const recipientEmailEl = document.getElementById("recipientEmail");
const recipientNameEl = document.getElementById("recipientName");
const recipientPhoneEl = document.getElementById("recipientPhone");
const addressLine1El = document.getElementById("addressLine1");
const addressLine2El = document.getElementById("addressLine2");
const postalCodeEl = document.getElementById("postalCode");

const confirmRedeemBtn = document.getElementById("confirmRedeemBtn");

// No explicit guard function needed as it's at the top level now

// ---------------- API calls ----------------
async function loadPoints() {
  const userId = currentUser?.id ?? currentUser?.userId;

  if (!userId) {
    pointsBalanceEl.textContent = "—";
    showToast("User ID missing.", "error");
    return;
  }

  try {
    const res = await fetch(`${CALENDAR_SERVICE_URL}/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      window.location.href = "/";
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      pointsBalanceEl.textContent = "—";
      showToast(data.message || "Failed to load points.", "error");
      return;
    }

    const total = data.total_points ?? data.total ?? data.totalPoints ?? 0;
    pointsBalanceEl.textContent = total;
  } catch (e) {
    pointsBalanceEl.textContent = "—";
    showToast("Failed to reach Calendar service.", "error");
  }
}

async function loadRewards() {
  try {
    const res = await fetch(`${REWARD_SERVICE_URL}/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      window.location.href = "/";
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (rewardsGridEl) rewardsGridEl.innerHTML = "";
      const msg = data.details
        ? `${data.message} (${data.details})`
        : data.message || "Failed to load rewards.";
      showToast(msg, "error");
      return;
    }

    allRewards = Array.isArray(data) ? data : [];
    renderRewards(allRewards);
  } catch (e) {
    showToast("Failed to reach Reward service.", "error");
  }
}

async function loadHistory() {
  try {
    const res = await fetch(`${REWARD_SERVICE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      window.location.href = "/";
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (historyListEl) historyListEl.innerHTML = "";
      const msg = data.details
        ? `${data.message} (${data.details})`
        : data.message || "Failed to load history.";
      showToast(msg, "error");
      return;
    }

    renderHistory(Array.isArray(data) ? data : []);
  } catch (e) {
    showToast("Failed to reach Reward service (history).", "error");
  }
}

async function redeemReward(payload) {
  try {
    const res = await fetch(`${REWARD_SERVICE_URL}/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      window.location.href = "/";
      return null;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.message || "Redeem failed.", "error");
      return null;
    }
    return data;
  } catch (e) {
    showToast("Failed to reach Reward service (redeem).", "error");
    return null;
  }
}

// ---------------- Rendering ----------------
function renderRewards(list) {
  rewardsGridEl.innerHTML = "";

  if (!list.length) {
    rewardsEmptyEl.classList.remove("hidden");
    return;
  }
  rewardsEmptyEl.classList.add("hidden");

  list.forEach((r) => {
    const stockText =
      r.stock === null
        ? "Unlimited"
        : r.stock > 0
          ? `${r.stock} left`
          : "Out of stock";

    const badge =
      r.fulfilment_type === "voucher"
        ? "Voucher"
        : r.fulfilment_type === "delivery"
          ? "Delivery"
          : "Pickup";

    const disabled =
      r.stock !== null && r.stock <= 0 ? "opacity-50 pointer-events-none" : "";

    // Show image if provided (nice UX, not required)
    const imgHtml = r.image_url
      ? `<img 
          src="${r.image_url}" 
          alt="${escapeHtml(r.name)}"
          class="w-full h-44 object-cover rounded-xl border border-slate-200 mb-3" 
        />`
      : `<div class="w-full h-44 rounded-xl border border-slate-200 bg-slate-100 
                  flex items-center justify-center text-slate-400 mb-3">
            <i class="fa-solid fa-image text-3xl"></i>
        </div>`;

    const card = document.createElement("div");
    card.className = `bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ${disabled}`;
    card.innerHTML = `
      ${imgHtml}
      <h3 class="font-bold text-lg">${escapeHtml(r.name)}</h3>
      <p class="text-sm text-slate-600 mt-1">${escapeHtml(
      r.description || ""
    )}</p>

      <div class="mt-3 flex justify-between items-center">
        <span class="text-xs px-2 py-1 rounded-full bg-slate-100 border">${badge}</span>
        <span class="font-extrabold">${Number(r.cost_points)} pts</span>
      </div>

      <div class="mt-2 text-sm text-slate-500">Stock: ${stockText}</div>

      <button class="mt-4 w-full px-4 py-2 rounded-xl bg-emerald-600 text-white"
        data-id="${r.id}">
        Redeem
      </button>
    `;

    card.querySelector("button").addEventListener("click", () => {
      openRedeemModal(r);
    });

    rewardsGridEl.appendChild(card);
  });
}

function renderHistory(rows) {
  historyListEl.innerHTML = "";

  if (!rows.length) {
    historyEmptyEl.classList.remove("hidden");
    return;
  }
  historyEmptyEl.classList.add("hidden");

  rows.forEach((h) => {
    const dateText = h.redeemed_at
      ? new Date(h.redeemed_at).toLocaleString()
      : "—";

    const statusText = (h.status || "pending").toUpperCase();

    const item = document.createElement("div");
    item.className = "bg-white rounded-2xl border p-4 shadow-sm";
    item.innerHTML = `
      <p class="font-bold">${escapeHtml(h.name)}</p>
      <p class="text-sm">${dateText}</p>
      <p class="text-sm font-semibold">${Number(h.points_spent)} pts</p>
      <p class="text-xs uppercase">${escapeHtml(statusText)}</p>
    `;
    historyListEl.appendChild(item);
  });
}

// ---------------- Modal logic ----------------
function openRedeemModal(reward) {
  selectedReward = reward;
  modalTitleEl.textContent = `Redeem: ${reward.name}`;
  modalSubtitleEl.textContent =
    reward.fulfilment_type === "delivery"
      ? "Delivery requires address details."
      : reward.fulfilment_type === "voucher"
        ? "Voucher code will be generated after redeem."
        : "Pickup item — see pickup location in history.";

  quantityInputEl.value = 1;
  recipientEmailEl.value = currentUser?.email || "";

  // Reset delivery fields each time modal opens (prevents old data sticking)
  recipientNameEl.value = "";
  recipientPhoneEl.value = "";
  addressLine1El.value = "";
  addressLine2El.value = "";
  postalCodeEl.value = "";

  deliveryFieldsEl.classList.toggle("hidden", reward.fulfilment_type !== "delivery");

  updateModalCostText();
  redeemModalEl.classList.remove("hidden");
}

function closeRedeemModal() {
  redeemModalEl.classList.add("hidden");
  selectedReward = null;
}

function updateModalCostText() {
  if (!selectedReward) return;
  const qty = Number(quantityInputEl.value || 1);
  const safeQty = qty > 0 ? qty : 1;
  modalCostTextEl.textContent = `Cost: ${safeQty * Number(selectedReward.cost_points)
    } pts`;
}

// ---------------- Events ----------------
document.getElementById("refreshBtn").addEventListener("click", async () => {
  try {
    await loadPoints();
    await loadRewards();
    await loadHistory();
    showToast("Refreshed.", "success");
  } catch (e) {
    showToast(e.message || "Refresh failed.", "error");
  }
});

document.getElementById("loadHistoryBtn").addEventListener("click", async () => {
  try {
    await loadHistory();
    showToast("History loaded.", "success");
  } catch (e) {
    showToast(e.message || "Failed to load history.", "error");
  }
});

document.getElementById("closeModalBtn").addEventListener("click", closeRedeemModal);

// Close modal if click outside
redeemModalEl.addEventListener("click", (e) => {
  if (e.target === redeemModalEl) closeRedeemModal();
});

quantityInputEl.addEventListener("input", updateModalCostText);

if (searchInputEl) {
  searchInputEl.addEventListener("input", () => {
    const q = searchInputEl.value.trim().toLowerCase();
    const filtered = allRewards.filter((r) => {
      return (
        (r.name || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
      );
    });
    renderRewards(filtered);
  });
}

// Submit redeem
redeemFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedReward) return;

  const qty = Number(quantityInputEl.value || 1);
  if (!qty || qty <= 0) {
    showToast("Quantity must be at least 1.", "warning");
    return;
  }

  // Disable button to prevent double submit
  if (confirmRedeemBtn) {
    confirmRedeemBtn.disabled = true;
    confirmRedeemBtn.classList.add("opacity-60");
  }

  try {
    const payload = {
      rewardId: selectedReward.id,
      quantity: qty,
      recipientEmail: recipientEmailEl.value.trim() || null,
    };

    if (selectedReward.fulfilment_type === "delivery") {
      payload.recipientName = recipientNameEl.value.trim();
      payload.recipientPhone = recipientPhoneEl.value.trim();
      payload.addressLine1 = addressLine1El.value.trim();
      payload.addressLine2 = addressLine2El.value.trim() || null;
      payload.postalCode = postalCodeEl.value.trim();

      if (
        !payload.recipientName ||
        !payload.recipientPhone ||
        !payload.addressLine1 ||
        !payload.postalCode
      ) {
        showToast(
          "Delivery requires name, phone, address line 1, and postal code.",
          "warning"
        );
        return;
      }
    }

    const result = await redeemReward(payload);
    if (!result) return;

    closeRedeemModal();

    if (result.voucherCode) {
      showToast(`Redeemed! Voucher: ${result.voucherCode}`, "success");
    } else {
      showToast("Redeemed successfully!", "success");
    }

    await loadPoints();
    await loadRewards();
    await loadHistory();
  } finally {
    if (confirmRedeemBtn) {
      confirmRedeemBtn.disabled = false;
      confirmRedeemBtn.classList.remove("opacity-60");
    }
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/";
});

const sidebarLogoutBtn = document.getElementById("sidebarLogoutBtn");
if (sidebarLogoutBtn) {
  sidebarLogoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  });
}

// ---------------- Init ----------------
(async function init() {
  // Guard is at top level, but double check here if needed
  if (!token || !currentUser) return;

  // Sync Sidebar Profile
  if (currentUser.fullName) {
    const sidebarNameEl = document.getElementById("sidebarUserName");
    if (sidebarNameEl) sidebarNameEl.textContent = currentUser.fullName;
  }

  // Display profile image in sidebar if available
  if (currentUser.profileImageUrl) {
    const avatarContainer = document.querySelector('.user-details')?.previousElementSibling;
    if (avatarContainer && avatarContainer.classList.contains('bg-slate-200')) {
      const fullUrl = currentUser.profileImageUrl.startsWith('http')
        ? currentUser.profileImageUrl
        : `/auth${currentUser.profileImageUrl}`;
      avatarContainer.innerHTML = `<img src="${fullUrl}" class="w-full h-full object-cover rounded-full">`;
    }
  }

  try {
    await loadPoints();
    await loadRewards();
    await loadHistory();
  } catch (e) {
    console.error("[REWARDS] Init load error:", e);
    showToast("Failed to load rewards page data.", "error");
  }
})();
