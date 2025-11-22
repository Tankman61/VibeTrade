"use client";

import { Flex, Text } from "@radix-ui/themes";
import { useState } from "react";

interface TopBarProps {
  currentPrice: string;
  currentTime: string;
}

export default function TopBar({ currentPrice, currentTime }: TopBarProps) {
  const [selectedRange, setSelectedRange] = useState("6M");
  const timeRanges = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "All"];

  return (
    <div className="h-12 border-b flex items-center px-4 justify-between" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
      <Flex align="center" gap="4">
        <Text size="4" weight="bold" className="font-mono" style={{ color: 'var(--slate-12)' }}>
          BTC/USD
        </Text>
        <div className="h-4 w-px" style={{ background: 'var(--slate-6)' }}></div>
        <Text size="1" style={{ color: 'var(--slate-11)' }}>
          BITSTAMP
        </Text>
        <Text size="3" weight="bold" className="font-mono ml-4" style={{ color: 'var(--green-11)' }}>
          {currentPrice}
        </Text>
        <Text size="1" style={{ color: 'var(--green-11)' }}>
          +0.92%
        </Text>
      </Flex>
      <Flex align="center" gap="2">
        {/* Date Range Selector */}
        <div className="flex items-center gap-1 px-2">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: selectedRange === range ? 'var(--slate-5)' : 'transparent',
                color: selectedRange === range ? 'var(--slate-12)' : 'var(--slate-11)',
              }}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="h-4 w-px" style={{ background: 'var(--slate-6)' }}></div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green-9)' }}></div>
          <Text size="1" className="font-mono" style={{ color: 'var(--slate-11)' }}>
            {currentTime || "00:00:00"} UTC
          </Text>
        </div>
      </Flex>
    </div>
  );
}
