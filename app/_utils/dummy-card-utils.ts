export function createDummyCards(size: number) {
  return Array.from({ length: size }, (_, index) => {
    const market_price = Math.random() * 100; // Random price between 0 and 100
    const prev_market_price = Math.random() * 100; // Random previous price
    const dollar_diff_market_price = market_price - prev_market_price;
    const diff_market_price =
      prev_market_price === 0
        ? market_price > 0
          ? Infinity
          : 0
        : (dollar_diff_market_price / prev_market_price) * 100;

    return {
      id: index + 1,
      name: `Dummy Card ${index + 1}`,
      clean_name: `Dummy Card ${index + 1}`,
      image_url: `/images/pkmn-card-back.png`,
      set_name: 'Dummy Set',
      market_price: parseFloat(market_price.toFixed(2)),
      prev_market_price: parseFloat(prev_market_price.toFixed(2)),
      diff_market_price: parseFloat(diff_market_price.toFixed(2)),
      dollar_diff_market_price: parseFloat(dollar_diff_market_price.toFixed(2)),
      currentPrice: parseFloat(market_price.toFixed(2)),
      priceChange: diff_market_price,
      priceChangePercentage: Math.abs(diff_market_price),
    };
  });
}

export function createDummyDashboardData() {
  return {
    canAccessCompetitive: false,
    lowRangeMovers: Math.round(Math.random() * 1025),
    midRangeMovers: Math.round(Math.random() * 100),
    highRangeMovers: Math.round(Math.random() * 140),
    topMoversLowRange: createDummyCards(5),
    topMoversMidRange: createDummyCards(5),
    topMoversHighRange: createDummyCards(5),
  };
}
