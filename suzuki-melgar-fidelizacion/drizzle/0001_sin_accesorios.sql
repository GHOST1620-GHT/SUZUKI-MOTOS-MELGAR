-- Suzuki Melgar Moto no vende accesorios: las compras existentes en esa categoría pasan a Repuestos.
UPDATE "purchases" SET "category" = 'REPUESTOS' WHERE "category" = 'ACCESORIOS';
--> statement-breakpoint
UPDATE "point_movements" SET "description" = replace("description", 'Accesorios', 'Repuestos') WHERE "type" = 'COMPRA' AND "description" LIKE 'Accesorios%';
--> statement-breakpoint
DELETE FROM "settings" WHERE "key" = 'pesosPerPointACCESORIOS';
--> statement-breakpoint
UPDATE "levels" SET "benefits" = replace("benefits", 'descuento en accesorios', 'descuento en repuestos');
