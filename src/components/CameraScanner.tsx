"use client";

import { Camera, CameraOff, ScanLine, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Modal } from "@/components/ui";

type CameraStatus = "starting" | "scanning" | "error";

export function CameraScanner({
  open,
  expected,
  onClose,
  onDetected,
}: {
  open: boolean;
  expected: "employee" | "document" | "shipping";
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState<CameraStatus>("starting");
  const [error, setError] = useState("");
  const [restartKey, setRestartKey] = useState(0);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    detectedRef.current = false;
    setStatus("starting");
    setError("");

    const start = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Для камеры нужен HTTPS и браузер с поддержкой getUserMedia");
        }
        const video = videoRef.current;
        if (!video) return;

        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints);

        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video,
          (result) => {
            if (!result || detectedRef.current || cancelled) return;
            const value = result.getText().trim().toUpperCase();
            if (!value) return;
            detectedRef.current = true;
            controlsRef.current?.stop();
            if (navigator.vibrate) navigator.vibrate(80);
            onDetectedRef.current(value);
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("scanning");
      } catch (cameraError) {
        if (cancelled) return;
        const name = cameraError instanceof Error ? cameraError.name : "";
        const message = name === "NotAllowedError"
          ? "Доступ к камере запрещён. Разрешите его в настройках браузера для этого сайта и попробуйте снова."
          : name === "NotFoundError"
            ? "Камера не найдена. Код можно ввести вручную или подставить кнопкой «Скан»."
            : name === "NotReadableError"
              ? "Камера занята другим приложением. Закройте его и повторите попытку."
              : cameraError instanceof Error
                ? cameraError.message
                : "Не удалось запустить камеру";
        setError(message);
        setStatus("error");
      }
    };

    void start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [open, restartKey]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Сканирование камерой"
      eyebrow={expected === "employee" ? "Шаг 1 · Личный бейдж EMP" : expected === "shipping" ? "Комплектация · Код BOX или CS" : "Шаг 2 · Код KD или CUT"}
    >
      <div className="camera-scanner">
        <div className={`camera-viewport ${status === "scanning" ? "is-live" : ""}`}>
          <video ref={videoRef} muted playsInline aria-label="Видеопоток камеры для распознавания штрих-кода" />
          <div className="camera-reticle" aria-hidden="true"><i /><i /><i /><i /><span /></div>
          {status === "starting" ? <div className="camera-status"><Camera size={28} /><strong>Запускаем камеру…</strong><span>Разрешите доступ в запросе браузера</span></div> : null}
          {status === "error" ? <div className="camera-status camera-error"><CameraOff size={28} /><strong>Камера недоступна</strong><span>{error}</span></div> : null}
        </div>
        <div className="camera-instruction">
          <ScanLine size={18} />
          <p>{expected === "employee"
            ? "Покажите камере Code128 сотрудника. Код должен начинаться с EMP-."
            : expected === "shipping"
              ? "Сначала покажите BOX-наклейку ящика, затем CS-наклейки готовых изделий."
              : "Покажите камере Code128 документа KD или CUT. Расположите всю этикетку внутри рамки."}</p>
        </div>
        <div className="camera-privacy"><ShieldCheck size={14} />Распознавание выполняется на телефоне. Видео нигде не сохраняется.</div>
        <div className="modal-actions">
          <button className="button button-ghost" onClick={onClose}>Ввести вручную</button>
          {status === "error" ? <button className="button button-gold" onClick={() => setRestartKey((value) => value + 1)}>Повторить запуск</button> : null}
        </div>
      </div>
    </Modal>
  );
}
