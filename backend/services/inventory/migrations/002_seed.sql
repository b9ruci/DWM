-- Datos ficticios iniciales (estado restaurable con scripts/reset-data.js).
INSERT INTO products (id, sku, nombre, descripcion, categoria, precio, unidad, stock, imagen, destacado, activo, updated_at) VALUES
 ('p-001','BAR-DUB-LAB','Barra Chocolate Dubái Labubu','Barra de chocolate de leche rellena de crema de pistacho y kataifi crujiente. Venta por kilo.','Barras',100000,'kg',15,'/assets/img/productos/barra-dubai.svg',1,1,'2026-11-01T00:00:00Z'),
 ('p-002','FIG-MIAU','Choco Miau','Figura de chocolate de leche con forma de gatito, decorada a mano.','Figuras',3990,'unidad',40,'/assets/img/productos/choco-miau.svg',1,1,'2026-11-01T00:00:00Z'),
 ('p-003','FIG-WAU','Choco Wau','Figura de chocolate semiamargo con forma de perrito.','Figuras',3990,'unidad',35,'/assets/img/productos/choco-wau.svg',1,1,'2026-11-01T00:00:00Z'),
 ('p-004','FIG-FLOR','Flor de Chocolate','Ramo de flores de chocolate blanco y de leche, ideal para regalo.','Figuras',5490,'unidad',25,'/assets/img/productos/flor-chocolate.svg',1,1,'2026-11-01T00:00:00Z'),
 ('p-005','BOM-SUR-12','Bombones Surtidos (12 u.)','Caja de 12 bombones artesanales con rellenos de frutos secos, licor y caramelo.','Bombones',12990,'unidad',20,'/assets/img/productos/bombones.svg',1,1,'2026-11-01T00:00:00Z'),
 ('p-006','BOM-TRU-PIS','Trufas de Pistacho (6 u.)','Trufas de chocolate amargo con centro de pistacho.','Bombones',8990,'unidad',18,'/assets/img/productos/trufas.svg',0,1,'2026-11-01T00:00:00Z'),
 ('p-007','BAR-70','Tableta Amarga 70% Cacao','Tableta de 100 g de chocolate amargo 70% cacao de origen.','Barras',4590,'unidad',50,'/assets/img/productos/tableta.svg',0,1,'2026-11-01T00:00:00Z'),
 ('p-008','BEB-CAL','Mezcla Chocolate Caliente','Mezcla de 250 g para preparar chocolate caliente espeso.','Bebidas',6990,'unidad',3,'/assets/img/productos/chocolate-caliente.svg',0,1,'2026-11-01T00:00:00Z'),
 ('p-009','FIG-HUEVO','Huevo de Chocolate Sorpresa','Huevo de chocolate de leche con sorpresa en su interior.','Figuras',9990,'unidad',0,'/assets/img/productos/huevo.svg',0,1,'2026-11-01T00:00:00Z');

INSERT INTO promotions (id, product_id, titulo, subtitulo, orden, activo) VALUES
 ('promo-1','p-001','Barra Chocolate Dubái Labubu','La barra del momento, rellena de pistacho y kataifi.',1,1),
 ('promo-2','p-005','Bombones Surtidos','12 sabores artesanales en una caja para regalar.',2,1),
 ('promo-3','p-004','Flor de Chocolate','Un ramo que no se marchita: chocolate blanco y de leche.',3,1),
 ('promo-4','p-002','Choco Miau','Nuestro gatito de chocolate, favorito de los niños.',4,1);
