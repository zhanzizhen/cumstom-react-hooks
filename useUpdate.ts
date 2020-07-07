import { useRef, useEffect } from "react";

/**第一次渲染不会触发，后面re-render的时候才触发，相当于class Component的componentDidUpdate */
export function useUpdate(
  effect: React.EffectCallback,
  deps?: React.DependencyList | undefined
) {
  const ref = useRef<boolean>(true);
  useEffect(() => {
    if (ref.current === true) {
      ref.current = false;
      return;
    }
    effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
