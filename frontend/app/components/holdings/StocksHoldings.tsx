"use client";

import { useState, useEffect, useRef } from "react";
import { Flex, Text, Button, TextField } from "@radix-ui/themes";
import { PlusIcon, TrashIcon, ArrowLeftIcon } from "@radix-ui/react-icons";
import { createChart, ColorType } from 'lightweight-charts';

interface Holding {
  id: string;
  symbol: string;
  name: string;
  quantity: string;
  avgPrice: string;
}

export default function StocksHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: "1", symbol: "AAPL", name: "Apple Inc.", quantity: "150", avgPrice: "178.50" },
    { id: "2", symbol: "MSFT", name: "Microsoft Corporation", quantity: "85", avgPrice: "385.20" },
    { id: "3", symbol: "GOOGL", name: "Alphabet Inc.", quantity: "120", avgPrice: "142.30" },
    { id: "4", symbol: "AMZN", name: "Amazon.com Inc.", quantity: "95", avgPrice: "155.80" },
    { id: "5", symbol: "TSLA", name: "Tesla Inc.", quantity: "75", avgPrice: "242.50" },
    { id: "6", symbol: "NVDA", name: "NVIDIA Corporation", quantity: "110", avgPrice: "495.75" },
  ]);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [newHolding, setNewHolding] = useState({
    symbol: "",
    name: "",
    quantity: "",
    avgPrice: "",
  });

  const addHolding = () => {
    if (newHolding.symbol && newHolding.name && newHolding.quantity && newHolding.avgPrice) {
      setHoldings([
        ...holdings,
        {
          id: Date.now().toString(),
          ...newHolding,
        },
      ]);
      setNewHolding({ symbol: "", name: "", quantity: "", avgPrice: "" });
    }
  };

  const removeHolding = (id: string) => {
    setHoldings(holdings.filter((h) => h.id !== id));
  };

  useEffect(() => {
    if (!selectedHolding || !chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111113' },
        textColor: '#B0B4BA',
      },
      grid: {
        vertLines: { color: '#2B2D31' },
        horzLines: { color: '#2B2D31' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const generateData = () => {
      const data = [];
      const basePrice = parseFloat(selectedHolding.avgPrice.replace(/,/g, ''));
      let time = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
      
      for (let i = 0; i < 30; i++) {
        const random = Math.random();
        const change = (random - 0.5) * basePrice * 0.05;
        const open = basePrice + change;
        const close = open + (Math.random() - 0.5) * basePrice * 0.03;
        const high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        const low = Math.min(open, close) - Math.random() * basePrice * 0.02;
        
        data.push({
          time: time as any,
          open: open,
          high: high,
          low: low,
          close: close,
        });
        
        time += 60 * 60 * 24;
      }
      return data;
    };

    candlestickSeries.setData(generateData());

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [selectedHolding]);

  if (selectedHolding) {
    return (
      <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--slate-1)' }}>
        {/* Header with Back Button */}
        <div className="border-b px-6 py-4" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
          <Flex align="center" gap="3">
            <Button
              variant="soft"
              onClick={() => setSelectedHolding(null)}
              style={{ cursor: 'pointer' }}
            >
              <ArrowLeftIcon /> Back
            </Button>
            <div>
              <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
                {selectedHolding.symbol}
              </Text>
              <Text size="3" className="block" style={{ color: 'var(--slate-11)' }}>
                {selectedHolding.name}
              </Text>
            </div>
          </Flex>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 p-6 border-b" style={{ borderColor: 'var(--slate-6)' }}>
          <div>
            <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Shares</Text>
            <Text size="5" weight="bold" style={{ color: 'var(--slate-12)' }}>{selectedHolding.quantity}</Text>
          </div>
          <div>
            <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Avg Price</Text>
            <Text size="5" weight="bold" style={{ color: 'var(--slate-12)' }}>${selectedHolding.avgPrice}</Text>
          </div>
          <div>
            <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Current Price</Text>
            <Text size="5" weight="bold" style={{ color: 'var(--green-11)' }}>${(parseFloat(selectedHolding.avgPrice.replace(/,/g, '')) * 1.12).toFixed(2)}</Text>
          </div>
          <div>
            <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Total Value</Text>
            <Text size="5" weight="bold" style={{ color: 'var(--slate-12)' }}>${(parseFloat(selectedHolding.quantity.replace(/,/g, '')) * parseFloat(selectedHolding.avgPrice.replace(/,/g, '')) * 1.12).toLocaleString()}</Text>
          </div>
        </div>

        {/* Chart */}
        <div className="p-6">
          <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--slate-12)' }}>
            Price Chart (Hardcoded - Alpaca Integration Coming)
          </Text>
          <div ref={chartContainerRef} className="w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--slate-1)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Stock Holdings
        </Text>
      </div>

      {/* Add New Holding Form */}
      <div className="p-6 border-b" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--slate-12)' }}>
          Add New Holding
        </Text>
        <Flex gap="3" align="end">
          <div className="flex-1">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Symbol</Text>
            <TextField.Root
              placeholder="AAPL"
              value={newHolding.symbol}
              onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value })}
            />
          </div>
          <div className="flex-2">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Name</Text>
            <TextField.Root
              placeholder="Apple Inc."
              value={newHolding.name}
              onChange={(e) => setNewHolding({ ...newHolding, name: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Quantity</Text>
            <TextField.Root
              placeholder="100"
              value={newHolding.quantity}
              onChange={(e) => setNewHolding({ ...newHolding, quantity: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Avg Price</Text>
            <TextField.Root
              placeholder="150.00"
              value={newHolding.avgPrice}
              onChange={(e) => setNewHolding({ ...newHolding, avgPrice: e.target.value })}
            />
          </div>
          <Button onClick={addHolding} style={{ background: 'var(--blue-9)', cursor: 'pointer' }}>
            <PlusIcon /> Add
          </Button>
        </Flex>
      </div>

      {/* Holdings List */}
      <div className="p-6">
        <div className="space-y-2">
          {/* Header Row */}
          <div className="grid grid-cols-[150px_2fr_150px_150px_80px] gap-4 px-4 pb-2 border-b" style={{ borderColor: 'var(--slate-6)' }}>
            <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>Symbol</Text>
            <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>Name</Text>
            <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>Quantity</Text>
            <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>Avg Price</Text>
            <Text size="2" weight="bold" style={{ color: 'var(--slate-11)' }}>Action</Text>
          </div>

          {/* Holdings Rows */}
          {holdings.map((holding) => (
            <div
              key={holding.id}
              className="grid grid-cols-[150px_2fr_150px_150px_80px] gap-4 p-4 rounded cursor-pointer transition-colors"
              style={{ background: 'var(--slate-3)' }}
              onClick={() => setSelectedHolding(holding)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--slate-4)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--slate-3)'}
            >
              <Text size="3" weight="bold" style={{ color: 'var(--slate-12)' }}>
                {holding.symbol}
              </Text>
              <Text size="3" style={{ color: 'var(--slate-11)' }}>
                {holding.name}
              </Text>
              <Text size="3" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                {holding.quantity}
              </Text>
              <Text size="3" className="font-mono" style={{ color: 'var(--slate-12)' }}>
                ${holding.avgPrice}
              </Text>
              <Button
                variant="soft"
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  removeHolding(holding.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                <TrashIcon />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
