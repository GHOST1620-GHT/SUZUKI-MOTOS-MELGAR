/**
 * Esquema de base de datos — Sistema de Fidelización Suzuki Melgar (PostgreSQL).
 */
import { relations } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Personal del concesionario. role: ADMIN | ASESOR | TALLER */
export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("ASESOR"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastLoginAt: ts("last_login_at"),
});

export const levels = pgTable("levels", {
  id: id(),
  name: text("name").notNull().unique(),
  /** Puntos históricos necesarios */
  minPoints: integer("min_points").notNull(),
  multiplier: doublePrecision("multiplier").notNull().default(1),
  color: text("color").notNull().default("#64748b"),
  /** Un beneficio por línea */
  benefits: text("benefits").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const customers = pgTable(
  "customers",
  {
    id: id(),
    documentType: text("document_type").notNull().default("CC"),
    document: text("document").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    birthDate: ts("birth_date"),
    city: text("city").default("Melgar"),
    address: text("address"),
    notes: text("notes"),
    passwordHash: text("password_hash"),
    portalActivatedAt: ts("portal_activated_at"),
    acceptsMarketing: boolean("accepts_marketing").notNull().default(true),
    pointsBalance: integer("points_balance").notNull().default(0),
    lifetimePoints: integer("lifetime_points").notNull().default(0),
    lifetimeSpend: doublePrecision("lifetime_spend").notNull().default(0),
    levelId: text("level_id").references(() => levels.id),
    referralCode: text("referral_code").notNull().unique(),
    referredById: text("referred_by_id"),
    lastVisitAt: ts("last_visit_at"),
    lastBirthdayBonusYear: integer("last_birthday_bonus_year"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("customers_last_name_idx").on(t.lastName), index("customers_phone_idx").on(t.phone)],
);

export const motorcycles = pgTable("motorcycles", {
  id: id(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  brand: text("brand").notNull().default("Suzuki"),
  model: text("model").notNull(),
  year: integer("year"),
  plate: text("plate").unique(),
  vin: text("vin"),
  color: text("color"),
  purchaseDate: ts("purchase_date"),
  currentKm: integer("current_km").notNull().default(0),
  lastServiceDate: ts("last_service_date"),
  lastServiceKm: integer("last_service_km"),
  serviceIntervalKm: integer("service_interval_km").notNull().default(3000),
  serviceIntervalDays: integer("service_interval_days").notNull().default(120),
  avgKmPerMonth: integer("avg_km_per_month").notNull().default(800),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** category: MOTO | REPUESTOS | ACCESORIOS | TALLER · source: MANUAL | IMPORTACION | API */
export const purchases = pgTable(
  "purchases",
  {
    id: id(),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    motorcycleId: text("motorcycle_id").references(() => motorcycles.id, { onDelete: "set null" }),
    invoiceNumber: text("invoice_number").unique(),
    category: text("category").notNull(),
    amount: doublePrecision("amount").notNull(),
    pointsEarned: integer("points_earned").notNull(),
    date: ts("date").notNull().defaultNow(),
    source: text("source").notNull().default("MANUAL"),
    notes: text("notes"),
    createdById: text("created_by_id").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("purchases_date_idx").on(t.date), index("purchases_customer_idx").on(t.customerId)],
);

export const serviceRecords = pgTable("service_records", {
  id: id(),
  motorcycleId: text("motorcycle_id").notNull().references(() => motorcycles.id, { onDelete: "cascade" }),
  date: ts("date").notNull().defaultNow(),
  km: integer("km").notNull(),
  type: text("type").notNull(),
  notes: text("notes"),
  createdById: text("created_by_id").references(() => users.id),
  purchaseId: text("purchase_id").references(() => purchases.id, { onDelete: "set null" }),
});

export const rewards = pgTable("rewards", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** SERVICIO | ACCESORIO | DESCUENTO | EXPERIENCIA */
  category: text("category").notNull().default("ACCESORIO"),
  pointsCost: integer("points_cost").notNull(),
  /** null = ilimitado */
  stock: integer("stock"),
  emoji: text("emoji").notNull().default("🎁"),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  minLevelId: text("min_level_id").references(() => levels.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** status: PENDIENTE | APROBADO | ENTREGADO | CANCELADO · channel: PORTAL | MOSTRADOR */
export const redemptions = pgTable("redemptions", {
  id: id(),
  code: text("code").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  rewardId: text("reward_id").notNull().references(() => rewards.id),
  points: integer("points").notNull(),
  status: text("status").notNull().default("PENDIENTE"),
  channel: text("channel").notNull().default("PORTAL"),
  notes: text("notes"),
  requestedAt: ts("requested_at").notNull().defaultNow(),
  deliveredAt: ts("delivered_at"),
  handledById: text("handled_by_id").references(() => users.id),
});

/** type: COMPRA | CANJE | BONO | REFERIDO | CUMPLEANOS | BIENVENIDA | AJUSTE | VENCIMIENTO | DEVOLUCION */
export const pointMovements = pgTable(
  "point_movements",
  {
    id: id(),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    points: integer("points").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    description: text("description").notNull(),
    purchaseId: text("purchase_id").references(() => purchases.id, { onDelete: "set null" }),
    redemptionId: text("redemption_id").references(() => redemptions.id, { onDelete: "set null" }),
    createdById: text("created_by_id").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("movements_customer_idx").on(t.customerId, t.createdAt), index("movements_date_idx").on(t.createdAt)],
);

/** status: PENDIENTE | CONTACTADO | COMPRO | DESCARTADO */
export const referrals = pgTable("referrals", {
  id: id(),
  referrerId: text("referrer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  interest: text("interest"),
  status: text("status").notNull().default("PENDIENTE"),
  referredCustomerId: text("referred_customer_id").references(() => customers.id, { onDelete: "set null" }),
  bonusPoints: integer("bonus_points").notNull().default(0),
  notes: text("notes"),
  createdAt: ts("created_at").notNull().defaultNow(),
  convertedAt: ts("converted_at"),
});

/** kind: MANTENIMIENTO | CUMPLEANOS | PROMOCION | INACTIVO | PUNTOS | CANJE */
export const reminderLogs = pgTable("reminder_logs", {
  id: id(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  motorcycleId: text("motorcycle_id").references(() => motorcycles.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  channel: text("channel").notNull().default("WHATSAPP"),
  message: text("message").notNull(),
  sentById: text("sent_by_id").references(() => users.id),
  sentAt: ts("sent_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: id(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const importBatches = pgTable("import_batches", {
  id: id(),
  fileName: text("file_name").notNull(),
  totalRows: integer("total_rows").notNull(),
  imported: integer("imported").notNull(),
  skipped: integer("skipped").notNull(),
  newCustomers: integer("new_customers").notNull().default(0),
  log: text("log").notNull().default(""),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* ---------------- Relaciones ---------------- */

export const levelsRelations = relations(levels, ({ many }) => ({ customers: many(customers), rewards: many(rewards) }));

export const customersRelations = relations(customers, ({ one, many }) => ({
  level: one(levels, { fields: [customers.levelId], references: [levels.id] }),
  referredBy: one(customers, { fields: [customers.referredById], references: [customers.id], relationName: "referredBy" }),
  referredCustomers: many(customers, { relationName: "referredBy" }),
  motorcycles: many(motorcycles),
  purchases: many(purchases),
  movements: many(pointMovements),
  redemptions: many(redemptions),
  referralsMade: many(referrals, { relationName: "referrer" }),
  notifications: many(notifications),
  reminders: many(reminderLogs),
}));

export const motorcyclesRelations = relations(motorcycles, ({ one, many }) => ({
  customer: one(customers, { fields: [motorcycles.customerId], references: [customers.id] }),
  services: many(serviceRecords),
  purchases: many(purchases),
}));

export const serviceRecordsRelations = relations(serviceRecords, ({ one }) => ({
  motorcycle: one(motorcycles, { fields: [serviceRecords.motorcycleId], references: [motorcycles.id] }),
  createdBy: one(users, { fields: [serviceRecords.createdById], references: [users.id] }),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  customer: one(customers, { fields: [purchases.customerId], references: [customers.id] }),
  motorcycle: one(motorcycles, { fields: [purchases.motorcycleId], references: [motorcycles.id] }),
  createdBy: one(users, { fields: [purchases.createdById], references: [users.id] }),
}));

export const rewardsRelations = relations(rewards, ({ one, many }) => ({
  minLevel: one(levels, { fields: [rewards.minLevelId], references: [levels.id] }),
  redemptions: many(redemptions),
}));

export const redemptionsRelations = relations(redemptions, ({ one }) => ({
  customer: one(customers, { fields: [redemptions.customerId], references: [customers.id] }),
  reward: one(rewards, { fields: [redemptions.rewardId], references: [rewards.id] }),
  handledBy: one(users, { fields: [redemptions.handledById], references: [users.id] }),
}));

export const pointMovementsRelations = relations(pointMovements, ({ one }) => ({
  customer: one(customers, { fields: [pointMovements.customerId], references: [customers.id] }),
  createdBy: one(users, { fields: [pointMovements.createdById], references: [users.id] }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(customers, { fields: [referrals.referrerId], references: [customers.id], relationName: "referrer" }),
  referredCustomer: one(customers, { fields: [referrals.referredCustomerId], references: [customers.id] }),
}));

export const reminderLogsRelations = relations(reminderLogs, ({ one }) => ({
  customer: one(customers, { fields: [reminderLogs.customerId], references: [customers.id] }),
  motorcycle: one(motorcycles, { fields: [reminderLogs.motorcycleId], references: [motorcycles.id] }),
  sentBy: one(users, { fields: [reminderLogs.sentById], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  customer: one(customers, { fields: [notifications.customerId], references: [customers.id] }),
}));

export const importBatchesRelations = relations(importBatches, ({ one }) => ({
  createdBy: one(users, { fields: [importBatches.createdById], references: [users.id] }),
}));

export type Customer = typeof customers.$inferSelect;
export type Motorcycle = typeof motorcycles.$inferSelect;
export type Level = typeof levels.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type User = typeof users.$inferSelect;
