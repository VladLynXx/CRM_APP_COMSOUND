"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Barcode,
  Camera,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Keyboard,
  Package,
  Route,
  ScanLine,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { BarcodeTarget, Mutate, Notify } from "@/components/types";
import { CameraScanner } from "@/components/CameraScanner";
import { EmptyState } from "@/components/ui";
import {
  JOB_STATUS_LABELS,
  PRODUCTION_LABELS,
  STATIONS,
  formatDateTime,
  type ComponentData,
  type CuttingJobData,
  type EmployeeData,
  type JobPanelData,
  type OrderData,
  type ScanEventData,
  type Station,
} from "@/lib/domain";

const NEXT_OPERATION: Partial<Record<ComponentData["productionStatus"], string>> = {
  queued: "Запустить раскрой кодом CUT",
  cutting: "Завершить раскрой кодом CUT",
  cut: "Начать гибку · KD + гибщик",
  bent: "Начать сварку · KD + сварщик",
  welded: "Начать покраску · KD + маляр",
  painted: "Начать сборку · KD + сборщик",
  assembled: "Провести ОТК · KD + контролёр",
  ready: "Готово · CS-наклейка сформирована",
};

const STATION_STATUSES: Record<Station, ComponentData["productionStatus"][]> = {
  cut: ["queued", "cutting"],
  bend: ["cut", "bent"],
  weld: ["welded"],
  paint: ["painted"],
  assembly: ["assembled"],
  qc: ["ready"],
};

