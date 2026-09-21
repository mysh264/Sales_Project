export type ProductPriceBand = {
  minPrice: string;
  maxPrice: string;
  defaultPrice: string;
};

export type CurrencyPricedProduct = {
  prices: Record<string, ProductPriceBand>;
};

const ZERO_PRICE_BAND: ProductPriceBand = {
  minPrice: "0.000",
  maxPrice: "0.000",
  defaultPrice: "0.000",
};

export function priceBandForCurrency(
  product: CurrencyPricedProduct,
  currency: string,
  fallbackCurrency?: string,
): ProductPriceBand {
  return (
    product.prices[currency] ??
    (fallbackCurrency ? product.prices[fallbackCurrency] : undefined) ??
    Object.values(product.prices)[0] ??
    ZERO_PRICE_BAND
  );
}
