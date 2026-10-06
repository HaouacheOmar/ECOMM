"""The demo shop's Products: (photo slug, name, category, price in DA, stock, description).
Photos are in photos/<slug>.webp (Unsplash License, credited in photos/CREDITS.md)."""

CATEGORIES = ['Kitchen', 'Home decor', 'Textiles', 'Bags', 'Stationery']

PRODUCTS = [
    ('ceramic-mug', 'Speckled Ceramic Mug', 'Kitchen', 1200, 40, 'Hand-glazed stoneware mug, 350 ml. Dishwasher safe.'),
    ('espresso-cups', 'Espresso Cup Set', 'Kitchen', 2800, 18, 'Four porcelain espresso cups with saucers.'),
    ('cast-iron-skillet', 'Cast Iron Skillet', 'Kitchen', 5400, 12, 'Pre-seasoned 26 cm skillet for stove, oven and open fire.'),
    ('cutting-board', 'Olive Wood Cutting Board', 'Kitchen', 3800, 9, 'Solid olive wood from Kabylie, each grain pattern unique.'),
    ('copper-kettle', 'Copper Kettle', 'Kitchen', 7900, 0, 'Hammered copper stovetop kettle, 1.5 litres.'),
    ('glass-teapot', 'Glass Teapot', 'Kitchen', 3200, 15, 'Heat-resistant glass teapot with a steel infuser.'),
    ('stoneware-bowls', 'Stoneware Bowl Set', 'Kitchen', 4500, 20, 'Set of four matte bowls in earthy tones.'),
    ('linen-apron', 'Linen Apron', 'Kitchen', 2400, 25, 'Washed linen apron with a deep front pocket.'),
    ('terracotta-vase', 'Terracotta Vase', 'Home decor', 2900, 14, 'Unglazed terracotta, shaped by hand. 28 cm tall.'),
    ('brass-candle-holder', 'Brass Candle Holder', 'Home decor', 2200, 30, 'Solid brass holder for standard taper candles.'),
    ('rattan-mirror', 'Rattan Wall Mirror', 'Home decor', 8600, 6, 'Round mirror in a woven rattan frame, 60 cm.'),
    ('table-lamp', 'Ceramic Table Lamp', 'Home decor', 9800, 0, 'Ceramic base with a pleated linen shade.'),
    ('ceramic-planter', 'Ceramic Planter', 'Home decor', 1900, 22, 'Glazed planter with drainage and a saucer.'),
    ('woven-basket', 'Woven Storage Basket', 'Home decor', 2600, 17, 'Seagrass basket with handles, for throws or toys.'),
    ('berber-rug', 'Berber Wool Rug', 'Textiles', 24500, 4, 'Hand-knotted wool rug, 160 x 230 cm.'),
    ('throw-pillow', 'Linen Throw Pillow', 'Textiles', 2100, 35, 'Stonewashed linen cover with a feather insert.'),
    ('throw-blanket', 'Cotton Throw Blanket', 'Textiles', 4900, 19, 'Soft woven cotton throw with tasselled ends.'),
    ('bath-towel', 'Waffle Bath Towel', 'Textiles', 1800, 28, 'Quick-drying waffle-weave cotton towel.'),
    ('tablecloth', 'Linen Tablecloth', 'Textiles', 5200, 0, 'Washed linen tablecloth for six, 150 x 250 cm.'),
    ('hammam-towel', 'Hammam Towel', 'Textiles', 1600, 40, 'Light striped cotton fouta for bath and beach.'),
    ('leather-tote', 'Leather Tote', 'Bags', 11500, 10, 'Full-grain leather tote that fits a 14-inch laptop.'),
    ('canvas-backpack', 'Canvas Backpack', 'Bags', 6900, 16, 'Waxed canvas backpack with leather trims.'),
    ('straw-bag', 'Straw Market Bag', 'Bags', 2700, 24, 'Woven palm-leaf basket bag for the market.'),
    ('crossbody-bag', 'Leather Crossbody Bag', 'Bags', 7800, 11, 'Compact crossbody with an adjustable strap.'),
    ('weekender', 'Weekender Duffel', 'Bags', 9500, 7, 'Roomy canvas duffel for two-day trips.'),
    ('leather-notebook', 'Leather Notebook', 'Stationery', 2300, 33, 'Refillable A5 notebook in a stitched leather cover.'),
    ('fountain-pen', 'Fountain Pen', 'Stationery', 3600, 13, 'Brass fountain pen with a fine steel nib.'),
    ('desk-organizer', 'Wooden Desk Organizer', 'Stationery', 2900, 20, 'Walnut tray for pens, cards and clips.'),
    ('kraft-notebooks', 'Kraft Notebook Set', 'Stationery', 1100, 50, 'Three dotted-grid notebooks with kraft covers.'),
    ('brass-bookmark', 'Patterned Bookmark Set', 'Stationery', 900, 26, 'Four printed bookmarks with zellige patterns. Retired from the range.'),
]
ARCHIVED = {'Patterned Bookmark Set'}