export function ProductionView({
  orders,
  components,
  cuttingJobs,
  jobPanels,
  employees,
  scanEvents,
  mutate,
  notify,
  onBarcode,
}: {
  orders: OrderData[];
  components: ComponentData[];
  cuttingJobs: CuttingJobData[];
  jobPanels: JobPanelData[];
  employees: EmployeeData[];
  scanEvents: ScanEventData[];
  mutate: Mutate;
  notify: Notify;
  onBarcode: (target: BarcodeTarget) => void;
}) {
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);
  const [orderFilter, setOrderFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState<"all" | Station>("all");
  const [registryMode, setRegistryMode] = useState<"panels" | "jobs" | "badges">("panels");
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedEmployee = window.localStorage.getItem("comsound.employee");
    if (savedEmployee) setEmployee(employees.find((item) => item.barcode === savedEmployee) ?? null);
    window.localStorage.removeItem("comsound.station");
  }, [employees]);

  const productionJobs = useMemo(() => cuttingJobs.filter((job) => job.status !== "draft"), [cuttingJobs]);
  const visibleJobs = productionJobs.filter((job) => orderFilter === "all" || String(job.orderId) === orderFilter);
  const productionPanelIds = new Set(jobPanels.filter((link) => productionJobs.some((job) => job.id === link.jobId)).map((link) => link.componentId));
  const productionPanels = components.filter((component) => productionPanelIds.has(component.id));
  const stationPanels = productionPanels.filter((component) => orderFilter === "all" || String(component.orderId) === orderFilter);
  const visiblePanels = stationPanels.filter((component) => stationFilter === "all" || STATION_STATUSES[stationFilter].includes(component.productionStatus));
  const readyCount = productionPanels.filter((component) => component.productionStatus === "ready").length;

  const performScan = async (scanCode: string) => {
    if (!scanCode.trim() || busy) return;
    setBusy(true);
    const result = await mutate("scan", {
      code: scanCode,
      employeeCode: employee?.barcode ?? "",
      station: "auto",
    }, { silent: true });
    setBusy(false);
    setCode("");
    if (!result) return;
    const message = result.message ?? result.error ?? "Операция не выполнена";
    setLastResult({ success: result.ok, message });
    if (result.ok && result.scanKind === "employee" && result.employee) {
      setEmployee(result.employee);
      window.localStorage.setItem("comsound.employee", result.employee.barcode);
      notify(`Сотрудник подтверждён: ${result.employee.name}`);
    } else if (!result.ok) {
      notify(message, "error");
    } else {
      notify(message);
    }
    window.setTimeout(() => inputRef.current?.focus(), 30);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void performScan(code);
  };

  const fillCode = (value: string) => {
    setCode(value);
    inputRef.current?.focus();
  };

  return (
    <div className="production-view view-enter">
      <div className="section-intro">
        <div><span className="eyebrow">03 / Цеховой контур</span><h1>Производство</h1><p>Фиксация операций по двум штрих-кодам: сотрудник и документ.</p></div>
        <div className="intro-stats production-stats">
          <div><strong>{productionJobs.length.toString().padStart(2, "0")}</strong><span>заданий в цехе</span></div>
          <div><strong>{productionPanels.length.toString().padStart(2, "0")}</strong><span>панелей в контуре</span></div>
          <div><strong>{readyCount.toString().padStart(2, "0")}</strong><span>принято ОТК</span></div>
        </div>
      </div>

      <div className="production-top-grid">
        <section className="scanner-console">
          <div className="console-head"><div><ScanLine size={18} /><h2>Пост сканирования</h2></div><span className="live-indicator"><i />AUTO / CAMERA / HID</span></div>
          <div className="auto-route">
            <div className="auto-route-head"><Route size={16} /><strong>Автоматический маршрут</strong><span>Участок выбирать не нужно</span></div>
            <div className="auto-route-steps" aria-label="Технологический маршрут панели"><span>Раскрой</span><i /><span>Гибка</span><i /><span>Сварка</span><i /><span>Покраска</span><i /><span>Сборка</span><i /><span>ОТК</span></div>
            <p>Система определит следующую операцию по статусу панели и проверит допуск сотрудника по его бейджу.</p>
          </div>

          <div className={`employee-session ${employee ? "has-employee" : ""}`}>
            {employee ? <>
              <div className="employee-avatar"><UserCheck size={22} /></div>
              <div><span>Смена подтверждена</span><strong>{employee.name}</strong><small>{employee.role} · допуск: {employee.department}</small></div>
              <button onClick={() => { setEmployee(null); window.localStorage.removeItem("comsound.employee"); setLastResult(null); }}><X size={14} />Завершить</button>
            </> : <>
              <div className="employee-avatar"><Barcode size={22} /></div>
              <div><span>Шаг 1 из 2</span><strong>Отсканируйте личный бейдж</strong><small>Без сотрудника код документа не будет принят</small></div>
            </>}
          </div>

          <form className={`scan-input-wrap ${busy ? "is-busy" : ""}`} onSubmit={submit}>
            <div className="scan-input-label"><span>{employee ? "ШАГ 2 · АВТОМАРШРУТ KD / CUT" : "ШАГ 1 · КОД СОТРУДНИКА"}</span><span>ENTER ↵</span></div>
            <div className="scan-input-line"><ScanLine size={25} /><input ref={inputRef} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder={employee ? "KD-000000-XXXX / CUT-000000-XXXX" : "EMP-0000-COM"} autoComplete="off" spellCheck={false} autoFocus /><button disabled={busy || !code.trim()}>{busy ? "Проверка…" : "Принять"}<ChevronRight size={16} /></button></div>
          </form>

          <button className="camera-launch" type="button" onClick={() => setCameraOpen(true)} disabled={busy}>
            <Camera size={18} />
            <span>{employee ? "Сканировать документ камерой" : "Сканировать бейдж камерой"}<small>Телефон · распознавание Code128 на устройстве</small></span>
            <ChevronRight size={16} />
          </button>

          <details className="phone-test-guide">
            <summary>Как проверить, если есть только один телефон</summary>
            <ol>
              <li>Ниже откройте «Бейджи» и нажмите «Вставить код в сканер» у сотрудника.</li>
              <li>Вернитесь к полю и нажмите «Принять» — сотрудник будет авторизован.</li>
              <li>В очереди нажмите «Скан» у задания и «Принять». Выбирать участок не нужно.</li>
              <li>Повторное сканирование CUT завершит раскрой. Затем меняйте бейдж сотрудника и сканируйте KD — следующая операция определится автоматически.</li>
            </ol>
          </details>

          <AnimatePresence mode="wait">
            {lastResult ? <motion.div key={`${lastResult.message}-${scanEvents[0]?.id ?? 0}`} className={`scan-result ${lastResult.success ? "success" : "error"}`} initial={{ opacity: 0, y: 10, scaleY: 0.85 }} animate={{ opacity: 1, y: 0, scaleY: 1 }} exit={{ opacity: 0 }}>
              {lastResult.success ? <BadgeCheck size={21} /> : <CircleAlert size={21} />}<div><span>{lastResult.success ? "Операция зарегистрирована" : "Сканирование отклонено"}</span><strong>{lastResult.message}</strong></div>
            </motion.div> : <motion.div className="scan-result neutral" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Keyboard size={20} /><div><span>Сканер работает как клавиатура</span><strong>Установите курсор в поле один раз. Дальше сканируйте бейджи и документы — вкладки участков больше не нужны.</strong></div></motion.div>}
          </AnimatePresence>
        </section>

        <section className="production-queue">
          <div className="console-head"><div><ClipboardList size={18} /><h2>Очередь раскроя</h2></div><span>{visibleJobs.length} док.</span></div>
          <select className="order-filter" value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}>
            <option value="all">Все заявки производства</option>
            {orders.filter((order) => productionJobs.some((job) => job.orderId === order.id)).map((order) => <option key={order.id} value={order.id}>{order.title}</option>)}
          </select>
          <div className="production-job-list">
            {visibleJobs.map((job) => {
              const order = orders.find((item) => item.id === job.orderId);
              const count = jobPanels.filter((link) => link.jobId === job.id).length;
              return <article key={job.id} className={`production-job status-${job.status}`}>
                <div className="production-job-head"><div><span>{order?.title}</span><h3>{job.name}</h3></div><strong>{JOB_STATUS_LABELS[job.status]}</strong></div>
                <div className="job-progress-track"><motion.i initial={false} animate={{ width: job.status === "queued" ? "12%" : job.status === "cutting" ? "55%" : "100%" }} /></div>
                <div className="production-job-meta"><span>{count} панелей · {job.author}</span><button onClick={() => fillCode(job.barcode)} title="Вставить код в поле сканирования"><ScanLine size={13} />Скан</button><button onClick={() => onBarcode({ code: job.barcode, title: job.name, subtitle: `${order?.title ?? ""} · задание на раскрой`, kind: "CUT" })}><Barcode size={14} />Этикетка</button></div>
              </article>;
            })}
            {!visibleJobs.length ? <EmptyState title="Очередь пуста" copy="Передайте задание из конструкторского отдела." /> : null}
          </div>
        </section>
      </div>

      <section className="station-monitor" aria-label="Фильтр панелей по участкам">
        <div className="station-monitor-title"><Route size={16} /><div><strong>Панели по участкам</strong><span>Фильтр для контроля · на сканирование не влияет</span></div></div>
        <div className="station-monitor-buttons">
          <button className={stationFilter === "all" ? "is-active" : ""} onClick={() => setStationFilter("all")}><span>Все</span><strong>{stationPanels.length}</strong></button>
          {STATIONS.map((item) => {
            const count = stationPanels.filter((component) => STATION_STATUSES[item.id].includes(component.productionStatus)).length;
            return <button key={item.id} className={stationFilter === item.id ? "is-active" : ""} onClick={() => setStationFilter(item.id)}><span>{item.label}</span><strong>{count}</strong></button>;
          })}
        </div>
      </section>

      <section className="production-registry">
        <div className="registry-head">
          <div><span className="eyebrow">Единый реестр</span><h2>Документы и прослеживаемость</h2></div>
          <div className="registry-tabs">
            <button className={registryMode === "panels" ? "is-active" : ""} onClick={() => setRegistryMode("panels")}>Панели <span>{visiblePanels.length}</span></button>
            <button className={registryMode === "jobs" ? "is-active" : ""} onClick={() => setRegistryMode("jobs")}>Раскрои <span>{visibleJobs.length}</span></button>
            <button className={registryMode === "badges" ? "is-active" : ""} onClick={() => setRegistryMode("badges")}>Бейджи <span>{employees.length}</span></button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {registryMode === "panels" ? <motion.div key="panels" className="registry-table" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="registry-table-head"><span>Компонент / заявка</span><span>Текущий статус</span><span>Следующая операция</span><span>Код КД</span></div>
            {visiblePanels.map((panel) => {
              const order = orders.find((item) => item.id === panel.orderId);
              return <div className="registry-table-row" key={panel.id}>
                <div><strong>{panel.name}</strong><span>{order?.title} · КД {panel.kdAuthor}</span></div>
                <div><span className={`production-status prod-${panel.productionStatus}`}><i />{PRODUCTION_LABELS[panel.productionStatus]}</span></div>
                <div><span>{NEXT_OPERATION[panel.productionStatus] ?? "Ожидает передачи"}</span></div>
                <div className="registry-code"><button onClick={() => fillCode(panel.barcode ?? "")} disabled={!panel.barcode}><ScanLine size={13} />{panel.barcode ?? "Нет кода"}</button>{panel.barcode ? <button onClick={() => onBarcode({ code: panel.barcode!, title: panel.name, subtitle: `${order?.title ?? ""} · персональный код КД`, kind: "KD" })} title="Этикетка КД"><Barcode size={14} /></button> : null}{panel.productBarcode ? <button className="product-sticker-link" onClick={() => onBarcode({ code: panel.productBarcode!, title: panel.name, subtitle: `${order?.title ?? ""} · товарная наклейка после ОТК`, kind: "ITEM" })} title="Товарная наклейка готового изделия"><Package size={13} />{panel.productBarcode}</button> : null}</div>
              </div>;
            })}
            {!visiblePanels.length ? <EmptyState title="Панели не найдены" copy="В этом фильтре нет панелей, переданных в производство." /> : null}
          </motion.div> : null}

          {registryMode === "jobs" ? <motion.div key="jobs" className="document-card-grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {visibleJobs.map((job) => <article key={job.id}><div><span className="eyebrow">Задание CUT-{String(job.id).padStart(3, "0")}</span><h3>{job.name}</h3><p>{orders.find((order) => order.id === job.orderId)?.title} · {job.author}</p></div><span className="document-status">{JOB_STATUS_LABELS[job.status]}</span><button className="barcode-link" onClick={() => onBarcode({ code: job.barcode, title: job.name, subtitle: "Задание на раскрой", kind: "CUT" })}><Barcode size={16} />{job.barcode}</button></article>)}
          </motion.div> : null}

          {registryMode === "badges" ? <motion.div key="badges" className="document-card-grid employee-grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {employees.map((person) => <article key={person.id}><div><span className="eyebrow">{person.department}</span><h3>{person.name}</h3><p>{person.role}</p></div><span className="document-status">{person.active ? "Доступ активен" : "Заблокирован"}</span><button className="barcode-link" onClick={() => onBarcode({ code: person.barcode, title: person.name, subtitle: `${person.role} · личный бейдж`, kind: "EMP" })}><Barcode size={16} />{person.barcode}</button><button className="badge-scan-fill" onClick={() => fillCode(person.barcode)}><ScanLine size={13} />Вставить код в сканер</button></article>)}
          </motion.div> : null}
        </AnimatePresence>
      </section>

      <div className="production-bottom-grid">
        <section className="scan-history">
          <div className="console-head"><div><ClipboardList size={17} /><h2>Журнал сканирований</h2></div><span>Последние 50</span></div>
          <div className="history-list">
            {scanEvents.slice(0, 10).map((event) => <div key={event.id} className={event.success ? "history-success" : "history-error"}><span className="history-icon">{event.success ? <Check size={13} /> : <X size={13} />}</span><div><strong>{event.message}</strong><span>{event.employeeName} · {event.documentCode}</span></div><time>{formatDateTime(event.createdAt)}</time></div>)}
            {!scanEvents.length ? <EmptyState title="Журнал пуст" copy="Здесь появятся успешные и отклонённые сканирования." /> : null}
          </div>
        </section>

        <section className="implementation-notes">
          <span className="eyebrow">Рекомендация по внедрению</span><h2>От сайта к цеховым постам</h2>
          <ol>
            <li><span>01</span><div><strong>Сканер без драйверов</strong><p>USB/Bluetooth HID-сканер вводит Code128 как клавиатура и завершает ввод Enter. Текущее поле уже поддерживает этот сценарий.</p></div></li>
            <li><span>02</span><div><strong>Этикетка 50 × 25 мм</strong><p>Печатайте SVG на термопринтере, 203–300 dpi. Для металла используйте стойкую плёнку и защитный ламинат.</p></div></li>
            <li><span>03</span><div><strong>Два кода на операцию</strong><p>Бейдж фиксирует ответственного и его допуск, код документа — объект. Сервер сам выбирает следующую операцию по текущему статусу, поэтому переключать участки не требуется.</p></div></li>
            <li><span>04</span><div><strong>Следующий этап</strong><p>Закрепить пост за рабочим местом, добавить печать через принтер этикеток и контроль повторного сканирования по тайм-ауту смены.</p></div></li>
          </ol>
        </section>
      </div>

      <CameraScanner
        open={cameraOpen}
        expected={employee ? "document" : "employee"}
        onClose={() => setCameraOpen(false)}
        onDetected={(detectedCode) => {
          setCameraOpen(false);
          setCode(detectedCode);
          void performScan(detectedCode);
        }}
      />
    </div>
  );
}
