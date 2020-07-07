import { useEffect, useRef, useState } from "react";
​
const useRefState = <T>(
  initialValue: T
): [T, React.MutableRefObject<T>, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(initialValue);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  return [state, stateRef, setState];
};
​
export default useRefState;
