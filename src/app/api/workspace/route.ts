import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
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
import { COMPONENT_TYPES, DESIGNERS, PRODUCTION_LABELS, STATIONS, makeBarcode, type ComponentData, type Station } from "@/lib/domain";
import { getWorkspace } from "@/lib/workspace";
import { ensureProductBarcode } from "@/lib/product-barcodes";

export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

class ActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function fail(message: string, status = 400): never {
  throw new ActionError(message, status);
}

function text(body: Body, key: string, required = true) {
  const value = typeof body[key] === "string" ? body[key].trim() : "";
  if (required && !value) fail("Заполните все обязательные поля");
  return value;
}

function id(body: Body, key: string) {
  const value = Number(body[key]);
  if (!Number.isInteger(value) || value < 1) fail("Некорректный идентификатор");
  return value;
}

async function getOrder(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) fail("Заявка не найдена", 404);
  return order;
}

async function getComponent(componentId: number) {
  const [component] = await db
    .select()
    .from(components)
    .where(eq(components.id, componentId))
    .limit(1);
  if (!component) fail("Компонент не найден", 404);
  return component;
}

async function getJob(jobId: number) {
  const [job] = await db.select().from(cuttingJobs).where(eq(cuttingJobs.id, jobId)).limit(1);
  if (!job) fail("Задание на раскрой не найдено", 404);
  return job;
}

async function getBox(boxId: number) {
  const [box] = await db.select().from(shippingBoxes).where(eq(shippingBoxes.id, boxId)).limit(1);
  if (!box) fail("Ящик не найден", 404);
  return box;
}

