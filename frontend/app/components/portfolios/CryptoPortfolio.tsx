"use client";

import { Flex, Text } from "@radix-ui/themes";

export default function CryptoPortfolio() {
  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--slate-1)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
        <Text size="8" weight="bold" style={{ color: 'var(--slate-12)' }}>
          Crypto Portfolio
        </Text>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 p-6 border-b" style={{ borderColor: 'var(--slate-6)' }}>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Balance</Text>
          <Flex align="baseline" gap="2">
            <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>$247,832</Text>
            <Text size="2" style={{ color: 'var(--green-11)' }}>▲ 12.4%</Text>
          </Flex>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>24h Change</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--green-11)' }}>+$8,341</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Total Gain</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--green-11)' }}>28.5%</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Win Rate</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>67%</Text>
        </div>
        <div>
          <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Beta</Text>
          <Text size="6" weight="bold" style={{ color: 'var(--slate-12)' }}>1.24</Text>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Charts Grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Portfolio Allocation */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              Asset Allocation
            </Text>
            <div className="h-48 flex items-center justify-center">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--orange-9)" strokeWidth="20" strokeDasharray="75 25" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--blue-9)" strokeWidth="20" strokeDasharray="50 50" strokeDashoffset="-75" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--violet-9)" strokeWidth="20" strokeDasharray="30 70" strokeDashoffset="-125" />
                </svg>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <Flex justify="between" align="center">
                <Flex align="center" gap="2">
                  <div className="w-3 h-3 rounded" style={{ background: 'var(--orange-9)' }}></div>
                  <Text size="2" style={{ color: 'var(--slate-11)' }}>Bitcoin</Text>
                </Flex>
                <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>45%</Text>
              </Flex>
              <Flex justify="between" align="center">
                <Flex align="center" gap="2">
                  <div className="w-3 h-3 rounded" style={{ background: 'var(--blue-9)' }}></div>
                  <Text size="2" style={{ color: 'var(--slate-11)' }}>Ethereum</Text>
                </Flex>
                <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>30%</Text>
              </Flex>
              <Flex justify="between" align="center">
                <Flex align="center" gap="2">
                  <div className="w-3 h-3 rounded" style={{ background: 'var(--violet-9)' }}></div>
                  <Text size="2" style={{ color: 'var(--slate-11)' }}>Others</Text>
                </Flex>
                <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>25%</Text>
              </Flex>
            </div>
          </div>

          {/* Growth Chart */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              Portfolio Growth
            </Text>
            <div className="mb-2">
              <Text size="2" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Last 12 Months</Text>
              <Text size="5" weight="bold" style={{ color: 'var(--green-11)' }}>+42.3%</Text>
              <Text size="1" style={{ color: 'var(--slate-11)' }}> per year</Text>
            </div>
            <div className="h-32 flex items-end gap-1">
              {[65, 58, 72, 68, 85, 92, 88, 95, 105, 98, 112, 120].map((value, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${value}%`,
                    background: 'var(--green-9)',
                    opacity: 0.7 + (i * 0.025)
                  }}
                ></div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="p-4 rounded border" style={{ background: 'var(--slate-2)', borderColor: 'var(--slate-6)' }}>
            <Text size="3" weight="bold" className="mb-4 block" style={{ color: 'var(--blue-11)' }}>
              Performance
            </Text>
            <div className="space-y-3">
              <div>
                <Flex justify="between" className="mb-1">
                  <Text size="2" style={{ color: 'var(--slate-11)' }}>BTC</Text>
                  <Text size="2" style={{ color: 'var(--green-11)' }}>May be overvalued</Text>
                </Flex>
                <div className="text-xs font-mono" style={{ color: 'var(--slate-11)' }}>5 Year Average: +234%</div>
              </div>
              <div>
                <Flex justify="between" className="mb-1">
                  <Text size="2" style={{ color: 'var(--slate-11)' }}>ETH</Text>
                  <Text size="2" style={{ color: 'var(--green-11)' }}>Performing well</Text>
                </Flex>
                <div className="text-xs font-mono" style={{ color: 'var(--slate-11)' }}>5 Year Average: +189%</div>
              </div>
              <div>
                <Flex justify="between" className="mb-1">
                  <Text size="2" style={{ color: 'var(--slate-11)' }}>SOL</Text>
                  <Text size="2" style={{ color: 'var(--green-11)' }}>Strong momentum</Text>
                </Flex>
                <div className="text-xs font-mono" style={{ color: 'var(--slate-11)' }}>5 Year Average: +412%</div>
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
              { symbol: 'BTC', name: 'Bitcoin', amount: '3.5 BTC', value: '$111,598', change: '+12.4%', color: 'green' },
              { symbol: 'ETH', name: 'Ethereum', amount: '28.2 ETH', value: '$74,349', change: '+8.2%', color: 'green' },
              { symbol: 'SOL', name: 'Solana', amount: '450 SOL', value: '$38,250', change: '+15.7%', color: 'green' },
              { symbol: 'ADA', name: 'Cardano', amount: '12,500 ADA', value: '$15,625', change: '-2.3%', color: 'red' },
              { symbol: 'AVAX', name: 'Avalanche', amount: '280 AVAX', value: '$5,320', change: '+5.1%', color: 'green' },
              { symbol: 'MATIC', name: 'Polygon', amount: '3,200 MATIC', value: '$2,688', change: '+3.4%', color: 'green' },
            ].map((holding, i) => (
              <div key={i} className="p-3 rounded transition-colors" style={{ background: 'var(--slate-3)' }}>
                <Flex justify="between" align="center">
                  <Flex align="center" gap="3" className="flex-1">
                    <div>
                      <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>{holding.symbol}</Text>
                      <Text size="1" style={{ color: 'var(--slate-11)' }}>{holding.name}</Text>
                    </div>
                  </Flex>
                  <div className="text-right mr-8">
                    <Text size="2" className="font-mono" style={{ color: 'var(--slate-11)' }}>{holding.amount}</Text>
                  </div>
                  <div className="text-right mr-8">
                    <Text size="2" weight="medium" style={{ color: 'var(--slate-12)' }}>{holding.value}</Text>
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
