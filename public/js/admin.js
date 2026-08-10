/**
 * Admin front-end helpers.
 */
(function () {
  // Auto-dismiss flash
  const flash = document.querySelector('.flash-inline');
  if (flash) {
    setTimeout(() => { flash.style.transition = 'opacity .4s'; flash.style.opacity = '0'; }, 3500);
    setTimeout(() => flash.remove(), 4200);
  }

  // Confirm delete on any form with data-confirm
  document.querySelectorAll('form[data-confirm]').forEach((f) => {
    f.addEventListener('submit', (e) => {
      if (!confirm(f.dataset.confirm)) e.preventDefault();
    });
  });
})();
