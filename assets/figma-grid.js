/**
 * Figma Grid Modal and Cart Handler
 * Handles product selection, variant display, and add-to-cart with bundle logic
 * Vanilla JavaScript - no dependencies
 */
(() => {
  const grid = document.querySelector('[data-figma-grid]');
  const modal = document.querySelector('[data-figma-modal]');

  if (!grid || !modal) return;

  // Cache DOM elements
  const overlay = modal.querySelector('[data-figma-overlay]');
  const closeBtn = modal.querySelector('[data-figma-close]');
  const addBtn = modal.querySelector('[data-figma-add]');
  const titleEl = modal.querySelector('[data-figma-title]');
  const priceEl = modal.querySelector('[data-figma-price]');
  const descEl = modal.querySelector('[data-figma-desc]');
  const imageEl = modal.querySelector('[data-figma-image]');
  const optionsEl = modal.querySelector('[data-figma-options]');
  const statusEl = modal.querySelector('[data-figma-status]');

  // State
  let currentProduct = null;
  let selectedVariant = null;
  let isAddingToCart = false;

  const bundleHandle = grid.dataset.bundleHandle || 'soft-winter-jacket';

  /**
   * Format price using Shopify's native formatter or fallback
   */
  const formatPrice = (cents) => {
    if (window.Shopify?.formatMoney) {
      return window.Shopify.formatMoney(cents);
    }
    return `$${(cents / 100).toFixed(2)}`;
  };

  /**
   * Fetch product data from Shopify API
   */
  const fetchProduct = async (handle) => {
    try {
      const response = await fetch(`/products/${handle}.js`);
      if (!response.ok) throw new Error('Product fetch failed');
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch product: ${handle}`, error);
      throw error;
    }
  };

  /**
   * Check if bundle conditions are met (Black + Medium)
   */
  const shouldAddBundle = () => {
    if (!selectedVariant?.options) return false;
    const hasBlack = selectedVariant.options.includes('Black');
    const hasMedium = selectedVariant.options.includes('Medium');
    return hasBlack && hasMedium;
  };

  /**
   * Build variant selectors in modal
   */
  const renderVariantSelectors = (product) => {
    optionsEl.innerHTML = '';

    product.options.forEach((option, index) => {
      const optionWrapper = document.createElement('div');
      const label = document.createElement('label');
      const select = document.createElement('select');

      label.textContent = option.name;
      label.htmlFor = `figma-option-${index}`;
      select.id = `figma-option-${index}`;

      option.values.forEach((value) => {
        const optionEl = document.createElement('option');
        optionEl.value = value;
        optionEl.textContent = value;
        select.appendChild(optionEl);
      });

      // Update variant on selection change
      select.addEventListener('change', () => updateSelectedVariant(product));

      optionWrapper.appendChild(label);
      optionWrapper.appendChild(select);
      optionsEl.appendChild(optionWrapper);
    });

    updateSelectedVariant(product);
  };

  /**
   * Update selected variant based on current select values
   */
  const updateSelectedVariant = (product) => {
    const selects = Array.from(optionsEl.querySelectorAll('select'));
    const selectedOptions = selects.map((select) => select.value);

    selectedVariant = product.variants.find((variant) => {
      return variant.options.every((optValue, idx) => optValue === selectedOptions[idx]);
    });

    if (!selectedVariant) return;

    // Update price
    priceEl.textContent = formatPrice(selectedVariant.price);

    // Update button state based on availability
    const isAvailable = selectedVariant.available;
    addBtn.disabled = !isAvailable;
    addBtn.textContent = isAvailable ? 'ADD TO CART' : 'SOLD OUT';
  };

  /**
   * Open modal with product data
   */
  const openModal = async (productHandle) => {
    try {
      statusEl.textContent = '';
      const product = await fetchProduct(productHandle);
      currentProduct = product;

      // Populate modal content
      titleEl.textContent = product.title;
      descEl.textContent = product.description || '';
      imageEl.src = product.featured_image?.src || '';
      imageEl.alt = product.title;

      renderVariantSelectors(product);

      // Show modal
      modal.classList.add('is-active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // Focus close button for accessibility
      closeBtn.focus();
    } catch (error) {
      statusEl.textContent = 'Failed to load product. Please try again.';
    }
  };

  /**
   * Close modal
   */
  const closeModal = () => {
    modal.classList.remove('is-active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    statusEl.textContent = '';
  };

  /**
   * Add product to cart with optional bundle
   */
  const addToCart = async () => {
    if (!selectedVariant || isAddingToCart) return;

    isAddingToCart = true;
    addBtn.disabled = true;
    statusEl.textContent = 'Adding to cart...';

    const items = [
      {
        id: selectedVariant.id,
        quantity: 1
      }
    ];

    // Bundle logic: if Black + Medium, also add Soft Winter Jacket
    if (shouldAddBundle()) {
      try {
        const bundleProduct = await fetchProduct(bundleHandle);
        const bundleVariant = bundleProduct.variants.find((v) => v.available) || bundleProduct.variants[0];

        if (bundleVariant) {
          items.push({
            id: bundleVariant.id,
            quantity: 1
          });
        }
      } catch (error) {
        // If bundle fails to load, continue with main product only
        console.error('Bundle product not available', error);
      }
    }

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (!response.ok) throw new Error('Cart add failed');

      statusEl.textContent = '✓ Added to cart';
      addBtn.textContent = 'ADD TO CART';

      // Auto-close after 1.5s
      setTimeout(() => closeModal(), 1500);
    } catch (error) {
      console.error('Add to cart error:', error);
      statusEl.textContent = 'Failed to add. Please try again.';
      addBtn.textContent = 'ADD TO CART';
    } finally {
      isAddingToCart = false;
      addBtn.disabled = false;
    }
  };

  /**
   * Event Listeners
   */
  // Grid card clicks
  grid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-product-handle]');
    if (card) openModal(card.dataset.productHandle);
  });

  // Modal controls
  overlay.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  addBtn.addEventListener('click', addToCart);

  // Keyboard: Esc to close
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-active')) {
      closeModal();
    }
  });
})();
