export default function useCache<T extends (...a: any) => AxiosPromise<any>>(
  request: T
) {
  type b =(...a: any) => AxiosPromise<any>;
  type c = ReturnType<b>;
  type d = ReturnType<T> extends AxiosPromise<infer K>?K:never;
  let shouldUseCache = true;
  let cacheResponse: any;

  function requestV2(...anything: Parameters<T>) {
    if (shouldUseCache) {
      if (cacheResponse) {
        return Promise.resolve(cacheResponse);
      } else {
        return request(...anything).then(res => (cacheResponse = res));
      }
    }
    return request(...anything);
  }
  requestV2.disableCache = function disableCache() {
    shouldUseCache = false;
  };
  requestV2.enableCache = function enableCache() {
    shouldUseCache = true;
  };
  return requestV2;
}
