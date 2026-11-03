import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  nomenclature: text("nomenclature"),
  signedDate: date("signed_date").notNull(),
  shippingDate: date("shipping_date").notNull(),
  manager: text("manager").notNull(),
  developer: text("developer"),
  stage: text("stage").notNull().default("request"),
  sketchVariant: integer("sketch_variant").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const components = pgTable("components", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  modelAuthor: text("model_author").notNull(),
  stage: text("stage").notNull().default("model"),
  kdAuthor: text("kd_author"),
  kdStatus: text("kd_status").notNull().default("in_progress"),
  productionStatus: text("production_status").notNull().default("not_released"),
  barcode: text("barcode").unique(),
  productBarcode: text("product_barcode"),
  kdStartedAt: timestamp("kd_started_at", { withTimezone: true }),
  kdCompletedAt: timestamp("kd_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cuttingJobs = pgTable("cutting_jobs", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  author: text("author"),
  status: text("status").notNull().default("draft"),
  barcode: text("barcode").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  transferredAt: timestamp("transferred_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const cuttingJobPanels = pgTable(
  "cutting_job_panels",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => cuttingJobs.id, { onDelete: "cascade" }),
    componentId: integer("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("cutting_job_panels_component_unique").on(table.componentId)],
);

export const shippingBoxes = pgTable("shipping_boxes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  note: text("note"),
  status: text("status").notNull().default("created"),
  barcode: text("barcode").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
});

export const shippingBoxItems = pgTable(
  "shipping_box_items",
  {
    id: serial("id").primaryKey(),
    boxId: integer("box_id")
      .notNull()
      .references(() => shippingBoxes.id, { onDelete: "cascade" }),
    componentId: integer("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("shipping_box_items_box_component_unique").on(table.boxId, table.componentId)],
);

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  barcode: text("barcode").notNull().unique(),
  active: boolean("active").notNull().default(true),
});

export const scanEvents = pgTable("scan_events", {
  id: serial("id").primaryKey(),
  employeeName: text("employee_name").notNull(),
  employeeCode: text("employee_code").notNull(),
  documentCode: text("document_code").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  station: text("station"),
  message: text("message").notNull(),
  success: boolean("success").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
