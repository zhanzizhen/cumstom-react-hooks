import React, { useEffect, useRef, useCallback } from "react";
import { createCx } from "utils";
import { prefix } from "./AutoFillInput.scss";
import { Input } from "antd";
import axios, { AxiosRequestConfig } from "axios";
import { InputProps, SearchProps } from "antd/lib/input";
import mentionconfig from "./mention.config";
import useRefState from "src/hooks/useRefState";
import NameSpaceMap from "./nameSpace";

const cx = createCx(prefix);

function isContainer(
  target: EventTarget,
  containerRef: React.RefObject<HTMLElement>
): boolean {
  if (target === containerRef.current) {
    return true;
  }
  const { parentNode } = target as any;
  if (!parentNode) {
    return false;
  }
  if (parentNode === containerRef.current) {
    return true;
  } else if (parentNode === document.body) {
    return false;
  } else {
    return isContainer(parentNode, containerRef);
  }
}

interface iProps extends InputProps {
  nameSpace: NameSpaceMap;
  defaultValue?: string;
  value?: string;
  className?: string;
  style?: React.CSSProperties;
  onSearch?: SearchProps["onSearch"];
}
/* 查看 ./readme.md 可以了解该组件 */

function AutoFillInputCreator(searchMode: boolean) {
  const AutoFillInput: React.FunctionComponent<iProps> = props => {
    const {
      onFocus,
      /**存储的key值，可跨页面共享 */
      nameSpace,
      value,
      onChange,
      className,
      style,
      defaultValue,
      ...restProps
    } = props;
    const [, dataRef, setData] = useRefState<string[]>([]);
    const [visible, visibleRef, setVisible] = useRefState(false);
    const [currentFocus, currentFocusRef, setCurrentFocus] = useRefState(-1);
    const [myValue, myvalueRef, setMyValue] = useRefState<string | undefined>(
      "value" in props ? value : defaultValue
    );
    const [, hasChangeByUserRef, setHasChangeByUser] = useRefState(false);
    const rootRef = useRef<HTMLSpanElement>(null);
    const mentionsRef = useRef<HTMLUListElement>(null);

    if (process.env.NODE_ENV !== "production") {
      if (nameSpace === undefined) {
        throw new Error(
          "you should specify the nameSpace when using AutoFillInput"
        );
      }
      if (!(nameSpace in NameSpaceMap)) {
        throw new Error("nameSpace must be the one from NameSpaceMap");
      }
    }

    const onSuperFocus = useCallback(
      function(event: React.FocusEvent<HTMLInputElement>) {
        // if (hasChangeByUserRef.current === false) {
        //   setHasChangeByUser(true);
        // }
        setVisible(true);
        onFocus && onFocus(event);
      },
      [onFocus, setVisible]
    );

    const onSuperChange = useCallback(
      function(event: React.ChangeEvent<HTMLInputElement>) {
        if (hasChangeByUserRef.current === false) {
          setHasChangeByUser(true);
        }
        setMyValue(event.target.value);
        onChange && onChange(event);
      },
      [hasChangeByUserRef, onChange, setHasChangeByUser, setMyValue]
    );

    /**将输入值保存到localStorage */
    const storeData = useCallback(
      (newValueToBeStore: string) => {
        const _data = dataRef.current.slice();
        const index = _data.indexOf(newValueToBeStore);
        if (index !== -1) {
          _data.splice(index, 1);
        }
        _data.unshift(newValueToBeStore);
        setData(_data);
        localStorage.setItem(nameSpace, JSON.stringify(_data));
      },
      [dataRef, nameSpace, setData]
    );

    const getDataFromStorage: () => string[] = useCallback(() => {
      const d = localStorage.getItem(nameSpace);
      if (d) {
        const result = JSON.parse(d);
        if (Array.isArray(result)) {
          return result;
        } else {
          console.error("json parse localstorage出错");
          return [];
        }
      }
      return [];
    }, [nameSpace]);

    const getFilterData: () => string[] = useCallback(() => {
      let values = dataRef.current
        .filter(item => item.includes(myvalueRef.current || ""))
        .slice(0, mentionconfig.maxMentionCount);
      // 当只有一个项时，且改项完全和输入框的值相等，那就没必要展示它了
      if (values.length === 1 && values[0] === myvalueRef.current) {
        return [];
      }
      return values;
    }, [dataRef, myvalueRef]);

    const detectWords = useCallback(
      (config: AxiosRequestConfig) => {
        // console.log('detectWords');
        const { current: _myValue } = myvalueRef;
        if (!_myValue) {
          return;
        }
        // it is unnecessary to store it again
        if (_myValue === dataRef.current[0]) {
          return;
        }
        if (hasChangeByUserRef.current !== true) {
          return;
        }
        let target;
        if (config.method === "get") {
          target = config.params;
        } else {
          target = config.data;
        }
        const targetType = typeof target;
        // debugger;
        if (targetType === "object") {
          const values = Object.values(target);
          /**检查是否包含在请求参数的值里面，是的话则缓存它 */
          const isShot = values.some(item => {
            switch (typeof item) {
              case "object":
                return item !== null && JSON.stringify(item).includes(_myValue);
              case "string":
                return item.includes(_myValue);
              case "number":
                return item === Number(_myValue);
              default:
                return false;
            }
          });
          if (isShot) {
            storeData(_myValue);
          }
        } else {
          console.error("there is an unkown param type", target);
        }
      },
      [dataRef, hasChangeByUserRef, myvalueRef, storeData]
    );

    useEffect(() => {
      // axios intercepor for detect keywords of user's input
      const myInterceptor = axios.interceptors.request.use(function(
        config: AxiosRequestConfig
      ) {
        detectWords(config);
        return config;
      });
      return () => axios.interceptors.request.eject(myInterceptor);
    }, [detectWords]);

    useEffect(() => {
      // fetch data from local
      setData(getDataFromStorage());
    }, [getDataFromStorage, setData]);

    useEffect(() => {
      // be reponsible to the change of value-property
      if (value !== undefined && value !== myvalueRef.current) {
        setMyValue(value || "");
      }
    }, [myvalueRef, setMyValue, value]);

    useEffect(() => {
      if (!rootRef.current) {
        return;
      }
      // 处理方向键和回车键
      function handleKeyDown(e: KeyboardEvent) {
        const cur = currentFocusRef.current;
        const filterData = getFilterData();
        if (e.keyCode === 40) {
          /*If the arrow DOWN key is pressed, increase the currentFocus index:*/
          if (cur === filterData.length - 1) {
            setCurrentFocus(0);
          } else {
            setCurrentFocus(cur + 1);
          }
        } else if (e.keyCode === 38) {
          /*If the arrow UP key is pressed, decrease the currentFocus index:*/
          if (cur === 0 || cur === -1) {
            // 边缘情况，移动到最后一个
            setCurrentFocus(filterData.length - 1);
          } else {
            // 向上移动一位
            setCurrentFocus(cur - 1);
          }
        } else if (e.keyCode === 13) {
          /*If the ENTER key is pressed, prevent the form from being submitted,*/
          if (cur >= 0 && cur <= filterData.length - 1) {
            e.preventDefault();
            setMyValue(filterData[cur]);
            setVisible(false);
          }
        }
      }
      const rootDom = rootRef.current;
      /*execute a function presses a key on the keyboard:*/
      rootDom.addEventListener("keydown", handleKeyDown);
      return () => rootDom.removeEventListener("keydown", handleKeyDown);
    }, [
      currentFocusRef,
      getFilterData,
      setCurrentFocus,
      setMyValue,
      setVisible,
    ]);

    useEffect(() => {
      const rootDom = rootRef.current;
      if (!rootDom) {
        return;
      }
      /**关闭联想 */
      function handleCloseMention(e: DocumentEventMap["click"]) {
        if (e.target && isContainer(e.target, rootRef)) {
          return;
        }
        if (visibleRef.current === true) {
          setVisible(false);
          if (currentFocusRef.current !== -1) {
            setCurrentFocus(-1);
          }
        }
      }

      /**点击联想 */
      function handleClickMentionItem(e: MouseEvent) {
        if (e.target && isContainer(e.target, mentionsRef)) {
          e.stopPropagation();
          e.preventDefault();
          const target = (rootRef.current as HTMLElement).querySelector(
            "input"
          ) as HTMLInputElement;
          let imitateTarget: any = {};
          for (const p in target) {
            imitateTarget[p] = target[p as keyof HTMLInputElement];
          }
          imitateTarget.value = (e.target as any).innerText;
          //  it is a hack for input change event
          const imitateEvent = {
            target: imitateTarget,
            currentTarget: target,
            bubbles: true,
            cancelable: false,
            defaultPrevented: false,
            isTrusted: true,
            isDefaultPrevented: false,
            isPropagationStopped: false,
          };
          onSuperChange(imitateEvent as any);
          rootDom?.querySelector("input")?.focus();
          setVisible(false);
        }
      }

      rootDom.addEventListener("click", handleClickMentionItem);
      document.addEventListener("click", handleCloseMention);

      return () => {
        rootDom.removeEventListener("click", handleClickMentionItem);
        document.removeEventListener("click", handleCloseMention);
      };
    }, [
      currentFocusRef,
      onSuperChange,
      setCurrentFocus,
      setVisible,
      visibleRef,
    ]);

    const filterData = getFilterData();
    const SuperInput = searchMode ? Input.Search : Input;
    return (
      <span
        style={style}
        className={`${prefix} ${className || ""}`}
        ref={rootRef}
      >
        <SuperInput
          autoComplete="off"
          onFocus={onSuperFocus}
          value={myValue}
          onChange={onSuperChange}
          {...restProps}
        />
        {filterData.length > 0 && (
          <ul
            className={cx("mentions")}
            ref={mentionsRef}
            style={{ display: visible ? "block" : "none" }}
          >
            {filterData.map((str, index) => (
              <li
                className={cx(
                  "mentions__item",
                  index === currentFocus ? "mentions__item--active" : ""
                )}
                key={str}
              >
                {str}
              </li>
            ))}
          </ul>
        )}
      </span>
    );
  };
  return AutoFillInput;
}
/**一个具有输入历史的Antd-Input */
const AutoFillInput = AutoFillInputCreator(false);
/**一个具有输入历史的Antd-Input.Search */
const AutoFillSearch = AutoFillInputCreator(true);

export { AutoFillSearch, AutoFillInput, NameSpaceMap };

