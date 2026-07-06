import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";
import { EMA, MACD, RSI } from "trading-signals";

type HistoricalRow = {
  close: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Default to Reliance Industries (NSE) if no symbol is passed
  const symbol = searchParams.get("symbol") || "RELIANCE.NS";

  try {
    // 1. Fetch 30 days of daily historical bars
    const queryOptions = { period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    const historicalData = (await yahooFinance.historical(symbol, queryOptions)) as HistoricalRow[];

    if (!historicalData || historicalData.length === 0) {
      return NextResponse.json({ error: "No market data found for this symbol." }, { status: 404 });
    }

    // 2. Isolate closing values
    const closes = historicalData.map((day) => day.close);
    const currentPrice = closes[closes.length - 1];

    // 3. Instantiate mathematical indicators
    const rsi = new RSI(14);
    const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));

    // 4. Feed data chronologically into the engines
    closes.forEach((price) => {
      rsi.add(price);
      macd.add(price);
    });

    // 5. Compute momentum outputs
    const rsiValue = rsi.getResult() ?? 0;
    const macdValue = macd.getResult() ?? { histogram: 0, macd: 0, signal: 0 };

    let rsiSignal = "Neutral";
    if (rsiValue < 30) rsiSignal = "Oversold (Accumulation Zone)";
    if (rsiValue > 70) rsiSignal = "Overbought (Distribution Zone)";

    let macdSignal = "Neutral";
    if (macdValue.histogram > 0) macdSignal = "Bullish Acceleration";
    if (macdValue.histogram < 0) macdSignal = "Bearish Deceleration";

    return NextResponse.json({
      symbol,
      currentPrice,
      technicalSignals: {
        RSI: parseFloat(rsiValue.toFixed(2)),
        RSISignal: rsiSignal,
        MACD_Histogram: parseFloat(macdValue.histogram.toFixed(2)),
        MACDSignal: macdSignal,
      }
    });

  } catch (error) {
    console.error("MarketForge Processing Error:", error);
    return NextResponse.json({ error: "Failed to compile algorithmic metrics" }, { status: 500 });
  }
}