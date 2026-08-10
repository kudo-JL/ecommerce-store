/**
 * Seed sample products so the store isn't empty on first run.
 *   node scripts/seed.js
 */
const path = require('path');
const fs = require('fs');
const db = require('../lib/db');
const { slugify, uniqueSlug } = require('../lib/helpers');

(async () => {
  await db.load();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'lib', 'schema.sql'), 'utf8');
  db.exec(schema);

  // ensure a sample category
  function ensureCategory(name) {
    let row = db.get('SELECT * FROM categories WHERE name = ?', [name]);
    if (row) return row;
    const slug = uniqueSlug(slugify(name), (s) => !!db.get('SELECT 1 FROM categories WHERE slug = ?', [s]));
    const r = db.run('INSERT INTO categories(name, slug) VALUES(?, ?)', [name, slug]);
    return { id: r.lastInsertRowid, name, slug };
  }

  const cat1 = ensureCategory('إلكترونيات');
  const cat2 = ensureCategory('منزل ومطبخ');
  const cat3 = ensureCategory('إكسسوارات');

  const samples = [
    {
      name: 'سماعات بلوتوث لاسلكية مع علبة شحن',
      description: 'سماعات لاسلكية بجودة صوت عالية، بطارية تدوم 24 ساعة مع علبة الشحن. مريحة للاستخدام اليومي والرياضة.',
      original_price: 180,
      selling_price: 249,
      image_url: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600',
      category_id: cat1.id,
      stock: 12,
      is_imported: 1,
      source_url: 'https://example.com/earbuds',
      source_domain: 'example.com',
    },
    {
      name: 'ساعة ذكية للرياضة واللياقة',
      description: 'ساعة ذكية مقاومة للماء، تقيس نبضات القلب، تتبع النوم، أكثر من 50 وضع رياضي.',
      original_price: 320,
      selling_price: 449,
      image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
      category_id: cat1.id,
      stock: 8,
      is_imported: 1,
      source_url: 'https://example.com/smartwatch',
      source_domain: 'example.com',
    },
    {
      name: 'مكنسة كهربائية لاسلكية قوية',
      description: 'مكنسة لاسلكية ببطارية تدوم 45 دقيقة، شفط قوي، خفيفة الوزن. تأتي مع عدة رؤوس للاستخدامات المتعددة.',
      original_price: 540,
      selling_price: 749,
      image_url: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600',
      category_id: cat2.id,
      stock: 5,
      is_imported: 1,
      source_url: 'https://example.com/vacuum',
      source_domain: 'example.com',
    },
    {
      name: 'حقيبة ظهر للابتوب مقاومة للماء',
      description: 'حقيبة ظهر أنيقة مقاومة للماء، تتسع للابتوب 15.6 إنش، جيوب متعددة، مريحة للحمل اليومي.',
      original_price: 160,
      selling_price: 219,
      image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600',
      category_id: cat3.id,
      stock: 20,
      is_imported: 0,
      source_url: '',
      source_domain: '',
    },
    {
      name: 'مصباح مكتبي LED قابل للشحن',
      description: 'مصباح مكتبي عصري، إضاءة مريحة للعين، 3 درجات سطوع، بطارية قابلة للشحن USB-C.',
      original_price: 95,
      selling_price: 139,
      image_url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600',
      category_id: cat2.id,
      stock: 30,
      is_imported: 1,
      source_url: 'https://example.com/lamp',
      source_domain: 'example.com',
    },
    {
      name: 'شاحن سريع 65 واط GaN',
      description: 'شاحن صغير الحجم بتقنية GaN، يدعم الشحن السريع للابتوب والهاتف، 3 منافذ (2 USB-C + USB-A).',
      original_price: 130,
      selling_price: 189,
      image_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600',
      category_id: cat1.id,
      stock: 25,
      is_imported: 0,
      source_url: '',
      source_domain: '',
    },
  ];

  let inserted = 0;
  for (const s of samples) {
    const existing = db.get('SELECT 1 FROM products WHERE name = ?', [s.name]);
    if (existing) continue;
    const slug = uniqueSlug(slugify(s.name), (s2) => !!db.get('SELECT 1 FROM products WHERE slug = ?', [s2]));
    db.run(
      `INSERT INTO products
        (name, slug, description, original_price, selling_price, currency,
         image_url, source_url, source_domain, category_id, stock, is_imported, is_published)
       VALUES (?, ?, ?, ?, ?, 'MAD', ?, ?, ?, ?, ?, ?, 1)`,
      [
        s.name, slug, s.description, s.original_price, s.selling_price,
        s.image_url, s.source_url, s.source_domain, s.category_id, s.stock, s.is_imported,
      ]
    );
    inserted += 1;
  }

  console.log(`[seed] inserted ${inserted} products. Total now: ${
    db.get('SELECT COUNT(*) AS c FROM products').c
  }`);
})();
