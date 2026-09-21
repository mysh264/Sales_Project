type DeliveredLine = {
  productId: string;
  fullQty: number;
};

export function sumFullQuantitiesByProduct(lines: DeliveredLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.fullQty);
  }
  return totals;
}
