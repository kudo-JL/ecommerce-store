router.post('/checkout', (req, res) => {
  const { customer_name, customer_phone, customer_city, customer_address, notes } = req.body || {};
  const cart = cartLib.readCart(req);
  const items = Object.entries(cart.items || {});

  if (!items.length) return res.redirect('/cart');

  const itemsArr = items.map(([id, it]) => ({ id, ...it }));
  const subtotal = itemsArr.reduce((s, it) => s + (it.price || 0) * (it.qty || 0), 0);
  const shipping = calcShipping(subtotal);

  // Validation only — show error if missing fields
  if (!customer_name || !customer_phone) {
    return res.status(400).render('store/checkout', {
      ...viewBase(req),
      title: 'إتمام الطلب',
      items: itemsArr,
      shipping,
      error: 'الاسم والهاتف مطلوبان',
      values: req.body || {},
      activeNav: 'cart',
    });
  }

  // ✅ NEW: Show announcement page (DO NOT save order yet)
  return res.render('store/checkout-confirm', {
    ...viewBase(req),
    title: 'تأكيد الطلب',
    items: itemsArr,
    subtotal,
    shipping,
    total: subtotal + shipping,
    values: req.body,
    activeNav: 'cart',
  });
});
