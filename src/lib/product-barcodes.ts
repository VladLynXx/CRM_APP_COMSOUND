import { eq } from "drizzle-orm";
import { db } from "@/db";
import { components } from "@/db/schema";

export function productCodeBase(name: string, componentId: number) {
  const nomenclature = name.match(/\d+(?:\.\d+)+/)?.[0] ?? String(componentId).padStart(6, "0");
  return `CS-${nomenclature}`;
}

export async function ensureProductBarcode(componentId: number) {
  const [component] = await db.select().from(components).where(eq(components.id, componentId)).limit(1);
  if (!component) throw new Error("Компонент для товарной наклейки не найден");
  if (component.productBarcode) return component.productBarcode;

  const base = productCodeBase(component.name, component.id);
  const [duplicate] = await db
    .select({ id: components.id })
    .from(components)
    .where(eq(components.productBarcode, base))
    .limit(1);
  const code = duplicate && duplicate.id !== component.id ? `${base}-${component.id}` : base;

  await db.update(components).set({ productBarcode: code }).where(eq(components.id, component.id));
  return code;
}
