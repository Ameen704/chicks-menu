/**
 * CHicks (شِيكس) - Electronic Menu Interactive Controller
 * Features:
 * - Live Instant Search
 * - Category Tab Filtering & Scroll-Spy
 * - Quick Attribute Filters (Best Seller, Spicy, Family)
 * - "My Bill" (احسب فاتورتك) Order Calculator with Modal Drawer
 * - Dynamic QR Code Generator for Tables / Stickers
 */

document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------------------
  // 1. Data Store & State
  // -------------------------------------------------------------
  const state = {
    cart: {}, // { [dishId]: { name, price, qty } }
    activeCategory: 'all',
    activeFilter: 'all',
    searchQuery: '',
    restaurantUrl: window.location.href.split('#')[0]
  };

  // -------------------------------------------------------------
  // 2. DOM Elements
  // -------------------------------------------------------------
  const searchInput = document.getElementById('menuSearchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const categoryPills = document.querySelectorAll('.cat-pill');
  const filterTags = document.querySelectorAll('.filter-tag');
  const dishCards = document.querySelectorAll('.dish-card');
  const menuSections = document.querySelectorAll('.menu-section');
  const noResultsElem = document.getElementById('noResultsMsg');

  // Bottom Floating Bar Elements
  const bottomBarTotal = document.getElementById('bottomBarTotal');
  const bottomBarCount = document.getElementById('bottomBarCount');
  const billSummaryTrigger = document.getElementById('billSummaryTrigger');

  // Modals
  const billModal = document.getElementById('billModal');
  const billModalClose = document.getElementById('billModalClose');
  const selectedItemsList = document.getElementById('selectedItemsList');
  const modalBillTotal = document.getElementById('modalBillTotal');
  const clearBillBtn = document.getElementById('clearBillBtn');
  const copyBillBtn = document.getElementById('copyBillBtn');
  const whatsappBillBtn = document.getElementById('whatsappBillBtn');

  // QR Modal
  const qrModal = document.getElementById('qrModal');
  const qrModalOpenBtns = document.querySelectorAll('.open-qr-modal');
  const qrModalClose = document.getElementById('qrModalClose');
  const qrContainer = document.getElementById('qrContainer');
  const downloadQrBtn = document.getElementById('downloadQrBtn');

  // -------------------------------------------------------------
  // 3. Search & Filter Logic
  // -------------------------------------------------------------
  function filterMenu() {
    let visibleCount = 0;
    const query = state.searchQuery.trim().toLowerCase();

    dishCards.forEach(card => {
      const name = (card.getAttribute('data-name') || '').toLowerCase();
      const desc = (card.getAttribute('data-desc') || '').toLowerCase();
      const category = card.getAttribute('data-category') || '';
      const tags = (card.getAttribute('data-tags') || '').split(',');

      // Condition 1: Category Match
      const matchesCategory = state.activeCategory === 'all' || category === state.activeCategory;

      // Condition 2: Filter Tag Match
      const matchesTag = state.activeFilter === 'all' || tags.includes(state.activeFilter);

      // Condition 3: Search Query Match
      const matchesSearch = !query || name.includes(query) || desc.includes(query);

      if (matchesCategory && matchesTag && matchesSearch) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Handle empty sections
    menuSections.forEach(section => {
      const secCategory = section.getAttribute('data-category');
      const hasVisibleChildren = Array.from(section.querySelectorAll('.dish-card')).some(
        card => card.style.display !== 'none'
      );

      if (hasVisibleChildren && (state.activeCategory === 'all' || secCategory === state.activeCategory)) {
        section.style.display = 'block';
      } else {
        section.style.display = 'none';
      }
    });

    // Toggle No Results Message
    if (visibleCount === 0) {
      noResultsElem.classList.add('visible');
    } else {
      noResultsElem.classList.remove('visible');
    }
  }

  // Search Input Handler
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.searchQuery.length > 0) {
        searchClearBtn.classList.add('active');
      } else {
        searchClearBtn.classList.remove('active');
      }
      filterMenu();
    });

    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      searchClearBtn.classList.remove('active');
      searchInput.focus();
      filterMenu();
    });
  }

  // Category Pill Clicks
  categoryPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const targetCat = pill.getAttribute('data-category');
      state.activeCategory = targetCat;
      filterMenu();

      // Smooth scroll to section if specific category chosen
      if (targetCat !== 'all') {
        const targetSection = document.getElementById(`section-${targetCat}`);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // Filter Tag Clicks (Bestseller, Spicy, Family)
  filterTags.forEach(tag => {
    tag.addEventListener('click', () => {
      filterTags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      state.activeFilter = tag.getAttribute('data-filter');
      filterMenu();
    });
  });

  // -------------------------------------------------------------
  // 4. "My Bill" (احسب فاتورتك) Interactive Calculator & Portion Handling
  // -------------------------------------------------------------
  function getActiveCardItem(card) {
    const portionPill = card.querySelector('.portion-pill.active');
    if (portionPill) {
      const baseId = card.getAttribute('data-base-id');
      const baseName = card.getAttribute('data-name');
      const portion = portionPill.getAttribute('data-portion');
      const price = Number(portionPill.getAttribute('data-price'));
      return {
        id: `${baseId}_${portion}`,
        name: `${baseName} (${portion})`,
        price: price
      };
    }
    return {
      id: card.getAttribute('data-id'),
      name: card.getAttribute('data-name'),
      price: Number(card.getAttribute('data-price'))
    };
  }

  function updateCartUI() {
    let totalItems = 0;
    let totalPrice = 0;

    // Update Card Counters
    dishCards.forEach(card => {
      const activeItem = getActiveCardItem(card);
      const qty = state.cart[activeItem.id] ? state.cart[activeItem.id].qty : 0;
      const initialBtn = card.querySelector('.btn-add-initial');
      const qtyWrap = card.querySelector('.calc-qty-control');
      const qtyDisplay = card.querySelector('.qty-display');

      if (qty > 0) {
        if (initialBtn) initialBtn.style.display = 'none';
        if (qtyWrap) {
          qtyWrap.style.display = 'inline-flex';
          qtyWrap.classList.add('has-qty');
        }
        if (qtyDisplay) qtyDisplay.textContent = qty;
      } else {
        if (initialBtn) initialBtn.style.display = 'inline-flex';
        if (qtyWrap) {
          qtyWrap.style.display = 'none';
          qtyWrap.classList.remove('has-qty');
        }
      }
    });

    // Compute totals
    Object.values(state.cart).forEach(item => {
      totalItems += item.qty;
      totalPrice += (item.price * item.qty);
    });

    // Update Bottom Floating Bar
    if (bottomBarCount) bottomBarCount.textContent = totalItems;
    if (bottomBarTotal) bottomBarTotal.textContent = `${totalPrice} ج.م`;

    // Update Modal Drawer if open
    renderModalBill(totalPrice, totalItems);
  }

  function modifyItemQty(id, name, price, delta) {
    if (!state.cart[id]) {
      if (delta > 0) {
        state.cart[id] = { name, price: Number(price), qty: delta };
      }
    } else {
      state.cart[id].qty += delta;
      if (state.cart[id].qty <= 0) {
        delete state.cart[id];
      }
    }
    updateCartUI();
  }

  // Delegated Click for Portion Selector & Card Controls
  document.addEventListener('click', (e) => {
    // 1. Portion Selection Pill clicked
    const portionPill = e.target.closest('.portion-pill');
    if (portionPill) {
      const card = portionPill.closest('.dish-card');
      const selector = portionPill.closest('.portion-selector');
      selector.querySelectorAll('.portion-pill').forEach(p => p.classList.remove('active'));
      portionPill.classList.add('active');

      // Update card price display
      const newPrice = portionPill.getAttribute('data-price');
      const priceValElem = card.querySelector('.price-val');
      if (priceValElem) {
        priceValElem.textContent = newPrice;
      }
      // Refresh current card counter to reflect selected portion quantity
      updateCartUI();
      return;
    }

    // 2. Initial Add clicked
    const initialBtn = e.target.closest('.btn-add-initial');
    if (initialBtn) {
      const card = initialBtn.closest('.dish-card');
      const item = getActiveCardItem(card);
      modifyItemQty(item.id, item.name, item.price, 1);
      return;
    }

    // 3. Plus Button clicked
    const plusBtn = e.target.closest('.qty-btn.plus');
    if (plusBtn) {
      const card = plusBtn.closest('.dish-card');
      const item = getActiveCardItem(card);
      modifyItemQty(item.id, item.name, item.price, 1);
      return;
    }

    // 4. Minus Button clicked
    const minusBtn = e.target.closest('.qty-btn.minus');
    if (minusBtn) {
      const card = minusBtn.closest('.dish-card');
      const item = getActiveCardItem(card);
      modifyItemQty(item.id, item.name, item.price, -1);
      return;
    }
  });

  // Render items inside the Bill Modal
  function renderModalBill(totalPrice, totalItems) {
    if (!selectedItemsList) return;

    const items = Object.entries(state.cart);
    if (items.length === 0) {
      selectedItemsList.innerHTML = `
        <div style="text-align: center; padding: 25px 10px; color: #94a3b8;">
          <div style="font-size: 2rem; margin-bottom: 8px;">🛒</div>
          <div>لم تقم باختيار أي وجبات بعد</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">اضغط (+) بجوار أي صنف لحساب تكلفته</div>
        </div>
      `;
    } else {
      selectedItemsList.innerHTML = items.map(([id, item]) => `
        <div class="selected-item-row">
          <div class="selected-item-info">
            <span class="selected-item-title">${item.name}</span>
            <span class="selected-item-calc">${item.qty} × ${item.price} ج.م</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="selected-item-subtotal">${item.qty * item.price} ج.م</span>
            <div style="display: flex; gap: 4px;">
              <button class="qty-btn minus" style="width: 24px; height: 24px; font-size: 0.9rem;" onclick="window.modifyFromModal('${id}', -1)">-</button>
              <button class="qty-btn plus" style="width: 24px; height: 24px; font-size: 0.9rem;" onclick="window.modifyFromModal('${id}', 1)">+</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    if (modalBillTotal) {
      modalBillTotal.textContent = `${totalPrice} ج.م`;
    }
  }

  // Global helper for modal +/- buttons
  window.modifyFromModal = function(id, delta) {
    if (state.cart[id]) {
      modifyItemQty(id, state.cart[id].name, state.cart[id].price, delta);
    }
  };

  // Bill Summary Modal Triggers
  if (billSummaryTrigger) {
    billSummaryTrigger.addEventListener('click', () => {
      billModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  if (billModalClose) {
    billModalClose.addEventListener('click', () => {
      billModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  if (clearBillBtn) {
    clearBillBtn.addEventListener('click', () => {
      state.cart = {};
      updateCartUI();
    });
  }

  // Copy Bill to Clipboard
  if (copyBillBtn) {
    copyBillBtn.addEventListener('click', () => {
      const items = Object.values(state.cart);
      if (items.length === 0) {
        alert('القائمة فارغة، اختر وجبات أولاً!');
        return;
      }

      let text = `🍗 *طلب من منيو CHicks شِيكس:*\n--------------------\n`;
      let total = 0;
      items.forEach((item, idx) => {
        text += `${idx + 1}. ${item.name} (عدد: ${item.qty}) = ${item.qty * item.price} ج.م\n`;
        total += item.qty * item.price;
      });
      text += `--------------------\n💰 *الإجمالي التقريبي:* ${total} ج.م\n📍 الفيوم - طامية`;

      navigator.clipboard.writeText(text).then(() => {
        const origText = copyBillBtn.innerHTML;
        copyBillBtn.innerHTML = '✅ تم نسخ الطلب!';
        setTimeout(() => {
          copyBillBtn.innerHTML = origText;
        }, 2000);
      }).catch(() => {
        alert('يمكنك نسخ الأصناف يدوياً أو إملاؤها للكاشير عند الاتصال');
      });
    });
  }

  // Send Bill to WhatsApp
  if (whatsappBillBtn) {
    whatsappBillBtn.addEventListener('click', () => {
      const items = Object.values(state.cart);
      if (items.length === 0) {
        alert('القائمة فارغة، اختر وجبات أولاً!');
        return;
      }

      let text = `🍗 *طلب من منيو CHicks شِيكس:*\n--------------------\n`;
      let total = 0;
      items.forEach((item, idx) => {
        text += `${idx + 1}. ${item.name} (عدد: ${item.qty}) = ${item.qty * item.price} ج.م\n`;
        total += item.qty * item.price;
      });
      text += `--------------------\n💰 *الإجمالي التقريبي:* ${total} ج.م\n📍 الفيوم - طامية`;

      const encoded = encodeURIComponent(text);
      window.open(`https://wa.me/201033326066?text=${encoded}`, '_blank');
    });
  }

  // -------------------------------------------------------------
  // 5. QR Code Generator Modal
  // -------------------------------------------------------------
  function generateQRCode() {
    if (!qrContainer) return;
    const url = state.restaurantUrl;
    
    // Generate clean, high-resolution QR via encoded standard SVG or reliable QR image
    // Using quickchart/api qr code with custom color styling or local SVG render
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=990000&bgcolor=ffffff&data=${encodeURIComponent(url)}`;
    
    qrContainer.innerHTML = `
      <img src="${qrApiUrl}" alt="QR Code CHicks Menu" style="width: 200px; height: 200px; border-radius: 8px; display: block; margin: 0 auto;" />
    `;
  }

  qrModalOpenBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      generateQRCode();
      qrModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  if (qrModalClose) {
    qrModalClose.addEventListener('click', () => {
      qrModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  if (downloadQrBtn) {
    downloadQrBtn.addEventListener('click', () => {
      const qrImg = qrContainer.querySelector('img');
      if (qrImg) {
        window.open(qrImg.src, '_blank');
      }
    });
  }

  // Close modals when clicking backdrop
  [billModal, qrModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    }
  });

  // -------------------------------------------------------------
  // 6. Category Scroll-Spy for Sticky Navigation
  // -------------------------------------------------------------
  const observerOptions = {
    root: null,
    rootMargin: '-100px 0px -70% 0px',
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    if (state.activeCategory !== 'all' || state.searchQuery) return;

    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const cat = entry.target.getAttribute('data-category');
        categoryPills.forEach(pill => {
          if (pill.getAttribute('data-category') === cat) {
            pill.classList.add('active');
            pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          } else if (pill.getAttribute('data-category') !== 'all') {
            pill.classList.remove('active');
          }
        });
      }
    });
  }, observerOptions);

  menuSections.forEach(sec => observer.observe(sec));
});
