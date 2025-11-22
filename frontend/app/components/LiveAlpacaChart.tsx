"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi } from "lightweight-charts";
import { useAlpacaWebSocket } from "@/hooks/useAlpacaWebSocket";
import type { AlpacaMessage, AlpacaBar } from "@/lib/websocket";
import { transformBarToChartData } from "@/lib/alpacaDataTransform";

interface LiveChartProps {
  symbol: string;
  dataType: "crypto" | "stocks" | "options" | "etfs";
}

export default function LiveAlpacaChart({ symbol, dataType }: LiveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);

  // Handle incoming Alpaca messages
  const handleMessage = (message: AlpacaMessage) => {
    if (message.type === "connected") {
      setIsConnected(true);
      console.log(message.message);
    } else if (message.type === "bar" && message.data.symbol === symbol) {
      const barData = message.data as AlpacaBar;
      setLastPrice(barData.close);

      // Update chart with new data
      if (seriesRef.current) {
        const chartData = transformBarToChartData(barData);
        seriesRef.current.update(chartData as any);
      }
    } else if (message.type === "error") {
      console.error("WebSocket error:", message.message);
      setIsConnected(false);
    }
  };

  // Use the WebSocket hook
  const { subscribe, unsubscribe, isConnected: checkConnection } = useAlpacaWebSocket({
    symbols: [symbol],
    dataType,
    onMessage: handleMessage,
    autoConnect: true,
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#111113" },
        textColor: "#B0B4BA",
      },
      grid: {
        vertLines: { color: "#2B2D31" },
        horzLines: { color: "#2B2D31" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--slate-12)" }}>
            {symbol}
          </h2>
          {lastPrice !== null && (
            <p className="text-lg" style={{ color: "var(--green-11)" }}>
              ${lastPrice.toFixed(2)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{
              backgroundColor: isConnected ? "var(--green-9)" : "var(--red-9)",
            }}
          />
          <span style={{ color: "var(--slate-11)" }}>
            {isConnected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
