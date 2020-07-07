import { useEffect, useState, useCallback } from "react";
import history from "src/utils/history";

export enum CacheKey {
  /**首页分类标签 */
  WEB_CATEGORY_LABEL,
  /**动态分类 */
  DYNAMIC_CATEGORY,
}

const cacheMap: { [k: number]: any } = {};
/**一个可以缓存状态的组件，可以节约请求。提供了清除缓存的能力 */
export default function useCacheState<T>(
  initialState: T,
  cacheKey: CacheKey,
  getState: (set: React.Dispatch<React.SetStateAction<T>>) => void,
  autoClearCacheWhenHistoryChange?: boolean
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [data, priviteSetData] = useState<T>(
    cacheMap[cacheKey] !== undefined ? cacheMap[cacheKey] : initialState
  );

  const setDataV2: React.Dispatch<React.SetStateAction<T>> = useCallback(
    v => {
      priviteSetData(v);
      cacheMap[cacheKey] = v;
    },
    [cacheKey]
  );

  /**清除缓存 */
  const clearCache = useCallback(() => {
    delete cacheMap[cacheKey];
  }, [cacheKey]);

  useEffect(() => {
    if (cacheMap[cacheKey] === undefined) {
      getState(setDataV2); //获取状态
    }
  }, [cacheKey, getState, setDataV2]);

  useEffect(() => {
    if (!autoClearCacheWhenHistoryChange) {
      return;
    }
    return history.listen(clearCache);
  }, [autoClearCacheWhenHistoryChange, clearCache]);

  return [data, setDataV2, clearCache];
}
