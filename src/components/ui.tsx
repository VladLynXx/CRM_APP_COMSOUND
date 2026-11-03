"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronDown, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DESIGNERS } from "@/lib/domain";

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`modal-panel ${wide ? "modal-panel-wide" : ""}`}
            initial={{ opacity: 0, y: 28, scale: 0.97, clipPath: "inset(0 0 18% 0)" }}
            animate={{ opacity: 1, y: 0, scale: 1, clipPath: "inset(0 0 0% 0)" }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 330, damping: 30 }}
          >
            <div className="modal-heading">
              <div>
                {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
                <h2>{title}</h2>
              </div>
              <button className="icon-button" onClick={onClose} aria-label="Закрыть окно">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  target,
  onClose,
  onConfirm,
  title = "Удалить без возможности восстановления?",
  description,
  confirmLabel = "Да, удалить",
}: {
  target: string | null;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  return (
    <Modal open={target !== null} onClose={onClose} title={title} eyebrow="Требуется подтверждение" wide>
      <div className="confirm-body">
        <div className="warning-mark"><AlertTriangle size={34} strokeWidth={1.4} /></div>
        <div>
          <p className="confirm-target">{target}</p>
          <p className="confirm-copy">
            {description ?? "Будут удалены все связанные элементы и документы. Это действие нельзя отменить."}
          </p>
        </div>
      </div>
      <div className="modal-actions">
        <button className="button button-ghost" onClick={onClose}>Отмена</button>
        <button className="button button-danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function CardMenu({
  items,
  label = "Команды",
}: {
  items: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[];
  label?: string;
}) {
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
    <div className="card-menu" ref={root}>
      <button
        className={`menu-trigger ${open ? "is-open" : ""}`}
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <ChevronDown size={14} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="dropdown-menu"
            initial={{ opacity: 0, y: -7, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            onClick={(event) => event.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.label}
                className={item.danger ? "danger-item" : ""}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function DesignerSelect({
  value,
  onChange,
  placeholder = "Выбрать конструктора",
  compact = false,
}: {
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
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
    <div className={`designer-select ${compact ? "compact" : ""}`} ref={root}>
      <button className="select-button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span className={value ? "" : "muted"}>{value || placeholder}</span>
        <ChevronDown size={13} className={open ? "rotate-180" : ""} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="dropdown-menu designer-menu"
            initial={{ opacity: 0, y: -6, scaleY: 0.92 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
          >
            {DESIGNERS.map((designer) => (
              <button
                key={designer}
                className={designer === value ? "selected-item" : ""}
                onClick={() => {
                  onChange(designer);
                  setOpen(false);
                }}
              >
                <span>{designer}</span>
                {designer === value ? <span className="selected-dot" /> : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="add-button" onClick={onClick} aria-label={label} title={label}>
      <Plus size={16} />
    </button>
  );
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <span className="empty-cross" aria-hidden="true" />
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
