"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  Check,
  ChevronDown,
  CircleDot,
  FileCheck2,
  Layers3,
  Plus,
  ScanBarcode,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { SketchPreview } from "@/components/SketchPreview";
import type { BarcodeTarget, Mutate, Notify } from "@/components/types";
import { AddButton, CardMenu, ConfirmDialog, DesignerSelect, EmptyState, Field, Modal } from "@/components/ui";
import {
  COMPONENT_TYPES,
  formatDate,
  type ComponentData,
  type CuttingJobData,
  type JobPanelData,
  type OrderData,
} from "@/lib/domain";

type DeleteTarget =
  | { kind: "order"; id: number; name: string }
  | { kind: "component"; id: number; name: string }
  | { kind: "job"; id: number; name: string };

function NomenclatureInput({ order, mutate }: { order: OrderData; mutate: Mutate }) {
  const [value, setValue] = useState(order.nomenclature ?? "");
  useEffect(() => setValue(order.nomenclature ?? ""), [order.id, order.nomenclature]);
  return (
    <div className="nomenclature-input">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          if (value.trim() !== (order.nomenclature ?? "")) {
            void mutate("update-order", { orderId: order.id, nomenclature: value });
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder="Введите номенклатуру заказа"
        aria-label="Номенклатура заказа"
      />
      <span>Enter / вне поля — сохранить</span>
    </div>
  );
}

function KdStatus({ component, mutate }: { component: ComponentData; mutate: Mutate }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="kd-status" ref={root}>
      <button className={component.kdStatus === "done" ? "status-done" : "status-progress"} onClick={() => setOpen((value) => !value)}>
        {component.kdStatus === "done" ? <Check size={12} /> : <CircleDot size={12} />}
        {component.kdStatus === "done" ? "Готово" : "В работе"}
        <ChevronDown size={11} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div className="dropdown-menu status-menu" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <button onClick={() => { setOpen(false); void mutate("set-kd-status", { componentId: component.id, status: "in_progress" }); }}>В работе</button>
            <button className="selected-item" onClick={() => { setOpen(false); void mutate("set-kd-status", { componentId: component.id, status: "done" }); }}>Готово</button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PanelPicker({
  job,
  components,
  jobPanels,
  mutate,
}: {
  job: CuttingJobData;
  components: ComponentData[];
  jobPanels: JobPanelData[];
  mutate: Mutate;
}) {
  const [open, setOpen] = useState(false);
  const assigned = new Set(jobPanels.map((link) => link.componentId));
  const available = components.filter((component) =>
    component.orderId === job.orderId &&
    component.type === "Панель" &&
    component.stage === "kd" &&
    component.kdStatus === "done" &&
    !assigned.has(component.id),
  );
  return (
    <div className="panel-picker">
      <button className="add-panels-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        Добавить панели <Plus size={13} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div className="panel-options" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div className="panel-options-head"><span>КД со статусом «Готово»</span><button onClick={() => setOpen(false)}><X size={12} /></button></div>
            {available.length ? available.map((panel) => (
              <button key={panel.id} onClick={() => void mutate("add-job-panel", { jobId: job.id, componentId: panel.id })}>
                <span>{panel.name}<small>КД · {panel.kdAuthor}</small></span><Plus size={13} />
              </button>
            )) : <p>Нет свободных панелей с готовым КД. Завершите КД или проверьте другие задания.</p>}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ComponentForm({ order, mutate, onClose }: { order: OrderData; mutate: Mutate; onClose: () => void }) {
  const [name, setName] = useState(`Панель ${order.nomenclature?.match(/\d+/)?.[0] ?? "000"}.${String(Date.now()).slice(-2)}.00`);
  const [type, setType] = useState<string>(COMPONENT_TYPES[0]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await mutate("create-component", { orderId: order.id, name, type });
    if (result?.ok) onClose();
  };
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Номенклатура компонента"><input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></Field>
        <Field label="Тип компонента"><select value={type} onChange={(event) => setType(event.target.value)}>{COMPONENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </div>
      <div className="form-note"><Box size={15} />Автор 3D-модели: <strong>{order.developer}</strong>. Компонент появится в колонке «3D-модели».</div>
      <div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>Отмена</button><button className="button button-gold">Добавить компонент</button></div>
    </form>
  );
}

function JobForm({ order, jobs, mutate, onClose }: { order: OrderData; jobs: CuttingJobData[]; mutate: Mutate; onClose: () => void }) {
  const prefix = order.title.replace(/[^A-Za-zА-Яа-я]/g, "").slice(0, 3).toUpperCase();
  const [name, setName] = useState(`Раскрой ${prefix}-${String(jobs.filter((job) => job.orderId === order.id).length + 1).padStart(2, "0")}`);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await mutate("create-cutting-job", { orderId: order.id, name });
    if (result?.ok) onClose();
  };
  return (
    <form onSubmit={submit}>
      <Field label="Имя раскроя"><input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></Field>
      <div className="form-note"><ScanBarcode size={15} />Уникальный штрих-код задания будет создан сразу после сохранения.</div>
      <div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>Отмена</button><button className="button button-gold">Создать задание</button></div>
    </form>
  );
}

export function DesignView({
  orders,
  components,
  cuttingJobs,
  jobPanels,
  selectedOrderId,
  onSelectOrder,
  mutate,
  notify,
  onBarcode,
}: {
  orders: OrderData[];
  components: ComponentData[];
  cuttingJobs: CuttingJobData[];
  jobPanels: JobPanelData[];
  selectedOrderId: number | null;
  onSelectOrder: (id: number) => void;
  mutate: Mutate;
  notify: Notify;
  onBarcode: (target: BarcodeTarget) => void;
}) {
  const designOrders = useMemo(() => orders.filter((order) => order.stage === "design"), [orders]);
  const selectedOrder = designOrders.find((order) => order.id === selectedOrderId) ?? designOrders[0] ?? null;
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [componentForm, setComponentForm] = useState(false);
  const [jobForm, setJobForm] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);

  const orderComponents = selectedOrder ? components.filter((component) => component.orderId === selectedOrder.id) : [];
  const models = orderComponents.filter((component) => component.stage === "model");
  const kdItems = orderComponents.filter((component) => component.stage === "kd");
  const draftJobs = selectedOrder ? cuttingJobs.filter((job) => job.orderId === selectedOrder.id && job.status === "draft") : [];

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const action = deleteTarget.kind === "order" ? "delete-order" : deleteTarget.kind === "component" ? "delete-component" : "delete-cutting-job";
    const payload = deleteTarget.kind === "order" ? { orderId: deleteTarget.id } : deleteTarget.kind === "component" ? { componentId: deleteTarget.id } : { jobId: deleteTarget.id };
    const result = await mutate(action, payload);
    if (result?.ok) setDeleteTarget(null);
  };

  return (
    <div className="design-view view-enter">
      <div className="section-intro design-intro">
        <div><span className="eyebrow">02 / Проектный контур</span><h1>Конструкторский отдел</h1><p>От 3D-модели до комплекта КД и задания на раскрой.</p></div>
        {selectedOrder ? <div className="design-progress">
          <div><strong>{models.length}</strong><span>3D-модели</span></div><i />
          <div><strong>{kdItems.filter((item) => item.kdStatus === "done").length}/{kdItems.length}</strong><span>КД готово</span></div><i />
          <div><strong>{draftJobs.length}</strong><span>раскроя формируется</span></div>
        </div> : null}
      </div>

      <div className="design-board">
        <section className="design-column active-orders-column">
          <div className="column-heading"><div><span>01</span><h2>Активные заявки</h2></div><strong>{designOrders.length}</strong></div>
          <div className="column-scroll">
            {designOrders.length ? designOrders.map((order) => (
              <motion.article layout key={order.id} className={`active-order-card ${selectedOrder?.id === order.id ? "is-selected" : ""}`}>
                <div className="order-card-head">
                  <button className="order-title" onClick={() => onSelectOrder(order.id)}>{order.title}</button>
                  <CardMenu items={[
                    { label: "Вернуть в заявки", onClick: () => void mutate("return-order", { orderId: order.id }) },
                    { label: "Удалить", danger: true, onClick: () => setDeleteTarget({ kind: "order", id: order.id, name: order.title }) },
                  ]} />
                </div>
                {selectedOrder?.id === order.id ? (
                  <motion.div className="active-order-details" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <NomenclatureInput order={order} mutate={mutate} />
                    <div className="developer-block"><span>Разработчик заявки</span><DesignerSelect value={order.developer} onChange={(developer) => void mutate("update-order", { orderId: order.id, developer })} placeholder="Назначить разработчика" /></div>
                    <div className="compact-dates"><div><span>Подписание</span><strong>{formatDate(order.signedDate)}</strong></div><div><span>Отгрузка</span><strong>{formatDate(order.shippingDate)}</strong></div></div>
                    <button className="sketch-open design-sketch-open" onClick={() => setSketchOpen(true)}><Layers3 size={17} /><span>Открыть эскиз<small>{order.manager}</small></span></button>
                  </motion.div>
                ) : <button className="collapsed-order-meta" onClick={() => onSelectOrder(order.id)}>{order.nomenclature || "Без номенклатуры"}<span>{order.developer || "Разработчик не назначен"}</span></button>}
              </motion.article>
            )) : <EmptyState title="Нет активных заявок" copy="Передайте заявку в разработку на первой вкладке." />}
          </div>
        </section>

        <section className="design-column">
          <div className="column-heading"><div><span>02</span><h2>3D-модели</h2></div><AddButton label="Добавить компонент" onClick={() => {
            if (!selectedOrder) return notify("Сначала выберите заявку", "info");
            if (!selectedOrder.developer) return notify("Назначьте разработчика заявки перед добавлением компонентов", "info");
            setComponentForm(true);
          }} /></div>
          <div className="column-subtitle">Панели · кассеты · элементы каркаса</div>
          <div className="column-scroll component-list">
            <AnimatePresence mode="popLayout">
              {models.map((component) => (
                <motion.article layout key={component.id} className="component-card" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 65, scale: 0.95 }}>
                  <div className="component-card-head"><span className="component-type">{component.type}</span><CardMenu items={[
                    { label: "Начать разработку КД", onClick: () => void mutate("start-kd", { componentId: component.id }) },
                    { label: "Удалить", danger: true, onClick: () => setDeleteTarget({ kind: "component", id: component.id, name: component.name }) },
                  ]} /></div>
                  <h3>{component.name}</h3><div className="component-author"><span>Автор 3D</span><strong>{component.modelAuthor}</strong></div>
                </motion.article>
              ))}
            </AnimatePresence>
            {!models.length ? <EmptyState title="Нет 3D-моделей" copy="Нажмите + над колонкой, чтобы добавить первый компонент." /> : null}
          </div>
        </section>

        <section className="design-column">
          <div className="column-heading"><div><span>03</span><h2>КД</h2></div><strong>{kdItems.filter((item) => item.kdStatus === "done").length}/{kdItems.length}</strong></div>
          <div className="column-subtitle">Назначьте автора и завершите комплект</div>
          <div className="column-scroll component-list">
            <AnimatePresence mode="popLayout">
              {kdItems.map((component) => (
                <motion.article layout key={component.id} className={`component-card kd-card ${component.kdStatus === "done" ? "kd-complete" : ""}`} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <div className="component-card-head"><KdStatus component={component} mutate={mutate} /><CardMenu items={[
                    ...(component.barcode ? [{ label: "Открыть штрих-код", onClick: () => onBarcode({ code: component.barcode!, title: component.name, subtitle: `${selectedOrder?.title ?? ""} · КД ${component.kdAuthor ?? ""}`, kind: "KD" as const }) }] : []),
                    { label: "Удалить", danger: true, onClick: () => setDeleteTarget({ kind: "component", id: component.id, name: component.name }) },
                  ]} /></div>
                  <span className="component-type">{component.type}</span><h3>{component.name}</h3>
                  <div className="kd-authors"><span>3D: {component.modelAuthor}</span><DesignerSelect compact value={component.kdAuthor} onChange={(author) => void mutate("assign-kd-author", { componentId: component.id, author })} placeholder="Выбрать автора КД" /></div>
                  {component.barcode && component.kdStatus === "done" ? <button className="barcode-link" onClick={() => onBarcode({ code: component.barcode!, title: component.name, subtitle: `${selectedOrder?.title ?? ""} · личный код КД`, kind: "KD" })}><ScanBarcode size={15} />{component.barcode}</button> : <div className="barcode-pending"><ScanBarcode size={14} />Код появится после статуса «Готово»</div>}
                </motion.article>
              ))}
            </AnimatePresence>
            {!kdItems.length ? <EmptyState title="КД пока не начато" copy="В карточке 3D-модели откройте стрелку и выберите «Начать разработку КД»." /> : null}
          </div>
        </section>

        <section className="design-column">
          <div className="column-heading"><div><span>04</span><h2>Задание на резку</h2></div><AddButton label="Создать задание на резку" onClick={() => selectedOrder ? setJobForm(true) : notify("Сначала выберите заявку", "info")} /></div>
          <div className="column-subtitle">Только панели с готовым КД</div>
          <div className="column-scroll job-list">
            <AnimatePresence mode="popLayout">
              {draftJobs.map((job) => {
                const links = jobPanels.filter((link) => link.jobId === job.id);
                const panels = links.map((link) => components.find((component) => component.id === link.componentId)).filter((item): item is ComponentData => Boolean(item));
                return (
                  <motion.article layout key={job.id} className="cutting-job-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 80, scale: 0.94 }}>
                    <div className="order-card-head"><div><span className="job-number">CUT / {String(job.id).padStart(3, "0")}</span><h3>{job.name}</h3></div><CardMenu items={[
                      { label: "Передать в производство", onClick: () => void mutate("transfer-job", { jobId: job.id }) },
                      { label: "Открыть штрих-код", onClick: () => onBarcode({ code: job.barcode, title: job.name, subtitle: `${selectedOrder?.title ?? ""} · задание на раскрой`, kind: "CUT" }) },
                      { label: "Удалить", danger: true, onClick: () => setDeleteTarget({ kind: "job", id: job.id, name: job.name }) },
                    ]} /></div>
                    <div className="job-author"><span>Автор задания</span><DesignerSelect compact value={job.author} onChange={(author) => void mutate("assign-job-author", { jobId: job.id, author })} placeholder="Выбрать автора" /></div>
                    <button className="barcode-link" onClick={() => onBarcode({ code: job.barcode, title: job.name, subtitle: `${selectedOrder?.title ?? ""} · задание на раскрой`, kind: "CUT" })}><ScanBarcode size={15} />{job.barcode}</button>
                    <PanelPicker job={job} components={components} jobPanels={jobPanels} mutate={mutate} />
                    <div className="job-panel-list">
                      {panels.map((panel, index) => <div key={panel.id}><span className="panel-index">{String(index + 1).padStart(2, "0")}</span><FileCheck2 size={13} /><span>{panel.name}</span><button onClick={() => void mutate("remove-job-panel", { jobId: job.id, componentId: panel.id })} aria-label={`Убрать ${panel.name}`}><X size={12} /></button></div>)}
                      {!panels.length ? <p>Состав задания пуст. Добавьте панели с готовым КД.</p> : null}
                    </div>
                    <button className="transfer-job-button" onClick={() => void mutate("transfer-job", { jobId: job.id })}><Send size={14} />Передать в производство<span>{panels.length} пан.</span></button>
                  </motion.article>
                );
              })}
            </AnimatePresence>
            {!draftJobs.length ? <EmptyState title="Нет формируемых заданий" copy="Создайте раскрой через +. После передачи он появится во вкладке «Производство»." /> : null}
          </div>
        </section>
      </div>

      <ConfirmDialog
        target={deleteTarget ? `${deleteTarget.kind === "order" ? "Удалить заявку" : deleteTarget.kind === "component" ? "Удалить компонент" : "Удалить задание"} «${deleteTarget.name}»?` : null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        description={deleteTarget?.kind === "component" ? "Компонент будет удалён из 3D/КД и исключён из заданий на раскрой. Это действие нельзя отменить." : deleteTarget?.kind === "job" ? "Состав задания будет удалён, панели останутся в КД и снова станут доступны для другого раскроя." : "Будут удалены все компоненты, КД и задания заявки. Это действие нельзя отменить."}
      />
      <Modal open={componentForm && selectedOrder !== null} onClose={() => setComponentForm(false)} title="Новый компонент" eyebrow={selectedOrder?.title}>
        {selectedOrder ? <ComponentForm order={selectedOrder} mutate={mutate} onClose={() => setComponentForm(false)} /> : null}
      </Modal>
      <Modal open={jobForm && selectedOrder !== null} onClose={() => setJobForm(false)} title="Задание на резку" eyebrow={selectedOrder?.title}>
        {selectedOrder ? <JobForm order={selectedOrder} jobs={cuttingJobs} mutate={mutate} onClose={() => setJobForm(false)} /> : null}
      </Modal>
      <Modal open={sketchOpen && selectedOrder !== null} onClose={() => setSketchOpen(false)} title={selectedOrder ? `Эскиз · ${selectedOrder.title}` : "Эскиз"} wide>
        {selectedOrder ? <div className="fullscreen-sketch"><SketchPreview order={selectedOrder} /></div> : null}
      </Modal>
    </div>
  );
}
