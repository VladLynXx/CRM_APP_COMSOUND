"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { Bell, Check, CircleAlert, Database, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BarcodeDialog } from "@/components/BarcodeDialog";
import { DesignView } from "@/components/DesignView";
import { ProductionView } from "@/components/ProductionView";
import { RequestsView } from "@/components/RequestsView";
import { ShippingView } from "@/components/ShippingView";
import type { BarcodeTarget, MutationResult, Notify } from "@/components/types";
import type { WorkspaceData } from "@/lib/domain";

type Tab = "requests" | "design" | "production" | "shipping";
type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

const TABS: { id: Tab; label: string; index: string }[] = [
  { id: "requests", label: "Заявки", index: "01" },
  { id: "design", label: "Конструкторский отдел", index: "02" },
  { id: "production", label: "Производство", index: "03" },
  { id: "shipping", label: "Отгрузка", index: "04" },
];

export function WorkspaceApp({ initialData }: { initialData: WorkspaceData }) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<Tab>("requests");
  const [selectedDesignOrder, setSelectedDesignOrder] = useState<number | null>(initialData.orders.find((order) => order.stage === "design")?.id ?? null);
  const [barcodeTarget, setBarcodeTarget] = useState<BarcodeTarget | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [liveSync, setLiveSync] = useState<"connecting" | "online" | "offline">("connecting");
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 130, damping: 28, mass: 0.3 });

  const notify: Notify = useCallback((message, tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4800);
  }, []);

  useEffect(() => {
    const savedTab = window.localStorage.getItem("comsound.tab") as Tab | null;
    const savedOrder = Number(window.localStorage.getItem("comsound.order"));
    if (savedTab && TABS.some((tab) => tab.id === savedTab)) setActiveTab(savedTab);
    if (savedOrder) setSelectedDesignOrder(savedOrder);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !["1", "2", "3", "4"].includes(event.key)) return;
      event.preventDefault();
      const tab = TABS[Number(event.key) - 1].id;
      setActiveTab(tab);
      window.localStorage.setItem("comsound.tab", tab);
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [reduceMotion]);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    const synchronize = async () => {
      if (!active || requestInFlight || document.hidden) return;
      requestInFlight = true;
      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        if (!response.ok) throw new Error("Synchronization failed");
        const result = await response.json() as MutationResult;
        if (!active || !result.data) return;
        const nextData = result.data;
        setData((current) => JSON.stringify(current) === JSON.stringify(nextData) ? current : nextData);
        setLiveSync("online");
      } catch {
        if (active) setLiveSync("offline");
      } finally {
        requestInFlight = false;
      }
    };

    const synchronizeWhenVisible = () => {
      if (!document.hidden) void synchronize();
    };
    void synchronize();
    const interval = window.setInterval(() => void synchronize(), 2000);
    document.addEventListener("visibilitychange", synchronizeWhenVisible);
    window.addEventListener("focus", synchronizeWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", synchronizeWhenVisible);
      window.removeEventListener("focus", synchronizeWhenVisible);
    };
  }, []);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    window.localStorage.setItem("comsound.tab", tab);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const selectOrder = (orderId: number) => {
    setSelectedDesignOrder(orderId);
    window.localStorage.setItem("comsound.order", String(orderId));
  };

  const handleAutomaticBarcode = useCallback((result: MutationResult) => {
    if (!result.data) return;
    if (result.barcode && result.barcodeComponentId) {
      const component = result.data.components.find((item) => item.id === result.barcodeComponentId);
      if (component) {
        const order = result.data.orders.find((item) => item.id === component.orderId);
        setBarcodeTarget({ code: result.barcode, title: component.name, subtitle: `${order?.title ?? ""} · код создан автоматически после готовности КД`, kind: "KD" });
      }
    }
    if (result.barcode && result.barcodeJobId) {
      const job = result.data.cuttingJobs.find((item) => item.id === result.barcodeJobId);
      if (job) {
        const order = result.data.orders.find((item) => item.id === job.orderId);
        setBarcodeTarget({ code: result.barcode, title: job.name, subtitle: `${order?.title ?? ""} · код создан при создании задания`, kind: "CUT" });
      }
    }
    if (result.barcode && result.barcodeBoxId) {
      const box = result.data.shippingBoxes.find((item) => item.id === result.barcodeBoxId);
      if (box) {
        const order = result.data.orders.find((item) => item.id === box.orderId);
        setBarcodeTarget({ code: result.barcode, title: box.name, subtitle: `${order?.title ?? ""} · наклейка созданного ящика`, kind: "BOX" });
      }
    }
    if (result.productBarcode && result.productBarcodeComponentId) {
      const component = result.data.components.find((item) => item.id === result.productBarcodeComponentId);
      if (component) {
        const order = result.data.orders.find((item) => item.id === component.orderId);
        setBarcodeTarget({ code: result.productBarcode, title: component.name, subtitle: `${order?.title ?? ""} · товарная наклейка создана после ОТК`, kind: "ITEM" });
      }
    }
  }, []);

  const mutate = useCallback(async (action: string, payload: Record<string, unknown> = {}, options: { silent?: boolean } = {}) => {
    setPending((value) => value + 1);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json() as MutationResult;
      if (result.data) setData(result.data);
      if (result.ok) {
        if (!options.silent) notify(result.message ?? "Изменения сохранены");
        handleAutomaticBarcode(result);
      } else if (!options.silent) {
        notify(result.error ?? "Операция не выполнена", "error");
      }
      return result;
    } catch {
      if (!options.silent) notify("Нет связи с сервером. Изменения не сохранены", "error");
      return undefined;
    } finally {
      setPending((value) => Math.max(0, value - 1));
    }
  }, [handleAutomaticBarcode, notify]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const result = await response.json() as MutationResult;
      if (result.data) {
        setData(result.data);
        notify("Данные синхронизированы с базой");
      } else notify("Не удалось обновить данные", "error");
    } catch {
      notify("Нет связи с сервером", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const counts: Record<Tab, number> = {
    requests: data.orders.filter((order) => order.stage === "request").length,
    design: data.orders.filter((order) => order.stage === "design").length,
    production: data.cuttingJobs.filter((job) => job.status !== "draft").length,
    shipping: data.shippingBoxes.filter((box) => box.status !== "shipped").length,
  };

  return (
    <main className="app-shell">
      <motion.div className="scroll-progress" style={{ scaleX: progress }} />
      <div className="ambient-grid" aria-hidden="true" />
      <div className="ambient-glow" aria-hidden="true" />

      <motion.header className="app-header" initial={reduceMotion ? false : { opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
        <div className="brand-block">
          <img className="brand-logo" src="/comsound-logo.svg" alt="COMSOUND — звукоизоляционные конструкции" />
        </div>
        <nav className="main-tabs" aria-label="Основные разделы">
          {TABS.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "is-active" : ""} onClick={() => selectTab(tab.id)}>
            {activeTab === tab.id ? <motion.span className="active-tab-bg" layoutId="active-tab" transition={{ type: "spring", stiffness: 350, damping: 32 }} /> : null}
            <span className="tab-index">{tab.index}</span><span className="tab-label">{tab.label}</span><span className="tab-count">{counts[tab.id]}</span>
          </button>)}
        </nav>
        <div className="header-tools">
          <div className={`sync-state sync-${liveSync}`} title="Статусы обновляются между телефоном и ПК каждые 2 секунды"><Database size={13} /><span>{pending ? "Сохранение…" : liveSync === "online" ? "LIVE · телефон и ПК синхронизированы" : liveSync === "offline" ? "Нет связи · повторяем подключение" : "Подключаем live-синхронизацию…"}</span><i className={pending ? "is-saving" : ""} /></div>
          <button className="icon-button" onClick={() => void refresh()} aria-label="Обновить данные" title="Обновить данные"><RefreshCw size={16} className={refreshing ? "spin" : ""} /></button>
          <button className="icon-button notification-button" onClick={() => notify(scanEventsSummary(data.scanEvents.length), "info")} aria-label="Сводка журнала"><Bell size={16} />{data.scanEvents.length ? <i /> : null}</button>
        </div>
      </motion.header>

      <div className="workspace-content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={activeTab} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, clipPath: "inset(0 0 4% 0)" }} animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }} transition={{ duration: reduceMotion ? 0 : 0.28 }}>
            {activeTab === "requests" ? <RequestsView orders={data.orders} mutate={mutate} notify={notify} onTransferred={selectOrder} /> : null}
            {activeTab === "design" ? <DesignView orders={data.orders} components={data.components} cuttingJobs={data.cuttingJobs} jobPanels={data.jobPanels} selectedOrderId={selectedDesignOrder} onSelectOrder={selectOrder} mutate={mutate} notify={notify} onBarcode={setBarcodeTarget} /> : null}
            {activeTab === "production" ? <ProductionView orders={data.orders} components={data.components} cuttingJobs={data.cuttingJobs} jobPanels={data.jobPanels} employees={data.employees} scanEvents={data.scanEvents} mutate={mutate} notify={notify} onBarcode={setBarcodeTarget} /> : null}
            {activeTab === "shipping" ? <ShippingView orders={data.orders} components={data.components} boxes={data.shippingBoxes} boxItems={data.shippingBoxItems} employees={data.employees} scanEvents={data.scanEvents} mutate={mutate} notify={notify} onBarcode={setBarcodeTarget} /> : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="app-footer"><span>COMSOUND / MES · прототип рабочего контура</span><span>Данные сохраняются в PostgreSQL · Ctrl + 1 / 2 / 3 / 4 — переключение разделов</span><span>{data.orders.length} заявок · {data.components.length} компонентов · {data.cuttingJobs.length} раскроев</span></footer>

      <BarcodeDialog target={barcodeTarget} onClose={() => setBarcodeTarget(null)} notify={notify} />
      <div className="toast-stack" aria-live="polite">
        <AnimatePresence>
          {toasts.map((toast) => <motion.div key={toast.id} className={`toast toast-${toast.tone}`} initial={{ opacity: 0, x: 45, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 25, scale: 0.97 }} layout>
            <span className="toast-icon">{toast.tone === "success" ? <Check size={15} /> : <CircleAlert size={15} />}</span><p>{toast.message}</p><button onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X size={13} /></button>
          </motion.div>)}
        </AnimatePresence>
      </div>
    </main>
  );
}

function scanEventsSummary(count: number) {
  return count ? `В журнале ${count} последних сканирований. Подробности — во вкладке «Производство».` : "Журнал сканирований пока пуст";
}
