"use client";

import { useState, useEffect } from "react";
import SideMenu from "./components/SideMenu";
import TopBar from "./components/TopBar";
import ChartArea from "./components/ChartArea";
import AgentProfileCard from "./components/AgentProfileCard";
import PolymarketPanel from "./components/PolymarketPanel";
import SocialSentimentPanel from "./components/SocialSentimentPanel";
import TradingPanel from "./components/TradingPanel";
import IconSidebar from "./components/IconSidebar";
import AgentChatModal from "./components/AgentChatModal";
import CryptoPortfolio from "./components/portfolios/CryptoPortfolio";
import StocksPortfolio from "./components/portfolios/StocksPortfolio";
import OptionsPortfolio from "./components/portfolios/OptionsPortfolio";
import ETFsPortfolio from "./components/portfolios/ETFsPortfolio";
import CryptoHoldings from "./components/holdings/CryptoHoldings";
import StocksHoldings from "./components/holdings/StocksHoldings";
import OptionsHoldings from "./components/holdings/OptionsHoldings";
import ETFsHoldings from "./components/holdings/ETFsHoldings";

type SubredditOption = "All" | "r/wallstreetbets" | "r/cryptocurrency" | "r/bitcoin";
type PortfolioView = "crypto" | "stocks" | "options" | "etfs" | null;
type HoldingsView = "crypto-holdings" | "stocks-holdings" | "options-holdings" | "etfs-holdings" | null;

const subredditOptions: SubredditOption[] = ["All", "r/wallstreetbets", "r/cryptocurrency", "r/bitcoin"];

const subredditData: Record<SubredditOption, { 
  stats: { score: number; bullish: number; bearish: number; neutral: number }; 
  posts: Array<{ time: string; author: string; snippet: string; sentiment: string }> 
}> = {
  "All": {
    stats: { score: 24, bullish: 68, bearish: 18, neutral: 14 },
    posts: [
      { time: "2m ago", author: "u/cryptowhale", snippet: "BTC breaking out. This is not a drill. Load up now before...", sentiment: "bullish" },
      { time: "5m ago", author: "u/tradingpro", snippet: "Volume looking weak. Expecting pullback to 95k support...", sentiment: "bearish" },
      { time: "12m ago", author: "u/moonboy", snippet: "100k by Christmas. Diamond hands only. HODL the line!", sentiment: "bullish" },
    ]
  },
  "r/wallstreetbets": {
    stats: { score: 32, bullish: 75, bearish: 15, neutral: 10 },
    posts: [
      { time: "1m ago", author: "u/yolomaster", snippet: "YOLO'd my entire portfolio into BTC calls. Moon or bust! 🚀", sentiment: "bullish" },
      { time: "8m ago", author: "u/beargang", snippet: "Short squeeze incoming. Bears are getting rekt.", sentiment: "bullish" },
    ]
  },
  "r/cryptocurrency": {
    stats: { score: 18, bullish: 62, bearish: 22, neutral: 16 },
    posts: [
      { time: "3m ago", author: "u/hodler4life", snippet: "This rally feels different. Institutional money is here.", sentiment: "bullish" },
      { time: "10m ago", author: "u/technicalanalyst", snippet: "RSI showing overbought. Expecting consolidation.", sentiment: "bearish" },
    ]
  },
  "r/bitcoin": {
    stats: { score: 28, bullish: 71, bearish: 16, neutral: 13 },
    posts: [
      { time: "4m ago", author: "u/satoshinakamoto", snippet: "Not your keys, not your coins. Time to self-custody.", sentiment: "bullish" },
      { time: "15m ago", author: "u/maximilist", snippet: "Number go up technology working as intended.", sentiment: "bullish" },
    ]
  }
};

