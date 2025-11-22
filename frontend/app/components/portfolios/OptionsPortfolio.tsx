"use client";

import { Flex, Text } from "@radix-ui/themes";

export default function OptionsPortfolio() {
  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--slate-1)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Options Portfolio
        </Text>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 p-6 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Total Value</Text>
          <Flex align="baseline" gap="2">
            <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>$68,450</Text>
            <Text size="2" style={{ color: 'var(--green-11)' }}>▲ 22.1%</Text>
          </Flex>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Open Positions</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>14</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Win Rate</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--green-11)' }}>71%</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Avg Return</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--green-11)' }}>+18.4%</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Greeks Delta</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>0.48</Text>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Charts Grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Strategy Mix */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              Strategy Mix
            </Text>
            <div className="h-48 flex items-center justify-center">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--green-9)" strokeWidth="20" strokeDasharray="50 50" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--blue-9)" strokeWidth="20" strokeDasharray="30 70" strokeDashoffset="-50" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--violet-9)" strokeWidth="20" strokeDasharray="20 80" strokeDashoffset="-80" />
                </svg>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--green-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>Calls</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>50%</Text></Flex>
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--blue-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>Puts</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>30%</Text></Flex>
              <Flex justify="between"><Flex gap="2"><div className="w-3 h-3 rounded" style={{ background: 'var(--violet-9)' }}></div><Text size="2" style={{ color: 'var(--slate-11)' }}>Spreads</Text></Flex><Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>20%</Text></Flex>
            </div>
          </div>

          {/* P&L Forecast */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              P&L Distribution
            </Text>
            <div className="mb-2">
              <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Expected Value</Text>
              <Text size="5" weight="bold" style={{ color: 'var(--green-11)' }}>+$15.2k</Text>
            </div>
            <div className="h-32 flex items-end gap-1">
              {[45, 62, 88, 95, 78, 55, 42].map((value, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${value}%`,
                    background: i < 3 ? 'var(--red-9)' : i === 3 ? 'var(--yellow-9)' : 'var(--green-9)',
                    opacity: 0.8
                  }}
                ></div>
              ))}
            </div>
          </div>

          {/* Risk Metrics */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              Risk Exposure
            </Text>
            <div className="space-y-3">
              <div>
                <Flex justify="between" className="mb-1">
                  <Text size="2" style={{ color: 'var(--slate-11)' }}>Delta</Text>
                  <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>0.48</Text>
                </Flex>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--slate-5)' }}>
                  <div className="h-full" style={{ width: '48%', background: 'var(--blue-9)' }}></div>
                </div>
              </div>
              <div>
                <Flex justify="between" className="mb-1">
                  <Text size="2" style={{ color: 'var(--slate-11)' }}>Gamma</Text>
                  <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>0.12</Text>
                </Flex>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--slate-5)' }}>
                  <div className="h-full" style={{ width: '12%', background: 'var(--green-9)' }}></div>
                </div>
              </div>
              <div>
                <Flex justify="between" className="mb-1">
                  <Text size="2" style={{ color: 'var(--slate-11)' }}>Theta</Text>
                  <Text size="2" weight="bold" style={{ color: 'var(--red-10)' }}>-0.28</Text>
                </Flex>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--slate-5)' }}>
                  <div className="h-full" style={{ width: '28%', background: 'var(--red-9)' }}></div>
                </div>
              </div>
              <div>
                <Flex justify="between" className="mb-1">
                  <Text size="2" style={{ color: 'var(--slate-11)' }}>Vega</Text>
                  <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>0.35</Text>
                </Flex>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--slate-5)' }}>
                  <div className="h-full" style={{ width: '35%', background: 'var(--violet-9)' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Positions */}
        <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
          <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
            Active Positions
          </Text>
          <div className="space-y-2">
            {[
              { symbol: 'SPY', type: 'Call', strike: '$580', expiry: 'Dec 15', premium: '$8,420', pnl: '+$2,340', color: 'green' },
              { symbol: 'QQQ', type: 'Put', strike: '$420', expiry: 'Dec 22', premium: '$6,250', pnl: '-$850', color: 'red' },
              { symbol: 'AAPL', type: 'Call', strike: '$195', expiry: 'Jan 19', premium: '$12,500', pnl: '+$4,200', color: 'green' },
              { symbol: 'TSLA', type: 'Put', strike: '$240', expiry: 'Dec 29', premium: '$9,100', pnl: '+$1,580', color: 'green' },
              { symbol: 'NVDA', type: 'Call Spread', strike: '$500/520', expiry: 'Jan 5', premium: '$7,800', pnl: '+$2,950', color: 'green' },
              { symbol: 'AMD', type: 'Iron Condor', strike: '$140/150', expiry: 'Dec 8', premium: '$5,400', pnl: '+$890', color: 'green' },
            ].map((position, i) => (
              <div key={i} className="p-3 rounded" style={{ background: 'var(--slate-3)' }}>
                <Flex justify="between" align="center">
                  <Flex align="center" gap="3" className="flex-1">
                    <div>
                      <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>{position.symbol}</Text>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>{position.type}</Text>
                    </div>
                  </Flex>
                  <div className="text-right mr-8">
                    <Text size="2" style={{ color: 'var(--slate-11)' }}>{position.strike}</Text>
                  </div>
                  <div className="text-right mr-8">
                    <Text size="2" style={{ color: 'var(--slate-11)' }}>{position.expiry}</Text>
                  </div>
                  <div className="text-right mr-8">
                    <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>{position.premium}</Text>
                  </div>
                  <div className="text-right">
                    <Text size="2" weight="medium" style={{ color: position.color === 'green' ? 'var(--green-11)' : 'var(--red-10)' }}>
                      {position.pnl}
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
