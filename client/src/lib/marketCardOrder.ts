export type SortableMarketCard = {
  ticker: string;
  showAsCard: boolean;
};

export function orderMarketCards<T extends SortableMarketCard>(market: T[], cardOrder: string[]): T[] {
  return [...market.filter(item => item.showAsCard)].sort((left, right) => {
    const leftIndex = cardOrder.indexOf(left.ticker);
    const rightIndex = cardOrder.indexOf(right.ticker);
    if (leftIndex === -1 && rightIndex === -1) return 0;
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function moveMarketCard(currentOrder: string[], ticker: string, targetTicker: string): string[] {
  if (ticker === targetTicker) return currentOrder;
  const next = [...currentOrder];
  const sourceIndex = next.indexOf(ticker);
  const targetIndex = next.indexOf(targetTicker);
  if (sourceIndex === -1 || targetIndex === -1) return currentOrder;
  next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, ticker);
  return next;
}
