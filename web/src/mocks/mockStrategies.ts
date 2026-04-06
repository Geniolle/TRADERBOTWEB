// web/src/mocks/mockStrategies.ts

import type { MarketStrategyInput } from "../types/strategy";

export const mockMarketStrategyInput: MarketStrategyInput = {
  trendLabel: "Baixa",
  trendConfidence: 93,

  currentPrice: 1.15108,

  adxValue: 20.46,
  adxDirectionLabel: "A descer",

  rsiValue: 43.95,

  macdLine: -0.000094,
  macdSignal: -0.000047,
  macdHistogram: -0.000047,
  macdBiasLabel: "Pressão vendedora",

  volumeLabel: "Volume inconclusivo",

  cloudBiasLabel: "Preço abaixo da nuvem",
  cloudTop: 1.151585,
  cloudBase: 1.151325,

  ema9: 1.151151,
  ema21: 1.151261,
  sma200: 1.151892,
};