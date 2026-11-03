"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, FilePlus2, Pencil, Search, Send, UserRound } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { SketchPreview } from "@/components/SketchPreview";
import type { Mutate, Notify } from "@/components/types";
import { CardMenu, ConfirmDialog, EmptyState, Field, Modal } from "@/components/ui";
import { MANAGERS, formatDate, type OrderData } from "@/lib/domain";

function OrderForm({
  order,
  onClose,
  mutate,
}: {
  order: OrderData | null;
  onClose: () => void;
  mutate: Mutate;
}) {
  const [title, setTitle] = useState(order?.title ?? "");
  const [nomenclature, setNomenclature] = useState(order?.nomenclature ?? "");
  const [manager, setManager] = useState(order?.manager ?? MANAGERS[0]);
  const [signedDate, setSignedDate] = useState(order?.signedDate ?? "2026-02-20");
  const [shippingDate, setShippingDate] = useState(order?.shippingDate ?? "2026-06-20");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await mutate(order ? "update-order" : "create-order", {
      orderId: order?.id,
      title,
      nomenclature,
      manager,
      signedDate,
      shippingDate,
    });
    setBusy(false);
    if (result?.ok) onClose();
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Название объекта">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Русагро" required autoFocus />
        </Field>
        <Field label="Номенклатура заказа">
          <input value={nomenclature} onChange={(event) => setNomenclature(event.target.value)} placeholder="COMSOUND-000.00.00" />
        </Field>
        <Field label="Менеджер">
          <select value={manager} onChange={(event) => setManager(event.target.value)}>
            {MANAGERS.map((name) => <option key={name}>{name}</option>)}
          </select>
        </Field>
        <Field label="Дата подписания">
          <input type="date" value={signedDate} onChange={(event) => setSignedDate(event.target.value)} required />
        </Field>
        <Field label="Дата отгрузки">
          <input type="date" value={shippingDate} min={signedDate} onChange={(event) => setShippingDate(event.target.value)} required />
        </Field>
      </div>
      <div className="modal-actions">
        <button type="button" className="button button-ghost" onClick={onClose}>Отмена</button>
        <button className="button button-gold" disabled={busy}>{busy ? "Сохранение…" : order ? "Сохранить изменения" : "Создать заявку"}</button>
      </div>
    </form>
  );
}

