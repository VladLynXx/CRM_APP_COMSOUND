"use client";

import { Download, Maximize2, Minus, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { OrderData } from "@/lib/domain";

export function SketchDrawing({ order }: { order: OrderData }) {
  const patternId = useId().replace(/:/g, "");
  const columns = 5 + (order.sketchVariant % 2);
  const rows = 4 + (order.sketchVariant === 2 ? 1 : 0);
  const length = 10600 + order.sketchVariant * 400;
  const height = 6212 + order.sketchVariant * 180;
  const panelWidth = 318 / columns;
  const panelHeight = 188 / rows;

  return (
    <svg
      className="sketch-svg"
      viewBox="0 0 1000 700"
      role="img"
      aria-label={`Демонстрационный эскиз звукоизоляционного экрана для заявки ${order.title}`}
    >
      <defs>
        <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#31393a" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1000" height="700" fill="#f2f0e9" />
      <rect x="20" y="20" width="960" height="660" fill="none" stroke="#20292b" strokeWidth="2" />
      <rect x="28" y="28" width="944" height="644" fill="none" stroke="#20292b" strokeWidth="0.7" />

      <g stroke="#20292b" fill="none" strokeWidth="1.4">
        <text x="68" y="64" fill="#20292b" stroke="none" fontSize="13" letterSpacing="2">ФАСАД · М 1:100</text>
        <line x1="92" y1="96" x2="92" y2="326" />
        <line x1="410" y1="96" x2="410" y2="326" />
        <line x1="92" y1="82" x2="410" y2="82" />
        <line x1="92" y1="76" x2="92" y2="90" />
        <line x1="410" y1="76" x2="410" y2="90" />
        <text x="208" y="73" fill="#20292b" stroke="none" fontSize="13">{length}</text>
        <line x1="76" y1="96" x2="58" y2="96" />
        <line x1="76" y1="326" x2="58" y2="326" />
        <line x1="64" y1="96" x2="64" y2="326" />
        <text x="51" y="245" fill="#20292b" stroke="none" fontSize="13" transform="rotate(-90 51 245)">{height}</text>
        <rect x="92" y="96" width="318" height="188" fill="#d7d9d4" />
        {Array.from({ length: columns + 1 }, (_, index) => (
          <line key={`v-${index}`} x1={92 + panelWidth * index} y1="96" x2={92 + panelWidth * index} y2="284" />
        ))}
        {Array.from({ length: rows + 1 }, (_, index) => (
          <line key={`h-${index}`} x1="92" y1={96 + panelHeight * index} x2="410" y2={96 + panelHeight * index} />
        ))}
        <rect x="92" y="284" width="318" height="42" fill={`url(#${patternId})`} />
        <path d="M82 326 L422 326 L443 340" strokeWidth="2" />
        <text x="102" y="310" fill="#20292b" stroke="none" fontSize="9">НЕСУЩИЙ КАРКАС</text>
        <path d="M276 118 L450 70 L490 70" />
        <text x="454" y="60" fill="#20292b" stroke="none" fontSize="10">ЗВУКОИЗОЛЯЦИОННАЯ</text>
        <text x="454" y="73" fill="#20292b" stroke="none" fontSize="10">ПАНЕЛЬ COMSOUND–80</text>
      </g>

      <g transform="translate(510 100)" stroke="#20292b" strokeWidth="1.25" fill="none">
        <text x="0" y="-36" fill="#20292b" stroke="none" fontSize="13" letterSpacing="2">АКСОНОМЕТРИЯ</text>
        <polygon points="10,90 218,20 345,78 136,151" fill="#dedfd9" />
        <polygon points="136,151 345,78 345,216 136,292" fill="#c2c7c2" />
        <polygon points="10,90 136,151 136,292 10,225" fill="#e6e5df" />
        {Array.from({ length: 6 }, (_, index) => (
          <line key={`iso-v-${index}`} x1={136 + index * 41.8} y1={151 - index * 14.6} x2={136 + index * 41.8} y2={292 - index * 14.6} />
        ))}
        {Array.from({ length: 5 }, (_, index) => (
          <line key={`iso-h-${index}`} x1="136" y1={151 + index * 35.25} x2="345" y2={78 + index * 34.5} />
        ))}
        {Array.from({ length: 4 }, (_, index) => (
          <line key={`iso-side-${index}`} x1={10 + index * 42} y1={90 + index * 20.3} x2={10 + index * 42} y2={225 + index * 22.3} />
        ))}
        <polygon points="-8,228 137,301 368,218 390,231 137,326 -22,244" fill="#63c7d6" fillOpacity="0.42" />
        <line x1="20" y1="226" x2="20" y2="287" strokeWidth="3" />
        <line x1="128" y1="289" x2="128" y2="332" strokeWidth="3" />
        <line x1="336" y1="216" x2="336" y2="263" strokeWidth="3" />
        <path d="M320 118 L395 74 L430 74" />
        <text x="352" y="59" fill="#20292b" stroke="none" fontSize="10">СТ3ПС, 1 ММ</text>
        <path d="M62 220 L-18 280 L-18 304" />
        <text x="-12" y="320" fill="#20292b" stroke="none" fontSize="10">СТОЙКА КАРКАСА</text>
      </g>

      <g transform="translate(66 390)" stroke="#20292b" strokeWidth="1.25" fill="none">
        <text x="0" y="-18" fill="#20292b" stroke="none" fontSize="13" letterSpacing="2">РАЗРЕЗ A–A · М 1:50</text>
        <rect x="0" y="0" width="78" height="178" fill={`url(#${patternId})`} />
        <line x1="118" y1="20" x2="118" y2="170" strokeWidth="4" />
        <line x1="228" y1="4" x2="228" y2="158" strokeWidth="4" />
        <path d="M118 20 L228 4 L250 18 L250 172 L118 172 Z" fill="#d8dad5" />
        {Array.from({ length: 5 }, (_, index) => (
          <line key={`section-${index}`} x1="118" y1={20 + index * 38} x2="250" y2={18 + index * 38} />
        ))}
        <line x1="88" y1="20" x2="88" y2="4" />
        <line x1="88" y1="4" x2="228" y2="4" />
        <text x="139" y="-5" fill="#20292b" stroke="none" fontSize="11">3442</text>
        <path d="M250 65 L320 44 L366 44" />
        <text x="275" y="30" fill="#20292b" stroke="none" fontSize="10">МИН. ВАТА 80 ММ</text>
        <path d="M250 130 L320 151 L366 151" />
        <text x="273" y="171" fill="#20292b" stroke="none" fontSize="10">СТЕКЛОТКАНЬ</text>
        <line x1="-12" y1="186" x2="280" y2="186" strokeWidth="2" />
      </g>

      <g transform="translate(505 402)" stroke="#20292b" strokeWidth="1" fill="none">
        <text x="0" y="-20" fill="#20292b" stroke="none" fontSize="12" letterSpacing="1.6">ПРИМЕЧАНИЯ</text>
        <text x="0" y="0" fill="#20292b" stroke="none" fontSize="10">1. Размеры приведены для предварительного согласования.</text>
        <text x="0" y="18" fill="#20292b" stroke="none" fontSize="10">2. Панели соединяются с каркасом болтами М12.</text>
        <text x="0" y="36" fill="#20292b" stroke="none" fontSize="10">3. Материал элементов каркаса — сталь Ст3пс.</text>
        <text x="0" y="54" fill="#20292b" stroke="none" fontSize="10">4. Покраска изделий — по согласованию с заказчиком.</text>
        <text x="0" y="72" fill="#157f96" stroke="none" fontSize="10" fontWeight="700">ДЕМОНСТРАЦИОННЫЙ ЭСКИЗ · НЕ ДЛЯ ПРОИЗВОДСТВА</text>
      </g>

      <g transform="translate(505 548)" stroke="#20292b" fill="none" strokeWidth="1">
        <rect width="447" height="104" />
        <line x1="0" y1="27" x2="447" y2="27" />
        <line x1="0" y1="74" x2="447" y2="74" />
        <line x1="92" y1="0" x2="92" y2="104" />
        <line x1="326" y1="27" x2="326" y2="104" />
        <line x1="380" y1="27" x2="380" y2="104" />
        <text x="12" y="18" fill="#20292b" stroke="none" fontSize="9">РАЗРАБ.  {order.developer ?? "—"}</text>
        <text x="104" y="18" fill="#20292b" stroke="none" fontSize="9">МЕНЕДЖЕР  {order.manager}</text>
        <text x="106" y="51" fill="#20292b" stroke="none" fontSize="15" letterSpacing="1">{order.title.toUpperCase()}</text>
        <text x="106" y="67" fill="#20292b" stroke="none" fontSize="9">{order.nomenclature || "НОМЕНКЛАТУРА НЕ УКАЗАНА"}</text>
        <text x="337" y="48" fill="#20292b" stroke="none" fontSize="9">ЛИСТ</text>
        <text x="390" y="48" fill="#20292b" stroke="none" fontSize="9">ФОРМАТ</text>
        <text x="343" y="66" fill="#20292b" stroke="none" fontSize="11">1</text>
        <text x="395" y="66" fill="#20292b" stroke="none" fontSize="11">A3</text>
        <text x="106" y="94" fill="#20292b" stroke="none" fontSize="17" letterSpacing="6">ЭСКИЗ</text>
        <text x="338" y="94" fill="#20292b" stroke="none" fontSize="9">COMSOUND / КБ</text>
      </g>
    </svg>
  );
}

export function SketchPreview({
  order,
  compact = false,
  onOpen,
}: {
  order: OrderData;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const container = useRef<HTMLDivElement>(null);

  const download = () => {
    const svg = container.current?.querySelector("svg");
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Эскиз-${order.title}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`sketch-preview ${compact ? "sketch-compact" : ""}`} ref={container}>
      {!compact ? (
        <div className="sketch-toolbar">
          <div>
            <span className="status-dot" />
            <span>Эскиз · {order.title}</span>
          </div>
          <div className="sketch-tools">
            <button onClick={() => setZoom((value) => Math.max(0.7, value - 0.15))} aria-label="Уменьшить"><Minus size={15} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((value) => Math.min(2.2, value + 0.15))} aria-label="Увеличить"><Plus size={15} /></button>
            <button onClick={download} aria-label="Скачать SVG"><Download size={15} /></button>
            {onOpen ? <button onClick={onOpen} aria-label="Открыть на весь экран"><Maximize2 size={15} /></button> : null}
          </div>
        </div>
      ) : null}
      <div className="sketch-canvas">
        <div className="sketch-zoom" style={{ transform: `scale(${zoom})` }}>
          <SketchDrawing order={order} />
        </div>
      </div>
    </div>
  );
}
