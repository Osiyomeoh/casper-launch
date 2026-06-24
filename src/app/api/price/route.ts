import { NextResponse } from "next/server";

export const revalidate = 60; // cache 60s

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/casper-network?localization=false&tickers=false&community_data=false",
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error("CoinGecko error");
    const data = await res.json();
    const m = data.market_data;
    return NextResponse.json({
      price: m.current_price.usd,
      change24h: m.price_change_percentage_24h,
      marketCap: m.market_cap.usd,
      volume24h: m.total_volume.usd,
      circulatingSupply: m.circulating_supply,
    });
  } catch (e) {
    return NextResponse.json({ error: "price unavailable" }, { status: 503 });
  }
}
