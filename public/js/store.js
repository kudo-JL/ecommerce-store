/**
 * Store front-end helpers.
 */
(function () {
  // Auto-dismiss flash
  const flash = document.querySelector('.flash');
  if (flash) {
    setTimeout(() => { flash.style.transition = 'opacity .4s'; flash.style.opacity = '0'; }, 3500);
    setTimeout(() => flash.remove(), 4200);
  }

  // Confirm before add-to-cart from product detail (optional, harmless)
  document.querySelectorAll('form[action^="/cart/add/"]').forEach((f) => {
    f.addEventListener('submit', () => {
      const btn = f.querySelector('button[type="submit"], button:not([type])');
      if (btn) {
        btn.disabled = true;
        setTimeout(() => (btn.disabled = false), 1500);
      }
    });
  });

  // Confirm on cart clear
  document.querySelectorAll('form[action="/cart/clear"]').forEach((f) => {
    f.addEventListener('submit', (e) => {
      if (!confirm('إفراغ السلة بالكامل؟')) e.preventDefault();
    });
  });
})();