export default function Home() {
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [agentExpanded, setAgentExpanded] = useState(false);
  const [sentimentExpanded, setSentimentExpanded] = useState(false);
  const [tradingPanelOpen, setTradingPanelOpen] = useState(true);
  const [activeTradingTab, setActiveTradingTab] = useState<"risk" | "trade" | "portfolio" | "history">("trade");
  const [riskLevel] = useState<"low" | "medium" | "high">("high");
  const [currentPrice] = useState("98,742.31");
  const [currentTime, setCurrentTime] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [positionSize, setPositionSize] = useState("0.5");
  const [tradeType, setTradeType] = useState<"long" | "short">("long");
  const [stopLoss, setStopLoss] = useState("97,200");
  const [takeProfit, setTakeProfit] = useState("100,500");
  const [messages, setMessages] = useState<Array<{ role: "agent" | "user"; text: string; time: string }>>([
    { role: "agent", text: "Hey trader! I'm watching BTC/USD for you. Ask me anything about the markets! 💹", time: "14:30:12" },
    { role: "user", text: "What's the market looking like?", time: "14:30:45" },
    { role: "agent", text: "BTC just broke resistance at $98.5k with crazy volume! Polymarket odds jumped +12% in 5 min - whales are moving. This could be big! 🚀", time: "14:31:01" },
  ]);
  const [selectedSubreddit, setSelectedSubreddit] = useState<SubredditOption>(subredditOptions[0]);
  const [subredditDropdownOpen, setSubredditDropdownOpen] = useState(false);
  const [activePortfolio, setActivePortfolio] = useState<PortfolioView>(null);
  const [activeHoldings, setActiveHoldings] = useState<HoldingsView>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setSentimentExpanded(false);
  }, [selectedSubreddit]);

  const polymarkets = [
    { question: "Bitcoin > $100k by Dec 31", probability: 68, change: "+12%", volume: "2.4M" },
    { question: "BTC to hit $120k in 2025", probability: 42, change: "+8%", volume: "1.8M" },
    { question: "Bitcoin ETF approval", probability: 89, change: "-2%", volume: "5.1M" },
    { question: "BTC above $90k EOY", probability: 76, change: "+5%", volume: "3.2M" },
  ];
  const activeSubreddit = subredditData[selectedSubreddit];
  const fallbackSentiment = subredditData["All"].stats;
  const sentimentStats = activeSubreddit?.stats ?? fallbackSentiment;
  const sentimentScoreLabel = sentimentStats.score > 0 ? `+${sentimentStats.score}` : `${sentimentStats.score}`;
  const redditPosts = activeSubreddit?.posts ?? [];
  const currentSubredditLink =
    selectedSubreddit === "All" ? "https://reddit.com/r/all" : `https://reddit.com/${selectedSubreddit}`;

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    const newUserMsg = {
      role: "user" as const,
      text: messageInput,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMsg]);
    setMessageInput("");

    setTimeout(() => {
      const agentResponse = {
        role: "agent" as const,
        text: "Let me check the charts for you... 📊",
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setMessages(prev => [...prev, agentResponse]);
    }, 500);
  };

  return (
    <main className="h-screen w-screen overflow-hidden" style={{ background: 'var(--slate-1)' }}>
      <TopBar currentPrice={currentPrice} currentTime={currentTime} />

      {/* Side Menu */}
      <SideMenu 
        isOpen={sideMenuOpen} 
        onToggle={() => setSideMenuOpen(!sideMenuOpen)}
        onPortfolioSelect={(portfolio) => {
          setActivePortfolio(portfolio);
          setActiveHoldings(null);
          setSideMenuOpen(false);
        }}
        onHoldingsSelect={(holdings) => {
          setActiveHoldings(holdings);
          setActivePortfolio(null);
          setSideMenuOpen(false);
        }}
      />

      <div 
        className="grid h-[calc(100vh-3rem)] gap-0 transition-all duration-200" 
        style={{
          gridTemplateColumns: tradingPanelOpen ? '1fr 280px 40px' : '1fr 40px',
        }}
      >
        {/* LEFT COLUMN: Chart/Portfolio/Holdings + Data Feeds */}
        <div className="flex flex-col">
          {activePortfolio === null && activeHoldings === null ? (
            <>
              <ChartArea />
              {/* Bottom Data Panels */}
              <div className="h-56 border-t border-r grid grid-cols-[200px_1fr_1fr] gap-0" style={{ borderColor: 'var(--slate-6)' }}>
                <AgentProfileCard onClick={() => setAgentExpanded(!agentExpanded)} />
                <PolymarketPanel markets={polymarkets} />
                <SocialSentimentPanel 
                  posts={redditPosts} 
                  expanded={sentimentExpanded} 
                  onClick={() => setSentimentExpanded(!sentimentExpanded)} 
                />
              </div>
            </>
          ) : activePortfolio !== null ? (
            <>
              {activePortfolio === "crypto" && <CryptoPortfolio />}
              {activePortfolio === "stocks" && <StocksPortfolio />}
              {activePortfolio === "options" && <OptionsPortfolio />}
              {activePortfolio === "etfs" && <ETFsPortfolio />}
            </>
          ) : (
            <>
              {activeHoldings === "crypto-holdings" && <CryptoHoldings />}
              {activeHoldings === "stocks-holdings" && <StocksHoldings />}
              {activeHoldings === "options-holdings" && <OptionsHoldings />}
              {activeHoldings === "etfs-holdings" && <ETFsHoldings />}
            </>
          )}
        </div>

        {/* TRADING PANEL */}
        {tradingPanelOpen && (
          <TradingPanel
            activeTradingTab={activeTradingTab}
            tradeType={tradeType}
            setTradeType={setTradeType}
            positionSize={positionSize}
            setPositionSize={setPositionSize}
            currentPrice={currentPrice}
            stopLoss={stopLoss}
            setStopLoss={setStopLoss}
            takeProfit={takeProfit}
            setTakeProfit={setTakeProfit}
          />
        )}

        {/* ICON SIDEBAR */}
        <IconSidebar
          activeTradingTab={activeTradingTab}
          riskLevel={riskLevel}
          tradingPanelOpen={tradingPanelOpen}
          onTabChange={(tab) => {
            setActiveTradingTab(tab);
            setTradingPanelOpen(true);
          }}
        />
      </div>

      {/* AI Agent Chatbot Modal */}
      <AgentChatModal
        isOpen={agentExpanded}
        onClose={() => setAgentExpanded(false)}
        messages={messages}
        messageInput={messageInput}
        setMessageInput={setMessageInput}
        onSendMessage={handleSendMessage}
      />
    </main>
  );
}
