export const DESIGNERS = [
  "Марщиков А.",
  "Кузнецов Е.",
  "Акобян Г.",
  "Городнов А.",
  "Шваков В.",
] as const;

export const MANAGERS = [
  "Смирнова А.",
  "Котова М.",
  "Дмитриев И.",
  "Фролова Е.",
] as const;

export const COMPONENT_TYPES = [
  "Панель",
  "Кассета",
  "Связь",
  "Колонна",
  "Ригель",
  "Элемент каркаса",
  "Узел крепления",
] as const;

export const STATIONS = [
  { id: "cut", label: "Раскрой", short: "РЦ" },
  { id: "bend", label: "Гибка", short: "ГБ" },
  { id: "weld", label: "Сварка", short: "СВ" },
  { id: "paint", label: "Покраска", short: "ПК" },
  { id: "assembly", label: "Сборка", short: "СБ" },
  { id: "qc", label: "ОТК", short: "ОТК" },
] as const;

export type Station = (typeof STATIONS)[number]["id"];

export type OrderData = {
  id: number;
  title: string;
  nomenclature: string | null;
  signedDate: string;
  shippingDate: string;
  manager: string;
  developer: string | null;
  stage: "request" | "design";
  sketchVariant: number;
  createdAt: string;
  updatedAt: string;
};

export type ComponentData = {
  id: number;
  orderId: number;
  name: string;
  type: string;
  modelAuthor: string;
  stage: "model" | "kd";
  kdAuthor: string | null;
  kdStatus: "in_progress" | "done";
  productionStatus:
    | "not_released"
    | "queued"
    | "cutting"
    | "cut"
    | "bent"
    | "welded"
    | "painted"
    | "assembled"
    | "ready";
  barcode: string | null;
  productBarcode: string | null;
  kdStartedAt: string | null;
  kdCompletedAt: string | null;
  createdAt: string;
};

export type CuttingJobData = {
  id: number;
  orderId: number;
  name: string;
  author: string | null;
  status: "draft" | "queued" | "cutting" | "cut";
  barcode: string;
  createdAt: string;
  transferredAt: string | null;
  completedAt: string | null;
};

export type JobPanelData = {
  id: number;
  jobId: number;
  componentId: number;
  addedAt: string;
};

export type ShippingBoxData = {
  id: number;
  orderId: number;
  name: string;
  note: string | null;
  status: "created" | "packing" | "ready" | "shipped";
  barcode: string;
  createdAt: string;
  closedAt: string | null;
  shippedAt: string | null;
};

export type ShippingBoxItemData = {
  id: number;
  boxId: number;
  componentId: number;
  quantity: number;
  addedAt: string;
  lastScannedAt: string;
};

export type EmployeeData = {
  id: number;
  name: string;
  role: string;
  department: string;
  barcode: string;
  active: boolean;
};

export type ScanEventData = {
  id: number;
  employeeName: string;
  employeeCode: string;
  documentCode: string;
  entityType: "component" | "cutting_job" | "shipping_box" | null;
  entityId: number | null;
  station: Station | "shipping" | null;
  message: string;
  success: boolean;
  createdAt: string;
};

export type WorkspaceData = {
  orders: OrderData[];
  components: ComponentData[];
  cuttingJobs: CuttingJobData[];
  jobPanels: JobPanelData[];
  shippingBoxes: ShippingBoxData[];
  shippingBoxItems: ShippingBoxItemData[];
  employees: EmployeeData[];
  scanEvents: ScanEventData[];
};

export const PRODUCTION_LABELS: Record<ComponentData["productionStatus"], string> = {
  not_released: "Не передана",
  queued: "Ожидает раскроя",
  cutting: "На этапе раскроя",
  cut: "Ожидает гибки",
  bent: "На этапе гибки",
  welded: "На этапе сварки",
  painted: "На этапе покраски",
  assembled: "На этапе сборки",
  ready: "Проверено ОТК · готово",
};

export const JOB_STATUS_LABELS: Record<CuttingJobData["status"], string> = {
  draft: "Формируется",
  queued: "В очереди",
  cutting: "В работе",
  cut: "Раскрой завершён",
};

export const BOX_STATUS_LABELS: Record<ShippingBoxData["status"], string> = {
  created: "Создан",
  packing: "Комплектуется",
  ready: "Готов к отгрузке",
  shipped: "Отгружен",
};

export function makeBarcode(kind: "KD" | "CUT" | "BOX", id: number) {
  const source = `COMSOUND:${kind}:${id}:2026`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const check = (hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(-4);
  return `${kind}-${String(id).padStart(6, "0")}-${check}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}
