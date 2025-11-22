"use client";

import { Flex, Text } from "@radix-ui/themes";

export default function ETFsPortfolio() {
  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--slate-1)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
          ETFs Portfolio
        </Text>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 p-6 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Total Value</Text>
          <Flex align="baseline" gap="2">
            <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>$324,680</Text>
            <Text size="2" style={{ color: 'var(--green-11)' }}>▲ 6.8%</Text>
          </Flex>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Annual Dividends</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--green-11)' }}>$5,842</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Avg Expense Ratio</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>0.08%</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Dividend Yield</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>1.80%</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Beta</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>0.98</Text>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Charts Grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Asset Allocation */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              ETF Categories
            </Text>
            <div className="h-48 flex items-center justify-center">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--blue-9)" strokeWidth="20" strokeDasharray="40 60" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--green-9)" strokeWidth="20" strokeDasharray="30 70" strokeDashoffset="-40" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--violet-9)" strokeWidth="20" strokeDasharray="20 80" strokeDashoffset="-70" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--orange-9)" strokeWidth="20" strokeDasharray="10 90" strokeDashoffset="-90" />
                </svg>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--blue-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>S&P 500</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>40%</Text></Flex>
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--green-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>Total Market</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>30%</Text></Flex>
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--violet-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>NASDAQ</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>20%</Text></Flex>
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--orange-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>Others</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>10%</Text></Flex>
            </div>
          </div>

          {/* Performance History */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              YTD Performance
            </Text>
            <div className="mb-2">
              <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Average Return</Text>
              <Text size="5" weight="bold" style={{ color: 'var(--green-11)' }}>+14.2%</Text>
              <Text size="1" style={{ color: 'var(--slate-11)' }}> this year</Text>
            </div>
            <div className="h-32 flex items-end gap-1">
              {[70, 72, 76, 78, 82, 85, 87, 90, 92, 94, 96, 100].map((value, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${value}%`,
                    background: 'var(--blue-9)',
                    opacity: 0.6 + (i * 0.03)
                  }}
                ></div>
              ))}
            </div>
          </div>

          {/* Cost Efficiency */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              Cost Efficiency
            </Text>
            <div className="space-y-4">
              <div>
                <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Expense Ratio</Text>
                <Text size="5" weight="bold" style={{ color: 'var(--green-11)' }}>0.08%</Text>
                <Text size="1" className="block mt-1" style={{ color: 'var(--slate-11)' }}>Excellent - Below average</Text>
              </div>
              <div>
                <Text size="2" className="mb-2 block" style={{ color: 'var(--slate-11)' }}>Annual Fee Savings</Text>
                <Text size="4" weight="bold" style={{ color: 'var(--green-11)' }}>$2,438</Text>
                <Text size="1" className="block mt-1" style={{ color: 'var(--slate-11)' }}>vs actively managed funds</Text>
              </div>
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
          <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
            Current Holdings
          </Text>
          <div className="space-y-2">
            {[
              { symbol: 'SPY', name: 'SPDR S&P 500 ETF', shares: '280', value: '$129,920', dividend: '$1,818', expense: '0.09%', change: '+7.2%', color: 'green' },
              { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', shares: '195', value: '$97,305', dividend: '$1,362', expense: '0.03%', change: '+7.3%', color: 'green' },
              { symbol: 'QQQ', name: 'Invesco QQQ Trust', shares: '140', value: '$58,800', dividend: '$470', expense: '0.20%', change: '+12.8%', color: 'green' },
              { symbol: 'VTI', name: 'Vanguard Total Stock Market', shares: '105', value: '$26,250', dividend: '$446', expense: '0.03%', change: '+6.8%', color: 'green' },
              { symbol: 'IWM', name: 'iShares Russell 2000', shares: '55', value: '$11,550', dividend: '$185', expense: '0.19%', change: '+2.1%', color: 'green' },
              { symbol: 'DIA', name: 'SPDR Dow Jones Industrial', shares: '2', value: '$855', dividend: '$14', expense: '0.16%', change: '+5.4%', color: 'green' },
            ].map((holding, i) => (
              <div key={i} className="p-3 rounded" style={{ background: 'var(--slate-3)' }}>
                <Flex justify="between" align="center">
                  <Flex align="center" gap="3" className="flex-1">
                    <div>
                      <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>{holding.symbol}</Text>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>{holding.name}</Text>
                    </div>
                  </Flex>
                  <div className="text-right mr-6">
                    <Text size="2" className="font-mono" style={{ color: 'var(--slate-11)' }}>{holding.shares}</Text>
                  </div>
                  <div className="text-right mr-6">
                    <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>{holding.value}</Text>
                  </div>
                  <div className="text-right mr-6">
                    <Text size="2" style={{ color: 'var(--green-11)' }}>{holding.dividend}</Text>
                  </div>
                  <div className="text-right mr-6">
                    <Text size="2" style={{ color: 'var(--slate-11)' }}>{holding.expense}</Text>
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
