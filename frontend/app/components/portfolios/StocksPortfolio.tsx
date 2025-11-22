"use client";

import { Flex, Text } from "@radix-ui/themes";

export default function StocksPortfolio() {
  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--slate-1)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Stocks Portfolio
        </Text>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 p-6 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Balance</Text>
          <Flex align="baseline" gap="2">
            <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>$485,240</Text>
            <Text size="2" style={{ color: 'var(--green-11)' }}>▲ 8.2%</Text>
          </Flex>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Annual Dividends</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--green-11)' }}>$12,845</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Dividend Yield</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>2.65%</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Yield on Cost</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>3.24%</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Beta</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>0.92</Text>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Charts Grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Sector Allocation */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              Sector Diversification
            </Text>
            <div className="h-48 flex items-center justify-center">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--blue-9)" strokeWidth="20" strokeDasharray="35 65" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--green-9)" strokeWidth="20" strokeDasharray="25 75" strokeDashoffset="-35" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--orange-9)" strokeWidth="20" strokeDasharray="20 80" strokeDashoffset="-60" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--violet-9)" strokeWidth="20" strokeDasharray="20 80" strokeDashoffset="-80" />
                </svg>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--blue-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>Technology</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>35%</Text></Flex>
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--green-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>Healthcare</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>25%</Text></Flex>
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--orange-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>Financials</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>20%</Text></Flex>
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--violet-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>Consumer</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>20%</Text></Flex>
            </div>
          </div>

          {/* Dividend Growth */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              Dividend Growth
            </Text>
            <div className="mb-2">
              <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Last 5 Years</Text>
              <Text size="5" weight="bold" style={{ color: 'var(--green-11)' }}>8.4%</Text>
              <Text size="1" style={{ color: 'var(--slate-11)' }}> per year</Text>
            </div>
            <div className="h-32 flex items-end gap-1">
              {[70, 75, 82, 88, 95].map((value, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${value}%`,
                    background: 'var(--green-9)',
                    opacity: 0.6 + (i * 0.1)
                  }}
                ></div>
              ))}
            </div>
          </div>

          {/* Dividend Safety */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              Dividend Safety
            </Text>
            <div className="h-32 flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--slate-5)" strokeWidth="10" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--green-9)" strokeWidth="10" strokeDasharray="251.2" strokeDashoffset="37.68" className="transform -rotate-90 origin-center" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <Text size="6" weight="bold" style={{ color: 'var(--green-11)' }}>85%</Text>
                </div>
              </div>
            </div>
            <Flex align="center" gap="2" className="mt-2 justify-center">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--green-9)' }}></div>
              <Text size="2" style={{ color: 'var(--slate-11)' }}>is likely safe</Text>
            </Flex>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
          <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
            Current Holdings
          </Text>
          <div className="space-y-2">
            {[
              { symbol: 'AAPL', name: 'Apple Inc.', shares: '850', value: '$148,750', dividend: '$742', change: '+5.2%', color: 'green' },
              { symbol: 'MSFT', name: 'Microsoft Corp.', shares: '650', value: '$242,450', dividend: '$1,690', change: '+7.8%', color: 'green' },
              { symbol: 'GOOGL', name: 'Alphabet Inc.', shares: '180', value: '$25,020', dividend: '$0', change: '+3.1%', color: 'green' },
              { symbol: 'AMZN', name: 'Amazon.com Inc.', shares: '95', value: '$16,245', dividend: '$0', change: '-1.2%', color: 'red' },
              { symbol: 'TSLA', name: 'Tesla Inc.', shares: '120', value: '$31,200', dividend: '$0', change: '+12.4%', color: 'green' },
              { symbol: 'NVDA', name: 'NVIDIA Corp.', shares: '45', value: '$21,575', dividend: '$18', change: '+18.9%', color: 'green' },
            ].map((holding, i) => (
              <div key={i} className="p-3 rounded" style={{ background: 'var(--slate-3)' }}>
                <Flex justify="between" align="center">
                  <Flex align="center" gap="3" className="flex-1">
                    <div>
                      <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>{holding.symbol}</Text>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>{holding.name}</Text>
                    </div>
                  </Flex>
                  <div className="text-right mr-8">
                    <Text size="2" className="font-mono" style={{ color: 'var(--slate-11)' }}>{holding.shares} shares</Text>
                  </div>
                  <div className="text-right mr-8">
                    <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>{holding.value}</Text>
                  </div>
                  <div className="text-right mr-8">
                    <Text size="2" style={{ color: 'var(--green-11)' }}>{holding.dividend}</Text>
                  </div>
                  <div className="text-right">
                    <Text size="2" weight="medium" style={{ color: holding.color === 'green' ? 'var(--green-11)' : 'var(--red-10)' }}>
                      {holding.change}
                    </Text>
                  </div>
                </Flex>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
