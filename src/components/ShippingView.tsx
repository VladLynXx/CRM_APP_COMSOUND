"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Barcode,
  Camera,
  Check,
  ChevronRight,
  CircleAlert,
  Minus,
  Package,
  PackageOpen,
  Plus,
  ScanLine,
  Trash2,
  Truck,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { CameraScanner } from "@/components/CameraScanner";
import type { BarcodeTarget, Mutate, Notify } from "@/components/types";
import { ConfirmDialog, EmptyState, Field, Modal } from "@/components/ui";
import {
  BOX_STATUS_LABELS,
  formatDateTime,
  type ComponentData,
  type EmployeeData,
  type OrderData,
  type ScanEventData,
  type ShippingBoxData,
  type ShippingBoxItemData,
} from "@/lib/domain";

function BoxForm({
  orders,
  boxes,
  mutate,
  onClose,
  onCreated,
}: {
  orders: OrderData[];
  boxes: ShippingBoxData[];
  mutate: Mutate;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [orderId, setOrderId] = useState(orders[0]?.id ?? 0);
  const [name, setName] = useState(`Ящик №${boxes.length + 1}`);
  const [note, setNote] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await mutate("create-box", { orderId, name, note });
    if (result?.ok) {
      if (result.barcodeBoxId) onCreated(result.barcodeBoxId);
      onClose();
    }
  };
  return <form onSubmit={submit}>
    <div className="form-grid">
      <Field label="Заявка"><select value={orderId} onChange={(event) => setOrderId(Number(event.target.value))}>{orders.map((order) => <option key={order.id} value={order.id}>{order.title} · {order.nomenclature ?? "без номенклатуры"}</option>)}</select></Field>
      <Field label="Название ящика"><input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></Field>
      <Field label="Примечание / место отгрузки"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например, ворота №2, машина 123" /></Field>
    </div>
    <div className="form-note"><Barcode size={15} />Персональная BOX-наклейка будет сформирована сразу после создания.</div>
    <div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>Отмена</button><button className="button button-gold">Создать ящик</button></div>
  </form>;
}

