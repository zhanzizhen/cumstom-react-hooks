import { useEffect, useState, useCallback } from "react";
import _ from "lodash";
import { AxiosPromise } from "axios";
import { SelectProps, SelectValue } from "antd/lib/select";

interface ParamsType<T> {
  /**一个有固定格式的server */
  server: (v: {
    keyword?: string;
    offset: number;
    limit: number;
  }) => AxiosPromise<T[]>;
  /**把上层传给你Select的props都放入allProps，很简单，就是allProps: this.props */
  allProps: SelectProps;
  initialValue?: SelectProps["value"];
  /**默认为true;
   * 是否开启远程动态搜索，如果否，则会在首次mounted的时候去请求一次，后面不会则不会再请求 */
  searchRemote?: boolean;
}

/**基于antd-Select封装一个受控的组件，经常需要处理以下几点事情：
 * 1. 防抖 2. 请求remote数据并写入状态 3. 处理props.value和props.onChange
 * useSearchSelect这个custom hooks的意义在于消灭上述这些重复劳动
 */
const useSearchSelect = <T>({
  server,
  allProps,
  initialValue,
  searchRemote = true,
}: ParamsType<T>) => {
  const [value, setValue] = useState<SelectProps["value"]>(
    allProps.value || initialValue || []
  );
  const [dataSource, setDataSource] = useState<T[]>([]);
  const onSearch = useCallback(
    _.debounce((value: string) => {
      if (searchRemote === true) {
        server({ keyword: value, offset: 0, limit: 10 }).then(res => {
          setDataSource(res);
        });
      }
    }, 300),
    []
  );

  const onChange: SelectProps["onChange"] = useCallback(
    (value: SelectValue, option: any) => {
      if (!("value" in allProps)) {
        setValue(value);
      }
      if (allProps.onChange) {
        allProps.onChange(value, option);
      }
    },
    [allProps]
  );

  useEffect(() => {
    if ("value" in allProps) {
      setValue(allProps.value);
    }
  }, [allProps, allProps.value]);

  useEffect(() => {
    if (!searchRemote) {
      server({ keyword: "", offset: 0, limit: 100 }).then(res => {
        setDataSource(res);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchRemote]);
  return {
    selectProps: {
      ...allProps,
      value,
      onSearch: searchRemote ? onSearch : undefined,
      onChange,
    },
    dataSource,
  };
};

export default useSearchSelect;
