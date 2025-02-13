// hooks/useUniqueUnits.ts
import { useMemo } from 'react';
import { Item } from '@/types/inventory';
import _ from 'lodash';

export const useUniqueUnits = (items: Item[]) => {
  const uniqueUnits = useMemo(() => {
    return _.uniq(items
      .map(item => item.unit)
      .filter((unit): unit is string => Boolean(unit)))
      .sort();
  }, [items]);

  return uniqueUnits;
};