export function ShippingView({
  orders,
  components,
  boxes,
  boxItems,
  employees,
  scanEvents,
  mutate,
  notify,
  onBarcode,
}: {
  orders: OrderData[];
  components: ComponentData[];
  boxes: ShippingBoxData[];
  boxItems: ShippingBoxItemData[];
  employees: EmployeeData[];
  scanEvents: ScanEventData[];
  mutate: Mutate;
  notify: Notify;
  onBarcode: (target: BarcodeTarget) => void;
}) {
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(boxes[0]?.id ?? null);
  const [activeBoxId, setActiveBoxId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteBox, setDeleteBox] = useState<ShippingBoxData | null>(null);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const employeeCode = window.localStorage.getItem("comsound.shippingEmployee");
    const boxId = Number(window.localStorage.getItem("comsound.activeBox"));
    if (employeeCode) setEmployee(employees.find((item) => item.barcode === employeeCode && item.department === "Отгрузка") ?? null);
    if (boxId) setActiveBoxId(boxId);
  }, [employees]);

  const selectedBox = boxes.find((box) => box.id === selectedBoxId) ?? boxes[0] ?? null;
  const activeBox = boxes.find((box) => box.id === activeBoxId && box.status === "packing") ?? null;
  const selectedItems = selectedBox ? boxItems.filter((item) => item.boxId === selectedBox.id) : [];
  const totalItems = boxItems.reduce((sum, item) => sum + item.quantity, 0);
  const readyComponents = components.filter((component) => component.productionStatus === "ready" && component.productBarcode);
  const packingEmployee = employees.find((item) => item.department === "Отгрузка");
  const shippingEvents = scanEvents.filter((event) => event.station === "shipping").slice(0, 7);

  const performScan = async (scanCode: string) => {
    if (!scanCode.trim() || busy) return;
    setBusy(true);
    const result = await mutate("shipping-scan", {
      code: scanCode,
      employeeCode: employee?.barcode ?? "",
      boxId: activeBox?.id ?? 0,
    }, { silent: true });
    setBusy(false);
    setCode("");
    if (!result) return;
    const message = result.message ?? result.error ?? "Операция не выполнена";
    setLastResult({ success: result.ok, message });
    if (result.ok && result.scanKind === "employee" && result.employee) {
      setEmployee(result.employee);
      window.localStorage.setItem("comsound.shippingEmployee", result.employee.barcode);
      notify(message);
    } else if (result.ok && result.shippingBoxId) {
      setSelectedBoxId(result.shippingBoxId);
      if (result.scanKind === "box") {
        setActiveBoxId(result.shippingBoxId);
        window.localStorage.setItem("comsound.activeBox", String(result.shippingBoxId));
      }
      notify(message);
    } else if (!result.ok) {
      notify(message, "error");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void performScan(code);
  };

  const changeStatus = async (box: ShippingBoxData, status: "packing" | "ready" | "shipped") => {
    const result = await mutate("set-box-status", { boxId: box.id, status });
    if (result?.ok && status !== "packing" && activeBoxId === box.id) {
      setActiveBoxId(null);
      window.localStorage.removeItem("comsound.activeBox");
    }
  };

  return <div className="shipping-view view-enter">
    <div className="section-intro">
      <div><span className="eyebrow">04 / Готовая продукция</span><h1>Отгрузка</h1><p>Комплектация ящиков по товарным CS-наклейкам, выданным после ОТК.</p></div>
      <div className="intro-stats production-stats">
        <div><strong>{boxes.length.toString().padStart(2, "0")}</strong><span>ящиков создано</span></div>
        <div><strong>{boxes.filter((box) => box.status === "packing").length.toString().padStart(2, "0")}</strong><span>комплектуется</span></div>
        <div><strong>{totalItems.toString().padStart(2, "0")}</strong><span>элементов упаковано</span></div>
        <button className="button button-gold" onClick={() => orders.length ? setCreateOpen(true) : notify("Сначала создайте заявку", "info")}><Plus size={16} />Создать ящик</button>
      </div>
    </div>

    <div className="shipping-layout">
      <section className="shipping-boxes-panel">
        <div className="console-head"><div><Package size={18} /><h2>Ящики</h2></div><span>{boxes.length} док.</span></div>
        <div className="shipping-box-list">
          <AnimatePresence mode="popLayout">
            {boxes.map((box) => {
              const items = boxItems.filter((item) => item.boxId === box.id);
              const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
              const order = orders.find((item) => item.id === box.orderId);
              return <motion.article layout key={box.id} className={`shipping-box-card box-${box.status} ${selectedBox?.id === box.id ? "is-selected" : ""}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -35 }}>
                <button className="box-card-main" onClick={() => setSelectedBoxId(box.id)}>
                  <span className="box-order">{order?.title} · BOX-{String(box.id).padStart(3, "0")}</span>
                  <strong>{box.name}</strong>
                  <span className="box-card-meta"><i>{BOX_STATUS_LABELS[box.status]}</i><b>{quantity} шт.</b><small>{items.length} номенкл.</small></span>
                </button>
                <div className="box-card-actions">
                  <button onClick={() => onBarcode({ code: box.barcode, title: box.name, subtitle: `${order?.title ?? ""} · наклейка ящика`, kind: "BOX" })}><Barcode size={14} />Наклейка</button>
                  {box.status === "created" || box.status === "packing" ? <button onClick={() => { setCode(box.barcode); setSelectedBoxId(box.id); }}><ScanLine size={14} />Код в сканер</button> : null}
                  {box.status === "packing" ? <button onClick={() => void changeStatus(box, "ready")}><Check size={14} />Завершить</button> : null}
                  {box.status === "ready" ? <><button onClick={() => void changeStatus(box, "packing")}><PackageOpen size={14} />Возобновить</button><button onClick={() => void changeStatus(box, "shipped")}><Truck size={14} />Отгрузить</button></> : null}
                  {box.status !== "shipped" ? <button className="box-delete" onClick={() => setDeleteBox(box)} aria-label={`Удалить ${box.name}`}><Trash2 size={14} /></button> : null}
                </div>
              </motion.article>;
            })}
          </AnimatePresence>
          {!boxes.length ? <EmptyState title="Ящиков пока нет" copy="Создайте ящик и распечатайте его BOX-наклейку. Сканирование наклейки переведёт статус в «Комплектуется»." /> : null}
        </div>
      </section>

      <section className="shipping-scanner scanner-console">
        <div className="console-head"><div><ScanLine size={18} /><h2>Сканер комплектации</h2></div><span className="live-indicator"><i />AUTO / BOX / CS</span></div>
        <div className="shipping-scan-route"><span className={employee ? "done" : "active"}>1 · Бейдж</span><i /><span className={activeBox ? "done" : employee ? "active" : ""}>2 · Ящик BOX</span><i /><span className={activeBox ? "active" : ""}>3 · Изделия CS</span></div>
        <div className={`employee-session ${employee ? "has-employee" : ""}`}>
          {employee ? <><div className="employee-avatar"><UserCheck size={22} /></div><div><span>Комплектовщик подтверждён</span><strong>{employee.name}</strong><small>{employee.role}</small></div><button onClick={() => { setEmployee(null); window.localStorage.removeItem("comsound.shippingEmployee"); }}><X size={14} />Сменить</button></> : <><div className="employee-avatar"><Barcode size={22} /></div><div><span>Шаг 1</span><strong>Отсканируйте бейдж отгрузки</strong><small>{packingEmployee ? `${packingEmployee.name} · ${packingEmployee.barcode}` : "Сотрудник отгрузки"}</small></div>{packingEmployee ? <button onClick={() => onBarcode({ code: packingEmployee.barcode, title: packingEmployee.name, subtitle: "Личный бейдж комплектовщика", kind: "EMP" })}><Barcode size={14} />Бейдж</button> : null}</>}
        </div>
        <div className={`active-packing-box ${activeBox ? "has-box" : ""}`}>
          <PackageOpen size={21} />
          <div><span>Ящик в сканере</span><strong>{activeBox ? activeBox.name : "Сначала отсканируйте BOX-наклейку"}</strong><small>{activeBox ? "Каждый следующий CS-код увеличит количество изделий" : "Просто выбрать карточку ящика недостаточно"}</small></div>
          {activeBox ? <button onClick={() => { setActiveBoxId(null); window.localStorage.removeItem("comsound.activeBox"); }}><X size={14} /></button> : null}
        </div>
        <form className={`scan-input-wrap ${busy ? "is-busy" : ""}`} onSubmit={submit}>
          <div className="scan-input-label"><span>{!employee ? "ШАГ 1 · EMP" : !activeBox ? "ШАГ 2 · BOX" : "ШАГ 3 · CS · КОЛИЧЕСТВО +1"}</span><span>ENTER ↵</span></div>
          <div className="scan-input-line"><ScanLine size={25} /><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder={!employee ? "EMP-0008-COM" : !activeBox ? "BOX-000000-XXXX" : "CS-195.01.00"} autoComplete="off" spellCheck={false} autoFocus /><button disabled={busy || !code.trim()}>{busy ? "Проверка…" : "Принять"}<ChevronRight size={16} /></button></div>
        </form>
        <button className="camera-launch" onClick={() => setCameraOpen(true)} disabled={busy}><Camera size={18} /><span>Сканировать камерой<small>BOX ящика или CS готового изделия</small></span><ChevronRight size={16} /></button>
        <AnimatePresence mode="wait">{lastResult ? <motion.div key={`${lastResult.message}-${totalItems}`} className={`scan-result ${lastResult.success ? "success" : "error"}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><Package size={20} /><div><span>{lastResult.success ? "Комплектация обновлена" : "Сканирование отклонено"}</span><strong>{lastResult.message}</strong></div></motion.div> : <div className="scan-result neutral"><CircleAlert size={20} /><div><span>Повторные коды не блокируются</span><strong>Каждое сканирование одной CS-наклейки добавляет ещё одну единицу этой номенклатуры.</strong></div></div>}</AnimatePresence>
      </section>

      <section className="box-contents-panel">
        <div className="console-head"><div><PackageOpen size={18} /><h2>Состав {selectedBox ? `· ${selectedBox.name}` : "ящика"}</h2></div><span>{selectedItems.reduce((sum, item) => sum + item.quantity, 0)} шт.</span></div>
        {selectedBox ? <>
          <div className="box-contents-summary"><span>{BOX_STATUS_LABELS[selectedBox.status]}</span><strong>{orders.find((order) => order.id === selectedBox.orderId)?.title}</strong><small>{selectedBox.note || "Без примечания"}</small></div>
          <div className="box-content-rows">
            {selectedItems.map((item) => {
              const component = components.find((entry) => entry.id === item.componentId);
              if (!component) return null;
              return <div key={item.id}><div><strong>{component.name}</strong><button onClick={() => component.productBarcode && onBarcode({ code: component.productBarcode, title: component.name, subtitle: "Товарная наклейка после ОТК", kind: "ITEM" })}>{component.productBarcode}</button></div><span className="item-quantity">{item.quantity}<small>шт.</small></span>{selectedBox.status === "packing" ? <button className="decrement-item" onClick={() => void mutate("decrement-box-item", { boxId: selectedBox.id, componentId: component.id })} title="Уменьшить на 1"><Minus size={14} /></button> : null}</div>;
            })}
            {!selectedItems.length ? <EmptyState title="Ящик пуст" copy="Отсканируйте BOX-наклейку, затем CS-наклейку готового изделия. Повторное сканирование увеличит количество." /> : null}
          </div>
        </> : <EmptyState title="Выберите ящик" copy="Состав и количество появятся здесь." />}
      </section>
    </div>

    <section className="ready-products-panel">
      <div className="registry-head"><div><span className="eyebrow">После ОТК</span><h2>Готовые изделия и товарные наклейки</h2></div><span className="ready-products-count">{readyComponents.length} номенклатур</span></div>
      <div className="ready-products-grid">{readyComponents.map((component) => <article key={component.id}><div><span>{orders.find((order) => order.id === component.orderId)?.title}</span><h3>{component.name}</h3><p>Проверено ОТК · готово к упаковке</p></div><button className="barcode-link" onClick={() => onBarcode({ code: component.productBarcode!, title: component.name, subtitle: "Товарная наклейка готового изделия", kind: "ITEM" })}><Barcode size={15} />{component.productBarcode}</button></article>)}</div>
      {!readyComponents.length ? <EmptyState title="Готовых изделий пока нет" copy="После сканирования KD-кода контролёром ОТК здесь появится товарная CS-наклейка." /> : null}
    </section>

    {shippingEvents.length ? <section className="shipping-history"><div className="console-head"><div><Truck size={17} /><h2>Журнал отгрузки</h2></div><span>Live</span></div>{shippingEvents.map((event) => <div key={event.id}><span className={event.success ? "history-ok" : "history-fail"}>{event.success ? <Check size={12} /> : <X size={12} />}</span><strong>{event.message}</strong><small>{event.employeeName}</small><time>{formatDateTime(event.createdAt)}</time></div>)}</section> : null}

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новый ящик" eyebrow="Отгрузка · BOX"><BoxForm orders={orders} boxes={boxes} mutate={mutate} onClose={() => setCreateOpen(false)} onCreated={setSelectedBoxId} /></Modal>
    <ConfirmDialog target={deleteBox ? `Удалить «${deleteBox.name}»?` : null} onClose={() => setDeleteBox(null)} onConfirm={() => { if (deleteBox) void mutate("delete-box", { boxId: deleteBox.id }).then((result) => { if (result?.ok) { if (activeBoxId === deleteBox.id) setActiveBoxId(null); setDeleteBox(null); } }); }} description="Состав ящика и история его текущей комплектации будут удалены. Отгруженные ящики удалить нельзя." />
    <CameraScanner open={cameraOpen} expected={employee ? "shipping" : "employee"} onClose={() => setCameraOpen(false)} onDetected={(detected) => { setCameraOpen(false); setCode(detected); void performScan(detected); }} />
  </div>;
}
