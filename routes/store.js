router.post('/checkout/finalize', attachCart, (req, res) => {
  const { customer_name, customer_phone, customer_city, customer_address, notes } = req.body || {};
  const cart = cartLib.readCart(req);
  const items = Object.entries(cart.items || {});

  if (!items.length) return res.redirect('/cart');

  const subtotal = items.reduce((s, [, it]) => s + (it.price || 0) * (it.qty || 0), 0);
  const shipping = calcShipping(subtotal);
  const total = subtotal + shipping;

  const r = db.run(
    `INSERT INTO orders
      (customer_name, customer_phone, customer_city, customer_address, notes, subtotal, shipping, total, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
    [customer_name, customer_phone, customer_city || '', customer_address || '', notes || '',
     subtotal, shipping, total]
  );
  const orderId = r.lastInsertRowid;

  for (const [pid, it] of items) {
    db.run(
      `INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, Number(pid), it.name, it.price, it.qty, it.price * it.qty]
    );
    db.run('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?', [it.qty, Number(pid)]);
  }

  const savedOrder = db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  const orderItems = db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

  notifier
    .notifyNewOrder(savedOrder, orderItems, getSetting('store_name', 'متجر رياضي'))
    .then((r) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[notifier]', JSON.stringify(r));
      }
    })
    .catch((e) => console.error('[notifier] fatal:', e));

  cartLib.clear(res);
  res.render('store/order-success', {
    ...viewBase(req),
    title: 'تم استلام الطلب',
    orderId,
    activeNav: 'cart',
  });
});
