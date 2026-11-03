import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  components,
  cuttingJobPanels,
  cuttingJobs,
  employees,
  orders,
  scanEvents,
  shippingBoxItems,
  shippingBoxes,
} from "@/db/schema";
import type { WorkspaceData } from "@/lib/domain";
import { ensureProductBarcode } from "@/lib/product-barcodes";

async function ensureEmployees() {
  await db.insert(employees).values([
    { name: "Волков И.", role: "Оператор лазерного раскроя", department: "Раскрой", barcode: "EMP-0001-COM" },
    { name: "Егоров П.", role: "Гибщик листового металла", department: "Гибка", barcode: "EMP-0002-COM" },
    { name: "Сафин Р.", role: "Сварщик полуавтоматической сварки", department: "Сварка", barcode: "EMP-0003-COM" },
    { name: "Лебедев Н.", role: "Слесарь-сборщик", department: "Сборка", barcode: "EMP-0004-COM" },
    { name: "Орлова Т.", role: "Контролёр ОТК", department: "ОТК", barcode: "EMP-0005-COM" },
    { name: "Акобян Г.", role: "Ведущий конструктор", department: "КБ", barcode: "EMP-0006-COM" },
    { name: "Красов Д.", role: "Маляр по металлу", department: "Покраска", barcode: "EMP-0007-COM" },
    { name: "Никитин С.", role: "Комплектовщик готовой продукции", department: "Отгрузка", barcode: "EMP-0008-COM" },
  ]).onConflictDoNothing({ target: employees.barcode });
}

export async function getWorkspace(): Promise<WorkspaceData> {
  await ensureEmployees();
  const readyWithoutLabels = await db
    .select({ id: components.id })
    .from(components)
    .where(and(eq(components.productionStatus, "ready"), isNull(components.productBarcode)));
  for (const component of readyWithoutLabels) await ensureProductBarcode(component.id);

  const [orderRows, componentRows, jobRows, jobPanelRows, boxRows, boxItemRows, employeeRows, eventRows] =
    await Promise.all([
      db.select().from(orders).orderBy(asc(orders.id)),
      db.select().from(components).orderBy(asc(components.id)),
      db.select().from(cuttingJobs).orderBy(asc(cuttingJobs.id)),
      db.select().from(cuttingJobPanels).orderBy(asc(cuttingJobPanels.id)),
      db.select().from(shippingBoxes).orderBy(asc(shippingBoxes.id)),
      db.select().from(shippingBoxItems).orderBy(asc(shippingBoxItems.id)),
      db.select().from(employees).orderBy(asc(employees.id)),
      db.select().from(scanEvents).orderBy(desc(scanEvents.createdAt)).limit(50),
    ]);

  return {
    orders: orderRows.map((row) => ({
      ...row,
      stage: row.stage as WorkspaceData["orders"][number]["stage"],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    components: componentRows.map((row) => ({
      ...row,
      stage: row.stage as WorkspaceData["components"][number]["stage"],
      kdStatus: row.kdStatus as WorkspaceData["components"][number]["kdStatus"],
      productionStatus: row.productionStatus as WorkspaceData["components"][number]["productionStatus"],
      kdStartedAt: row.kdStartedAt?.toISOString() ?? null,
      kdCompletedAt: row.kdCompletedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    cuttingJobs: jobRows.map((row) => ({
      ...row,
      status: row.status as WorkspaceData["cuttingJobs"][number]["status"],
      createdAt: row.createdAt.toISOString(),
      transferredAt: row.transferredAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    })),
    jobPanels: jobPanelRows.map((row) => ({ ...row, addedAt: row.addedAt.toISOString() })),
    shippingBoxes: boxRows.map((row) => ({
      ...row,
      status: row.status as WorkspaceData["shippingBoxes"][number]["status"],
      createdAt: row.createdAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      shippedAt: row.shippedAt?.toISOString() ?? null,
    })),
    shippingBoxItems: boxItemRows.map((row) => ({
      ...row,
      addedAt: row.addedAt.toISOString(),
      lastScannedAt: row.lastScannedAt.toISOString(),
    })),
    employees: employeeRows,
    scanEvents: eventRows.map((row) => ({
      ...row,
      entityType: row.entityType as WorkspaceData["scanEvents"][number]["entityType"],
      station: row.station as WorkspaceData["scanEvents"][number]["station"],
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
