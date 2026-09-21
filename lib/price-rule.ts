export function priceRuleLockKeys(branchId: string, productId: string): [string, string] {
  return ["price-rule", `${branchId}:${productId}`];
}
