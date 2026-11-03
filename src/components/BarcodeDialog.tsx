"use client";

import JsBarcode from "jsbarcode";
import { Check, Copy, Download, FileCode2, Printer, ScanBarcode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import type { BarcodeTarget, Notify } from "@/components/types";

export function BarcodeDialog({
  target,
  onClose,
  notify,
}: {
  target: BarcodeTarget | null;
  onClose: () => void;
  notify: Notify;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!target || !svgRef.current) return;
    JsBarcode(svgRef.current, target.code, {
      format: "CODE128",
      displayValue: true,
      text: target.code,
      fontSize: 17,
      font: "monospace",
      height: 92,
      width: 2.2,
      margin: 18,
      background: "#f4f1e8",
      lineColor: "#11181b",
    });
    setCopied(false);
  }, [target]);

  const renderPng = async () => {
    const svg = svgRef.current;
    if (!svg || !target) throw new Error("Этикетка ещё не построена");
    const source = new XMLSerializer().serializeToString(svg);
    const svgUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Не удалось подготовить изображение"));
        image.src = svgUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1000, image.width * 2);
      canvas.height = Math.max(330, image.height * 2);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas недоступен");
      context.fillStyle = "#f4f1e8";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG не создан")), "image/png");
      });
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  };

  const copyPng = async () => {
    if (!target) return;
    try {
      if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
        await navigator.clipboard.writeText(target.code);
        notify("Копирование PNG недоступно в этом браузере — текст кода скопирован", "info");
        return;
      }
      const blob = await renderPng();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      notify("PNG штрих-кода скопирован в буфер обмена");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        await navigator.clipboard.writeText(target.code);
        notify("Браузер запретил копирование изображения — скопирован текст кода", "info");
      } catch {
        notify("Не удалось получить доступ к буферу обмена. Скачайте PNG", "error");
      }
    }
  };

  const downloadPng = async () => {
    if (!target) return;
    try {
      const blob = await renderPng();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${target.code}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      notify("PNG этикетки скачан");
    } catch {
      notify("Не удалось создать PNG. Попробуйте скачать SVG", "error");
    }
  };

  const downloadSvg = () => {
    if (!target || !svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${target.code}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("SVG этикетки скачан");
  };

  const printLabel = () => {
    if (!target || !svgRef.current) return;
    const printWindow = window.open("", "_blank", "width=760,height=560");
    if (!printWindow) {
      notify("Браузер заблокировал окно печати. Разрешите всплывающие окна или скачайте PNG", "error");
      return;
    }
    const source = new XMLSerializer().serializeToString(svgRef.current);
    printWindow.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Этикетка COMSOUND</title><style>@page{margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111}main{width:95mm;margin:0 auto;text-align:center}h2{margin:0 0 3mm;font-size:15pt;font-weight:500}p{margin:0 0 5mm;font-size:9pt;color:#444}.code{padding:4mm;border:1px solid #bbb}.code svg{display:block;width:100%;height:auto}@media print{body{print-color-adjust:exact}}</style></head><body><main><h2 id="label-title"></h2><p id="label-subtitle"></p><div class="code">${source}</div></main></body></html>`);
    printWindow.document.close();
    const title = printWindow.document.getElementById("label-title");
    const subtitle = printWindow.document.getElementById("label-subtitle");
    if (title) title.textContent = target.title;
    if (subtitle) subtitle.textContent = target.subtitle;
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);
  };

  const copyCode = async () => {
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.code);
      notify("Текст кода скопирован");
    } catch {
      notify("Скопируйте код вручную из поля под этикеткой", "error");
    }
  };

  return (
    <Modal open={target !== null} onClose={onClose} title="Персональная этикетка" eyebrow="CODE128 · Готово к печати" wide>
      {target ? (
        <div className="barcode-dialog-body">
          <div className="barcode-meta">
            <div className="barcode-kind"><ScanBarcode size={20} />{target.kind}</div>
            <div>
              <h3>{target.title}</h3>
              <p>{target.subtitle}</p>
            </div>
          </div>
          <div className="barcode-paper">
            <svg ref={svgRef} aria-label={`Штрих-код ${target.code}`} />
          </div>
          <button className="barcode-code" onClick={copyCode} title="Скопировать текст кода">
            <span>{target.code}</span><Copy size={14} />
          </button>
          <p className="barcode-hint">Код постоянный и уникальный. Для печати используйте SVG — качество не зависит от масштаба.</p>
          <div className="barcode-actions">
            <button className="button button-gold" onClick={copyPng}>
              {copied ? <Check size={15} /> : <Copy size={15} />}Скопировать PNG
            </button>
            <button className="button button-ghost" onClick={printLabel}><Printer size={15} />Печать</button>
            <button className="button button-ghost" onClick={downloadPng}><Download size={15} />PNG</button>
            <button className="button button-ghost" onClick={downloadSvg}><FileCode2 size={15} />SVG</button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
