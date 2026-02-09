// @ts-nocheck
/**
 * Figma Grid Modal and Cart Handler (ported to tisso-vision markup)
 * - Opens quick view modal from gallery items
 * - Renders Color swatches + Size dropdown (when those options exist)
 * - Adds selected variant to cart via /cart/add.js
 * - Bundle logic: when selected options contain Black + Medium, also add bundle product
 */
(() => {
  const colorMap = {
    White: '#FFFFFF',
    Black: '#000000',
    Red: '#b20f36',
    Grey: '#afafb7',
    Gray: '#afafb7',
    Blue: '#1e3a8a',
    Green: '#166534'
  };

  const formatPrice = (cents) => {
    if (window.Shopify?.formatMoney) return window.Shopify.formatMoney(cents);
    return `$${(cents / 100).toFixed(2)}`;
  };

  const fetchProduct = async (handle) => {
    const response = await fetch(`/products/${handle}.js`);
    if (!response.ok) throw new Error('Product fetch failed');
    return response.json();
  };

  const normalizeName = (name) => (name || '').toString().trim().toLowerCase();

  const findOptionIndex = (product, matcher) => {
    const idx = product.options.findIndex((opt) => matcher(normalizeName(opt.name)));
    return idx >= 0 ? idx : null;
  };

  const getVariantByOptions = (product, selectedOptions) => {
    return (
      product.variants.find((variant) =>
        variant.options.every((value, index) => value === selectedOptions[index])
      ) || null
    );
  };

  const shouldAddBundle = (variant) => {
    if (!variant?.options) return false;
    const hasBlack = variant.options.some((opt) => opt === 'Black');
    const hasMedium = variant.options.some((opt) => opt === 'Medium');
    return hasBlack && hasMedium;
  };

  const initSection = (grid) => {
    const sectionId = grid.dataset.sectionId;
    const modal = document.querySelector(`[data-figma-modal][data-section-id="${sectionId}"]`);
    if (!modal) return;

    const closeBtn = modal.querySelector('[data-figma-close]');
    const addBtn = modal.querySelector('[data-figma-add]');
    const titleEl = modal.querySelector('[data-figma-title]');
    const priceEl = modal.querySelector('[data-figma-price]');
    const descEl = modal.querySelector('[data-figma-desc]');
    const imageEl = modal.querySelector('[data-figma-image]');
    const statusEl = modal.querySelector('[data-figma-status]');

    const colorGridEl = modal.querySelector('[data-figma-color-grid]');
    const colorLabelsEl = modal.querySelector('[data-figma-color-labels]');
    const colorGroupEl = modal.querySelector('[data-figma-color-group]');

    const sizeDropdownBtn = modal.querySelector('[data-figma-size-dropdown]');
    const sizeTextEl = modal.querySelector('[data-figma-size-text]');
    const sizeOptionsEl = modal.querySelector('[data-figma-size-options]');
    const sizeGroupEl = modal.querySelector('[data-figma-size-group]');

    const bundleHandle = grid.dataset.bundleHandle || 'soft-winter-jacket';

    let currentProduct = null;
    let selectedVariant = null;
    let selectedOptions = [];
    let isAddingToCart = false;

    const setStatus = (message, ok = true) => {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.style.color = ok ? '' : '#b00020';
    };

    const openModal = () => {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      closeBtn?.focus();
    };

    const closeModal = () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      setStatus('');
      if (sizeDropdownBtn) sizeDropdownBtn.classList.remove('open');
      if (sizeOptionsEl) sizeOptionsEl.classList.remove('open');
    };

    const updateSelectedVariantUI = () => {
      if (!currentProduct) return;
      selectedVariant = getVariantByOptions(currentProduct, selectedOptions);

      if (!selectedVariant) {
        if (addBtn) addBtn.disabled = true;
        if (priceEl) priceEl.textContent = '';
        return;
      }

      if (priceEl) priceEl.textContent = formatPrice(selectedVariant.price);
      const available = !!selectedVariant.available;
      if (addBtn) addBtn.disabled = !available || isAddingToCart;
    };

    const renderColor = (product, colorIndex) => {
      if (!colorGridEl || !colorLabelsEl || !colorGroupEl) return;

      const option = product.options[colorIndex];
      const values = option?.values || [];

      if (!values.length) {
        colorGroupEl.style.display = 'none';
        return;
      }

      colorGroupEl.style.display = '';
      colorGridEl.innerHTML = '';
      colorLabelsEl.innerHTML = '';

      values.forEach((value, index) => {
        const colorHex = colorMap[value] || '#cccccc';

        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = `color-swatch${index === 0 ? ' active' : ''}`;
        swatch.setAttribute('data-value', value);
        swatch.innerHTML = `<span class="color-indicator" style="background-color: ${colorHex};"></span>`;

        swatch.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectedOptions[colorIndex] = value;
          colorGridEl.querySelectorAll('.color-swatch').forEach((el) => el.classList.remove('active'));
          colorLabelsEl.querySelectorAll('.color-label').forEach((el) => el.classList.remove('active'));
          swatch.classList.add('active');
          const label = colorLabelsEl.querySelector(`[data-value="${CSS.escape(value)}"]`);
          if (label) label.classList.add('active');
          updateSelectedVariantUI();
        });

        const label = document.createElement('span');
        label.className = `color-label${index === 0 ? ' active' : ''}`;
        label.textContent = value;
        label.setAttribute('data-value', value);

        colorGridEl.appendChild(swatch);
        colorLabelsEl.appendChild(label);
      });
    };

    const renderSize = (product, sizeIndex) => {
      if (!sizeOptionsEl || !sizeGroupEl || !sizeDropdownBtn || !sizeTextEl) return;

      const option = product.options[sizeIndex];
      const values = option?.values || [];

      if (!values.length) {
        sizeGroupEl.style.display = 'none';
        return;
      }

      sizeGroupEl.style.display = '';
      sizeOptionsEl.innerHTML = '';
      sizeTextEl.textContent = 'Choose your size';

      values.forEach((value) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'size-option';
        btn.textContent = value;
        btn.setAttribute('data-value', value);

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectedOptions[sizeIndex] = value;
          sizeTextEl.textContent = value;
          sizeDropdownBtn.classList.remove('open');
          sizeOptionsEl.classList.remove('open');
          updateSelectedVariantUI();
        });

        sizeOptionsEl.appendChild(btn);
      });
    };

    const setupOptionDefaults = (product) => {
      selectedOptions = product.options.map((opt) => opt.values?.[0] || null);
    };

    const loadProductIntoModal = async (handle) => {
      setStatus('');
      try {
        const product = await fetchProduct(handle);
        currentProduct = product;

        if (titleEl) titleEl.textContent = product.title;
        if (descEl) descEl.innerHTML = product.description || '';
        if (imageEl) {
          imageEl.src = product.featured_image?.src || '';
          imageEl.alt = product.title;
        }

        setupOptionDefaults(product);

        const colorIndex = findOptionIndex(product, (n) => n.includes('color'));
        const sizeIndex = findOptionIndex(product, (n) => n.includes('size'));

        if (colorIndex === null && colorGroupEl) colorGroupEl.style.display = 'none';
        if (sizeIndex === null && sizeGroupEl) sizeGroupEl.style.display = 'none';

        if (colorIndex !== null) renderColor(product, colorIndex);
        if (sizeIndex !== null) renderSize(product, sizeIndex);

        updateSelectedVariantUI();
        openModal();
      } catch (error) {
        console.error(`Failed to load product: ${handle}`, error);
        setStatus('Failed to load product. Please try again.', false);
      }
    };

    const addToCart = async () => {
      if (!selectedVariant || isAddingToCart) return;

      isAddingToCart = true;
      if (addBtn) addBtn.disabled = true;
      setStatus('Adding to cart...');

      const items = [{ id: selectedVariant.id, quantity: 1 }];

      if (shouldAddBundle(selectedVariant)) {
        try {
          const bundleProduct = await fetchProduct(bundleHandle);
          const bundleVariant = bundleProduct.variants.find((v) => v.available) || bundleProduct.variants[0];
          if (bundleVariant) items.push({ id: bundleVariant.id, quantity: 1 });
        } catch (error) {
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

        setStatus('✓ Added to cart', true);
        setTimeout(() => closeModal(), 1200);
      } catch (error) {
        console.error('Add to cart error:', error);
        setStatus('Failed to add. Please try again.', false);
      } finally {
        isAddingToCart = false;
        updateSelectedVariantUI();
      }
    };

    // Grid clicks
    grid.addEventListener('click', (event) => {
      const item = event.target.closest('.gallery-item[data-product-handle]');
      if (!item) return;
      const handle = item.dataset.productHandle;
      if (handle) loadProductIntoModal(handle);
    });

    // Keyboard support
    grid.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const item = event.target.closest('.gallery-item[data-product-handle]');
      if (!item) return;
      event.preventDefault();
      const handle = item.dataset.productHandle;
      if (handle) loadProductIntoModal(handle);
    });

    // Modal controls
    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    addBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      addToCart();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });

    // Size dropdown
    sizeDropdownBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !sizeDropdownBtn.classList.contains('open');
      sizeDropdownBtn.classList.toggle('open', willOpen);
      sizeOptionsEl?.classList.toggle('open', willOpen);
    });

    document.addEventListener('click', (e) => {
      if (!modal.classList.contains('active')) return;
      if (!sizeDropdownBtn || !sizeOptionsEl) return;
      if (sizeDropdownBtn.contains(e.target) || sizeOptionsEl.contains(e.target)) return;
      sizeDropdownBtn.classList.remove('open');
      sizeOptionsEl.classList.remove('open');
    });
  };

  const init = () => {
    const grids = document.querySelectorAll('[data-figma-grid]');
    if (!grids.length) return;
    grids.forEach(initSection);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