export async function GET() {
  const data = await getWorkspace();
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  let message = "Изменения сохранены";
  let extra: Record<string, unknown> = {};

  try {
    const body = (await request.json()) as Body;
    const action = text(body, "action");

    switch (action) {
      case "create-order": {
        const title = text(body, "title");
        const manager = text(body, "manager");
        const signedDate = text(body, "signedDate");
        const shippingDate = text(body, "shippingDate");
        if (shippingDate < signedDate) fail("Дата отгрузки не может быть раньше подписания");
        await db.insert(orders).values({
          title,
          manager,
          signedDate,
          shippingDate,
          nomenclature: text(body, "nomenclature", false) || null,
          sketchVariant: Math.floor(Math.random() * 4),
          stage: "request",
        });
        message = `Заявка «${title}» создана`;
        break;
      }

      case "update-order": {
        const orderId = id(body, "orderId");
        await getOrder(orderId);
        const updates: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
        if (typeof body.nomenclature === "string") {
          updates.nomenclature = body.nomenclature.trim() || null;
        }
        if (typeof body.developer === "string") {
          const developer = body.developer.trim();
          if (developer && !DESIGNERS.includes(developer as (typeof DESIGNERS)[number])) {
            fail("Выберите конструктора из списка");
          }
          updates.developer = developer || null;
        }
        if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
        if (typeof body.manager === "string" && body.manager.trim()) updates.manager = body.manager.trim();
        if (typeof body.signedDate === "string" && body.signedDate) updates.signedDate = body.signedDate;
        if (typeof body.shippingDate === "string" && body.shippingDate) updates.shippingDate = body.shippingDate;
        if (updates.signedDate && updates.shippingDate && updates.shippingDate < updates.signedDate) {
          fail("Проверьте даты заявки");
        }
        await db.update(orders).set(updates).where(eq(orders.id, orderId));
        message = "Параметры заявки обновлены";
        break;
      }

      case "delete-order": {
        const orderId = id(body, "orderId");
        const order = await getOrder(orderId);
        const releasedJobs = await db
          .select({ id: cuttingJobs.id })
          .from(cuttingJobs)
          .where(and(eq(cuttingJobs.orderId, orderId), inArray(cuttingJobs.status, ["queued", "cutting", "cut"])))
          .limit(1);
        if (releasedJobs.length) {
          fail("Заявка уже имеет документы в производстве. Удаление заблокировано для сохранения прослеживаемости");
        }
        await db.delete(orders).where(eq(orders.id, orderId));
        message = `Заявка «${order.title}» удалена вместе со связанными документами`;
        break;
      }

      case "transfer-order": {
        const orderId = id(body, "orderId");
        const order = await getOrder(orderId);
        if (order.stage !== "request") fail("Заявка уже передана в разработку");
        await db
          .update(orders)
          .set({ stage: "design", updatedAt: new Date() })
          .where(eq(orders.id, orderId));
        message = `«${order.title}» передана в конструкторский отдел`;
        extra = { transferredOrderId: orderId };
        break;
      }

      case "return-order": {
        const orderId = id(body, "orderId");
        const order = await getOrder(orderId);
        const existing = await db
          .select({ id: components.id })
          .from(components)
          .where(eq(components.orderId, orderId))
          .limit(1);
        if (existing.length) fail("Нельзя вернуть заявку: по ней уже созданы компоненты");
        await db
          .update(orders)
          .set({ stage: "request", developer: null, updatedAt: new Date() })
          .where(eq(orders.id, orderId));
        message = `«${order.title}» возвращена в заявки`;
        break;
      }

      case "create-component": {
        const orderId = id(body, "orderId");
        const order = await getOrder(orderId);
        if (!order.developer) fail("Сначала назначьте разработчика заявки");
        const name = text(body, "name");
        const type = text(body, "type");
        if (!COMPONENT_TYPES.includes(type as (typeof COMPONENT_TYPES)[number])) {
          fail("Выберите тип компонента из списка");
        }
        const duplicate = await db
          .select({ id: components.id })
          .from(components)
          .where(and(eq(components.orderId, orderId), eq(components.name, name)))
          .limit(1);
        if (duplicate.length) fail("Компонент с такой номенклатурой уже есть в заявке");
        await db.insert(components).values({
          orderId,
          name,
          type,
          modelAuthor: order.developer,
          stage: "model",
        });
        message = `${name} добавлен в 3D-модели`;
        break;
      }

      case "delete-component": {
        const componentId = id(body, "componentId");
        const component = await getComponent(componentId);
        const releasedLink = await db
          .select({ id: cuttingJobPanels.id })
          .from(cuttingJobPanels)
          .innerJoin(cuttingJobs, eq(cuttingJobs.id, cuttingJobPanels.jobId))
          .where(and(
            eq(cuttingJobPanels.componentId, componentId),
            inArray(cuttingJobs.status, ["queued", "cutting", "cut"]),
          ))
          .limit(1);
        if (releasedLink.length) {
          fail("Компонент уже передан в производство и не может быть удалён из журнала прослеживаемости");
        }
        await db.delete(components).where(eq(components.id, componentId));
        message = `${component.name} удалён`;
        break;
      }

      case "start-kd": {
        const componentId = id(body, "componentId");
        const component = await getComponent(componentId);
        if (component.stage !== "model") fail("КД по этому компоненту уже разрабатывается");
        await db
          .update(components)
          .set({ stage: "kd", kdStatus: "in_progress", kdStartedAt: new Date() })
          .where(eq(components.id, componentId));
        message = `${component.name}: разработка КД начата, статус «В работе»`;
        break;
      }

      case "assign-kd-author": {
        const componentId = id(body, "componentId");
        const author = text(body, "author");
        if (!DESIGNERS.includes(author as (typeof DESIGNERS)[number])) fail("Выберите конструктора из списка");
        await getComponent(componentId);
        await db.update(components).set({ kdAuthor: author }).where(eq(components.id, componentId));
        message = `Автор КД: ${author}`;
        break;
      }

      case "set-kd-status": {
        const componentId = id(body, "componentId");
        const status = text(body, "status");
        if (status !== "done" && status !== "in_progress") fail("Неизвестный статус КД");
        const component = await getComponent(componentId);
        if (component.stage !== "kd") fail("Сначала начните разработку КД");
        if (status === "done" && !component.kdAuthor) fail("Назначьте автора КД перед завершением");
        if (status === "in_progress") {
          const linked = await db
            .select({ id: cuttingJobPanels.id })
            .from(cuttingJobPanels)
            .where(eq(cuttingJobPanels.componentId, componentId))
            .limit(1);
          if (linked.length) fail("Панель уже включена в раскрой. Сначала удалите её из задания");
        }
        const barcode = status === "done" ? component.barcode ?? makeBarcode("KD", component.id) : component.barcode;
        await db
          .update(components)
          .set({
            kdStatus: status,
            barcode,
            kdCompletedAt: status === "done" ? component.kdCompletedAt ?? new Date() : null,
          })
          .where(eq(components.id, componentId));
        message = status === "done"
          ? `КД готово. Личный штрих-код ${barcode} сформирован`
          : "Статус КД изменён на «В работе»";
        extra = status === "done" ? { barcode, barcodeComponentId: componentId } : {};
        break;
      }

      case "create-cutting-job": {
        const orderId = id(body, "orderId");
        await getOrder(orderId);
        const name = text(body, "name");
        const [job] = await db
          .insert(cuttingJobs)
          .values({ orderId, name, barcode: `PENDING-${randomUUID()}`, status: "draft" })
          .returning({ id: cuttingJobs.id });
        const barcode = makeBarcode("CUT", job.id);
        await db.update(cuttingJobs).set({ barcode }).where(eq(cuttingJobs.id, job.id));
        message = `Задание создано. Штрих-код ${barcode} сформирован`;
        extra = { barcode, barcodeJobId: job.id };
        break;
      }

      case "assign-job-author": {
        const jobId = id(body, "jobId");
        const author = text(body, "author");
        if (!DESIGNERS.includes(author as (typeof DESIGNERS)[number])) fail("Выберите автора из списка");
        await getJob(jobId);
        await db.update(cuttingJobs).set({ author }).where(eq(cuttingJobs.id, jobId));
        message = `Автор задания: ${author}`;
        break;
      }

      case "add-job-panel": {
        const jobId = id(body, "jobId");
        const componentId = id(body, "componentId");
        const job = await getJob(jobId);
        const component = await getComponent(componentId);
        if (job.status !== "draft") fail("Состав переданного задания изменять нельзя");
        if (component.orderId !== job.orderId) fail("Панель принадлежит другой заявке");
        if (component.type !== "Панель") fail("В задание на раскрой добавляются только панели");
        if (component.kdStatus !== "done") fail("КД панели ещё не готово");
        const existing = await db
          .select({ id: cuttingJobPanels.id })
          .from(cuttingJobPanels)
          .where(eq(cuttingJobPanels.componentId, componentId))
          .limit(1);
        if (existing.length) fail("Панель уже включена в другое задание");
        await db.insert(cuttingJobPanels).values({ jobId, componentId });
        message = `${component.name} добавлена в ${job.name}`;
        break;
      }

      case "remove-job-panel": {
        const jobId = id(body, "jobId");
        const componentId = id(body, "componentId");
        const job = await getJob(jobId);
        if (job.status !== "draft") fail("Состав переданного задания изменять нельзя");
        await db
          .delete(cuttingJobPanels)
          .where(and(eq(cuttingJobPanels.jobId, jobId), eq(cuttingJobPanels.componentId, componentId)));
        await db
          .update(components)
          .set({ productionStatus: "not_released" })
          .where(eq(components.id, componentId));
        message = "Панель исключена из задания";
        break;
      }

      case "transfer-job": {
        const jobId = id(body, "jobId");
        const job = await getJob(jobId);
        if (job.status !== "draft") fail("Задание уже передано в производство");
        if (!job.author) fail("Назначьте автора задания перед передачей");
        const panels = await db
          .select({ componentId: cuttingJobPanels.componentId })
          .from(cuttingJobPanels)
          .where(eq(cuttingJobPanels.jobId, jobId));
        if (!panels.length) fail("Добавьте хотя бы одну панель с готовым КД");
        await db
          .update(cuttingJobs)
          .set({ status: "queued", transferredAt: new Date() })
          .where(eq(cuttingJobs.id, jobId));
        await db
          .update(components)
          .set({ productionStatus: "queued" })
          .where(inArray(components.id, panels.map((panel) => panel.componentId)));
        message = `${job.name} передан в производство`;
        break;
      }

      case "delete-cutting-job": {
        const jobId = id(body, "jobId");
        const job = await getJob(jobId);
        if (job.status !== "draft") fail("Переданное в производство задание удалить нельзя");
        const panels = await db
          .select({ componentId: cuttingJobPanels.componentId })
          .from(cuttingJobPanels)
          .where(eq(cuttingJobPanels.jobId, jobId));
        if (panels.length) {
          await db
            .update(components)
            .set({ productionStatus: "not_released" })
            .where(inArray(components.id, panels.map((panel) => panel.componentId)));
        }
        await db.delete(cuttingJobs).where(eq(cuttingJobs.id, jobId));
        message = `${job.name} удалён`;
        break;
      }

      case "create-box": {
        const orderId = id(body, "orderId");
        await getOrder(orderId);
        const name = text(body, "name");
        const [box] = await db
          .insert(shippingBoxes)
          .values({ orderId, name, note: text(body, "note", false) || null, barcode: `PENDING-${randomUUID()}` })
          .returning({ id: shippingBoxes.id });
        const barcode = makeBarcode("BOX", box.id);
        await db.update(shippingBoxes).set({ barcode }).where(eq(shippingBoxes.id, box.id));
        message = `${name} создан. Наклейка ${barcode} сформирована`;
        extra = { barcode, barcodeBoxId: box.id };
        break;
      }

      case "set-box-status": {
        const boxId = id(body, "boxId");
        const status = text(body, "status");
        if (!["packing", "ready", "shipped"].includes(status)) fail("Неизвестный статус ящика");
        await getBox(boxId);
        const items = await db.select({ id: shippingBoxItems.id }).from(shippingBoxItems).where(eq(shippingBoxItems.boxId, boxId)).limit(1);
        if ((status === "ready" || status === "shipped") && !items.length) fail("Нельзя закрыть или отгрузить пустой ящик");
        await db.update(shippingBoxes).set({
          status,
          closedAt: status === "packing" ? null : new Date(),
          shippedAt: status === "shipped" ? new Date() : null,
        }).where(eq(shippingBoxes.id, boxId));
        message = status === "packing" ? "Комплектация ящика возобновлена" : status === "ready" ? "Ящик укомплектован и готов к отгрузке" : "Ящик отмечен как отгруженный";
        break;
      }

      case "delete-box": {
        const boxId = id(body, "boxId");
        const box = await getBox(boxId);
        if (box.status === "shipped") fail("Отгруженный ящик удалить нельзя: он нужен для прослеживаемости");
        await db.delete(shippingBoxes).where(eq(shippingBoxes.id, boxId));
        message = `${box.name} удалён`;
        break;
      }

      case "decrement-box-item": {
        const boxId = id(body, "boxId");
        const componentId = id(body, "componentId");
        const box = await getBox(boxId);
        if (box.status !== "packing") fail("Количество можно изменять только во время комплектации");
        const [item] = await db.select().from(shippingBoxItems).where(and(eq(shippingBoxItems.boxId, boxId), eq(shippingBoxItems.componentId, componentId))).limit(1);
        if (!item) fail("Этого изделия нет в ящике");
        if (item.quantity > 1) {
          await db.update(shippingBoxItems).set({ quantity: item.quantity - 1 }).where(eq(shippingBoxItems.id, item.id));
        } else {
          await db.delete(shippingBoxItems).where(eq(shippingBoxItems.id, item.id));
        }
        message = "Количество в ящике уменьшено на 1";
        break;
      }

      case "shipping-scan": {
        const code = text(body, "code").toUpperCase();
        const employeeCode = text(body, "employeeCode", false).toUpperCase();
        if (code.startsWith("EMP-")) {
          const [employee] = await db.select().from(employees).where(and(eq(employees.barcode, code), eq(employees.active, true))).limit(1);
          if (!employee) fail("Бейдж сотрудника не распознан");
          if (employee.department !== "Отгрузка") fail(`${employee.name} не относится к участку отгрузки`);
          message = `${employee.name} авторизован для комплектации`;
          extra = { scanKind: "employee", employee };
          break;
        }
        if (!employeeCode) fail("Сначала отсканируйте бейдж комплектовщика");
        const [employee] = await db.select().from(employees).where(and(eq(employees.barcode, employeeCode), eq(employees.active, true))).limit(1);
        if (!employee || employee.department !== "Отгрузка") fail("Отсканируйте действующий бейдж сотрудника отгрузки");

        let entityType: "component" | "shipping_box" | null = null;
        let entityId: number | null = null;
        const record = async (success: boolean, textMessage: string) => {
          await db.insert(scanEvents).values({
            employeeName: employee.name,
            employeeCode,
            documentCode: code,
            entityType,
            entityId,
            station: "shipping",
            message: textMessage,
            success,
          });
        };
        const reject = async (textMessage: string): Promise<never> => {
          await record(false, textMessage);
          return fail(textMessage);
        };

        const [box] = await db.select().from(shippingBoxes).where(eq(shippingBoxes.barcode, code)).limit(1);
        if (box) {
          entityType = "shipping_box";
          entityId = box.id;
          if (box.status === "ready" || box.status === "shipped") await reject("Ящик закрыт. Сначала возобновите комплектацию в разделе «Отгрузка»");
          if (box.status === "created") {
            await db.update(shippingBoxes).set({ status: "packing" }).where(eq(shippingBoxes.id, box.id));
          }
          message = `${box.name}: комплектация начата. Теперь сканируйте CS-наклейки готовых изделий`;
          await record(true, message);
          extra = { scanKind: "box", shippingBoxId: box.id, entityName: box.name };
          break;
        }

        const activeBoxId = id(body, "boxId");
        const activeBox = await getBox(activeBoxId);
        if (activeBox.status !== "packing") await reject("Сначала отсканируйте BOX-наклейку открытого ящика");
        const [component] = await db.select().from(components).where(eq(components.productBarcode, code)).limit(1);
        if (!component) await reject("Это не товарная CS-наклейка. Для упаковки используйте код, созданный после ОТК");
        entityType = "component";
        entityId = component.id;
        if (component.productionStatus !== "ready") await reject("Изделие ещё не принято ОТК и не может быть упаковано");
        if (component.orderId !== activeBox.orderId) await reject("Изделие принадлежит другой заявке и не может быть добавлено в этот ящик");

        await db.insert(shippingBoxItems).values({ boxId: activeBox.id, componentId: component.id, quantity: 1 }).onConflictDoUpdate({
          target: [shippingBoxItems.boxId, shippingBoxItems.componentId],
          set: { quantity: sql`${shippingBoxItems.quantity} + 1`, lastScannedAt: new Date() },
        });
        const [item] = await db.select().from(shippingBoxItems).where(and(eq(shippingBoxItems.boxId, activeBox.id), eq(shippingBoxItems.componentId, component.id))).limit(1);
        message = `${activeBox.name}: ${component.name} · количество ${item.quantity} шт.`;
        await record(true, message);
        extra = { scanKind: "item", shippingBoxId: activeBox.id, entityName: component.name, quantity: item.quantity };
        break;
      }

      case "scan": {
        const code = text(body, "code").toUpperCase();
        const requestedStation = text(body, "station", false) || "auto";
        if (requestedStation !== "auto" && !STATIONS.some((item) => item.id === requestedStation)) {
          fail("Неизвестный производственный участок");
        }
        let station: Station | null = requestedStation === "auto" ? null : requestedStation as Station;
        const employeeCode = text(body, "employeeCode", false).toUpperCase();

        if (code.startsWith("EMP-")) {
          const [employee] = await db
            .select()
            .from(employees)
            .where(and(eq(employees.barcode, code), eq(employees.active, true)))
            .limit(1);
          if (!employee) fail("Бейдж сотрудника не распознан");
          message = `${employee.name} авторизован · ${employee.role} · допуск: ${employee.department}`;
          extra = { scanKind: "employee", employee };
          break;
        }

        if (!employeeCode) fail("Сначала отсканируйте личный штрих-код сотрудника");
        const [employee] = await db
          .select()
          .from(employees)
          .where(and(eq(employees.barcode, employeeCode), eq(employees.active, true)))
          .limit(1);
        if (!employee) fail("Смена сотрудника не подтверждена. Отсканируйте бейдж повторно");

        let entityType: "component" | "cutting_job" | null = null;
        let entityId: number | null = null;
        const record = async (success: boolean, textMessage: string) => {
          await db.insert(scanEvents).values({
            employeeName: employee.name,
            employeeCode,
            documentCode: code,
            entityType,
            entityId,
            station,
            message: textMessage,
            success,
          });
        };
        const reject = async (textMessage: string): Promise<never> => {
          await record(false, textMessage);
          return fail(textMessage);
        };
        const verifyDepartment = async (actualStation: Station) => {
          const stationInfo = STATIONS.find((item) => item.id === actualStation);
          if (!stationInfo) return;
          if (employee.department !== stationInfo.label) {
            await reject(
              `${employee.name} относится к участку «${employee.department}». Следующая операция — «${stationInfo.label}»: отсканируйте бейдж сотрудника этого участка`,
            );
          }
        };

        const [component] = await db.select().from(components).where(eq(components.barcode, code)).limit(1);
        const [job] = component
          ? []
          : await db.select().from(cuttingJobs).where(eq(cuttingJobs.barcode, code)).limit(1);

        if (component) {
          entityType = "component";
          entityId = component.id;
          if (component.kdStatus !== "done") await reject("КД ещё не готово");

          const required: Partial<Record<Station, {
            before: ComponentData["productionStatus"];
            after: ComponentData["productionStatus"];
            label: string;
          }>> = {
            bend: { before: "cut", after: "bent", label: "Гибка" },
            weld: { before: "bent", after: "welded", label: "Сварка" },
            paint: { before: "welded", after: "painted", label: "Покраска" },
            assembly: { before: "painted", after: "assembled", label: "Сборка" },
            qc: { before: "assembled", after: "ready", label: "Приёмка ОТК" },
          };

          if (requestedStation === "auto") {
            const nextByStatus: Partial<Record<ComponentData["productionStatus"], Station>> = {
              cut: "bend",
              bent: "weld",
              welded: "paint",
              painted: "assembly",
              assembled: "qc",
            };
            const nextStation = nextByStatus[component.productionStatus as ComponentData["productionStatus"]];
            if (!nextStation) {
              if (component.productionStatus === "ready") {
                await reject(`${component.name}: все операции завершены, панель уже принята ОТК`);
              }
              await reject("Сначала запустите и завершите раскрой, дважды отсканировав CUT-код задания бейджем резчика");
            }
            station = nextStation as Station;
          } else if (station === "cut") {
            await reject("Для раскроя сканируйте CUT-код задания, а не KD-код панели");
          }

          const operation = station ? required[station] : undefined;
          if (!station || !operation) await reject("Для текущего статуса панели нет доступной операции");
          const actualStation = station as Station;
          const actualOperation = operation as NonNullable<typeof operation>;
          await verifyDepartment(actualStation);

          if (component.productionStatus !== actualOperation.before) {
            await reject(
              component.productionStatus === actualOperation.after
                ? `${actualOperation.label} уже зарегистрирована для ${component.name}`
                : `Операция недоступна: текущий статус «${PRODUCTION_LABELS[component.productionStatus as ComponentData["productionStatus"]]}», требуется «${PRODUCTION_LABELS[actualOperation.before]}»`,
            );
          }
          await db
            .update(components)
            .set({ productionStatus: actualOperation.after })
            .where(eq(components.id, component.id));
          message = `${actualOperation.label}: ${component.name} · операция определена и зарегистрирована автоматически`;
          let productBarcode: string | undefined;
          if (actualOperation.after === "ready") {
            productBarcode = await ensureProductBarcode(component.id);
            message += `. ОТК пройдено, товарная наклейка ${productBarcode} сформирована`;
          }
          await record(true, message);
          extra = {
            scanKind: "document",
            entityName: component.name,
            station,
            ...(productBarcode ? { productBarcode, productBarcodeComponentId: component.id } : {}),
          };
          break;
        }

        if (job) {
          entityType = "cutting_job";
          entityId = job.id;
          if (requestedStation !== "auto" && station !== "cut") {
            await reject("CUT-код предназначен только для операции раскроя");
          }
          station = "cut";
          await verifyDepartment("cut");
          if (job.status === "draft") await reject("Задание ещё не передано в производство");
          if (job.status === "cut") await reject("Раскрой по этому заданию уже завершён. Дальше сканируйте KD-код панели");
          const panels = await db
            .select({ componentId: cuttingJobPanels.componentId })
            .from(cuttingJobPanels)
            .where(eq(cuttingJobPanels.jobId, job.id));
          if (!panels.length) await reject("В задании нет панелей");
          const nextStatus = job.status === "queued" ? "cutting" : "cut";
          await db
            .update(cuttingJobs)
            .set({ status: nextStatus, completedAt: nextStatus === "cut" ? new Date() : null })
            .where(eq(cuttingJobs.id, job.id));
          await db
            .update(components)
            .set({ productionStatus: nextStatus === "cut" ? "cut" : "cutting" })
            .where(inArray(components.id, panels.map((panel) => panel.componentId)));
          message = nextStatus === "cutting"
            ? `${job.name}: задание принято в работу. Повторное сканирование CUT завершит раскрой`
            : `${job.name}: раскрой завершён. Дальше сканируйте KD панели бейджем гибщика`;
          await record(true, message);
          extra = { scanKind: "document", entityName: job.name, station };
          break;
        }

        await record(false, "Код не найден в реестре КД и заданий на раскрой");
        fail("Код не найден. Проверьте этикетку или введите код вручную");
      }

      default:
        fail("Неизвестная команда", 404);
    }

    const data = await getWorkspace();
    return NextResponse.json({ ok: true, message, data, ...extra });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Не удалось выполнить операцию";
    const status = error instanceof ActionError ? error.status : 500;
    const data = await getWorkspace().catch(() => undefined);
    return NextResponse.json({ ok: false, error: errorMessage, data, ...extra }, { status });
  }
}
