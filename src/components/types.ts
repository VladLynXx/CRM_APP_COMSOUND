import type { EmployeeData, WorkspaceData } from "@/lib/domain";

export type MutationResult = {
  ok: boolean;
  message?: string;
  error?: string;
  data?: WorkspaceData;
  barcode?: string;
  barcodeComponentId?: number;
  barcodeJobId?: number;
  barcodeBoxId?: number;
  productBarcode?: string;
  productBarcodeComponentId?: number;
  shippingBoxId?: number;
  quantity?: number;
  transferredOrderId?: number;
  scanKind?: "employee" | "document" | "box" | "item";
  employee?: EmployeeData;
  entityName?: string;
};

export type Mutate = (
  action: string,
  payload?: Record<string, unknown>,
  options?: { silent?: boolean },
) => Promise<MutationResult | undefined>;

export type Notify = (message: string, tone?: "success" | "error" | "info") => void;

export type BarcodeTarget = {
  code: string;
  title: string;
  subtitle: string;
  kind: "KD" | "CUT" | "EMP" | "BOX" | "ITEM";
};
