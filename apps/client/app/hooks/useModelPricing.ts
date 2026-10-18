import { useCallback, useEffect, useState } from 'react';

import type { modelProviderType } from 'utils';
import { loadPriceTable, resolveModelPrice, type PriceTable } from '@/utils/model-pricing';

/** Public model prices for cost estimates. Until they load (or if they fail) no price resolves. */
const useModelPricing = () => {
  const [table, setTable] = useState<PriceTable | null>(null);

  useEffect(() => {
    let active = true;
    loadPriceTable()
      .then((prices) => {
        if (active) setTable(prices);
      })
      .catch((error) => {
        console.warn('Model prices are unavailable; cost estimates are hidden.', error);
      });
    return () => {
      active = false;
    };
  }, []);

  const getPrice = useCallback(
    (model: string, provider: modelProviderType) =>
      table ? resolveModelPrice(table, model, provider) : undefined,
    [table]
  );

  return { getPrice, hasPrices: table !== null };
};

export default useModelPricing;