export function RequestsView({
  orders,
  mutate,
  notify,
  onTransferred,
}: {
  orders: OrderData[];
  mutate: Mutate;
  notify: Notify;
  onTransferred: (orderId: number) => void;
}) {
  const requests = useMemo(() => orders.filter((order) => order.stage === "request"), [orders]);
  const [previewId, setPreviewId] = useState<number | null>(requests[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [manager, setManager] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<OrderData | null>(null);
  const [formOrder, setFormOrder] = useState<OrderData | "new" | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const visible = requests.filter((order) => {
    const haystack = `${order.title} ${order.nomenclature ?? ""} ${order.manager}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (manager === "all" || order.manager === manager);
  });
  const previewOrder = requests.find((order) => order.id === previewId) ?? requests[0] ?? null;
  const nearest = [...requests].sort((a, b) => a.shippingDate.localeCompare(b.shippingDate))[0];

  const remove = async () => {
    if (!deleteTarget) return;
    const result = await mutate("delete-order", { orderId: deleteTarget.id });
    if (result?.ok) setDeleteTarget(null);
  };

  return (
    <div className="requests-view view-enter">
      <div className="section-intro">
        <div>
          <span className="eyebrow">01 / Входящий контур</span>
          <h1>Заявки</h1>
          <p>Подписанные проекты до передачи в конструкторский отдел.</p>
        </div>
        <div className="intro-stats">
          <div><strong>{requests.length.toString().padStart(2, "0")}</strong><span>в работе у менеджеров</span></div>
          <div><strong>{nearest ? formatDate(nearest.shippingDate).slice(0, 5) : "—"}</strong><span>ближайшая отгрузка</span></div>
          <button className="button button-gold" onClick={() => setFormOrder("new")}><FilePlus2 size={16} />Новая заявка</button>
        </div>
      </div>

      <div className="request-workspace">
        <section className="request-list-panel">
          <div className="filter-row">
            <label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по заявке или номенклатуре" /></label>
            <select className="manager-filter" value={manager} onChange={(event) => setManager(event.target.value)} aria-label="Фильтр по менеджеру">
              <option value="all">Все менеджеры</option>
              {MANAGERS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          {visible.length ? (
            <motion.div layout className="order-grid">
              <AnimatePresence mode="popLayout">
                {visible.map((order, index) => (
                  <motion.article
                    layout
                    key={order.id}
                    className={`order-card ${previewOrder?.id === order.id ? "is-selected" : ""}`}
                    initial={{ opacity: 0, y: 22, clipPath: "inset(0 0 30% 0)" }}
                    animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
                    exit={{ opacity: 0, x: 70, scale: 0.94 }}
                    transition={{ delay: index * 0.035, layout: { type: "spring", stiffness: 300, damping: 30 } }}
                  >
                    <div className="order-card-head">
                      <button className="order-title" onClick={() => setPreviewId(order.id)}>{order.title}</button>
                      <CardMenu items={[
                        { label: "Передать в разработку", onClick: async () => {
                          const result = await mutate("transfer-order", { orderId: order.id });
                          if (result?.ok) onTransferred(order.id);
                        } },
                        { label: "Изменить заявку", onClick: () => setFormOrder(order) },
                        { label: "Удалить", danger: true, onClick: () => setDeleteTarget(order) },
                      ]} />
                    </div>
                    <div className="order-nomenclature">{order.nomenclature || "Номенклатура не указана"}</div>
                    <div className="order-dates">
                      <div><CalendarDays size={13} /><span>Дата подписания</span><strong>{formatDate(order.signedDate)}</strong></div>
                      <div><Send size={13} /><span>Дата отгрузки</span><strong>{formatDate(order.shippingDate)}</strong></div>
                    </div>
                    <div className="order-manager"><UserRound size={14} /><span>Менеджер</span><strong>{order.manager}</strong></div>
                    <button className="sketch-open" onClick={() => setPreviewId(order.id)}>
                      <span className="sketch-mini" aria-hidden="true"><i /><i /><i /><i /></span>
                      <span>Предв. просмотр<small>эскиза конструкции</small></span>
                    </button>
                  </motion.article>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <EmptyState title="Заявки не найдены" copy={requests.length ? "Измените поисковый запрос или фильтр менеджера." : "Создайте новую заявку — после передачи она появится в конструкторском отделе."} />
          )}
        </section>

        <aside className="request-preview-panel">
          <div className="panel-caption"><span>Предварительный просмотр</span><span>DWG / ЭСКИЗ</span></div>
          {previewOrder ? (
            <motion.div key={previewOrder.id} initial={{ opacity: 0, scale: 0.96, x: 18 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.35 }}>
              <SketchPreview order={previewOrder} onOpen={() => setFullscreen(true)} />
              <div className="preview-order-meta">
                <div><span>Объект</span><strong>{previewOrder.title}</strong></div>
                <div><span>Менеджер</span><strong>{previewOrder.manager}</strong></div>
                <button className="text-button" onClick={() => {
                  void mutate("transfer-order", { orderId: previewOrder.id }).then((result) => {
                    if (result?.ok) onTransferred(previewOrder.id);
                  });
                }}>Передать в КБ <Send size={14} /></button>
              </div>
            </motion.div>
          ) : <EmptyState title="Нет эскиза" copy="Выберите заявку, чтобы открыть предварительный просмотр." />}
        </aside>
      </div>

      <ConfirmDialog
        target={deleteTarget ? `Удалить заявку «${deleteTarget.title}»?` : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
        description="Вместе с заявкой будут безвозвратно удалены эскиз, компоненты, КД и задания на раскрой. Убедитесь, что вы выбрали правильный объект."
      />

      <Modal open={formOrder !== null} onClose={() => setFormOrder(null)} title={formOrder === "new" ? "Новая заявка" : "Параметры заявки"} eyebrow="Данные договора">
        {formOrder ? <OrderForm key={formOrder === "new" ? "new" : formOrder.id} order={formOrder === "new" ? null : formOrder} onClose={() => setFormOrder(null)} mutate={mutate} /> : null}
      </Modal>

      <Modal open={fullscreen && previewOrder !== null} onClose={() => setFullscreen(false)} title={previewOrder ? `Эскиз · ${previewOrder.title}` : "Эскиз"} eyebrow="Предварительный просмотр" wide>
        {previewOrder ? <div className="fullscreen-sketch"><SketchPreview order={previewOrder} /></div> : null}
      </Modal>
    </div>
  );
}
