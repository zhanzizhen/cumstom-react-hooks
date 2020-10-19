import { useState, useCallback, useEffect, useMemo } from "react";
import {
  PaginationConfig,
  SorterResult,
  TableRowSelection,
} from "antd/lib/table";
import useRefState from "./useRefState";
import useRefProp from "./useRefProp";

type OrderBy = number | string;
export type ServerFunction<T> = (p: {
  pagination: PaginationConfig | boolean;
  filters?: Record<keyof T, string[]>;
  sorter?: SorterResult<T>;

  params: {
    offset: number;
    limit: number;
    sort?: OrderBy;
    orderBy?: OrderBy;
    orderDirection?: "DESC" | "ASC";
  };
}) => Promise<{
  list: T[];
  totalSize?: number;
}>;
interface ConfigType<T extends Object> {
  /**
   * 请求数据的接口 ,
   * 约定好返回格式是{list: item[],totalSize:number}，
   * 如果后端数据不是如此，需要使用者转换一下。
   * useTable reload data的时机就是server的值发生改变的时候，所以一般server都是由useCallback包裹的
   */
  server: ServerFunction<T>;
  /**可选，默认为10 */
  pageSize?: number;
  rowKey: keyof T & (string | number);
  /**如果值为"{}"，则把状态和状态变更全权交给useTable去处理 */
  rowSelection?: Partial<TableRowSelection<T>>;
  /**是否开启Table的loading，默认不开启。因为后台管理是内网，速度够快 */
  hasLoading?: boolean;
  /**排序的字典，目的是为了自动生成排序参数 */
  sorterDic?: { [key in keyof T]?: OrderBy };
  /**后端接口的排序功能分两种：
   * 一种是orderBy+orderDirection ，支持双向排序（默认）；
   * 另一种是sort字段，只支持向下排序，需要手动在css隐藏.ant-table-column-sorter-up
   * */
  sortType?: "order" | "sort";
  /**是否支持跨页多选 */
  multiplyPageSelect?: boolean;
}
/**一个antd-table的hooks，目的是减少一些重复工作，加快开发速度 */
export function useTable<T extends Object>({
  server,
  pageSize: INITIAL_PAGESIZE = 10,
  rowKey,
  rowSelection,
  hasLoading,
  sorterDic,
  sortType,
  multiplyPageSelect,
}: ConfigType<T>) {
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(INITIAL_PAGESIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDatasource] = useState<T[]>([]);
  const [, sortRef, setSorter] = useRefState<SorterResult<T> | undefined>(
    undefined
  );
  const [, filterRef, setFilter] = useRefState<
    Record<keyof T, string[]> | undefined
  >(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[] | number[]>(
    []
  );
  /**用useRefProp确保sorterDic的值的改变不会影响逻辑 */
  const sorterDicRef = useRefProp(sorterDic);

  const serverV2 = useCallback(
    (
      pagination: PaginationConfig | boolean,
      filters?: Record<keyof T, string[]>,
      sorter?: SorterResult<T>
    ) => {
      /**根据接口规律，自动生成请求参数 */
      function generateParams() {
        let params: Parameters<ServerFunction<T>>[0]["params"] = {
          offset: 0,
          limit: pageSize,
        };
        if (typeof pagination !== "boolean") {
          const { current = 1 } = pagination;
          params.offset = (current - 1) * pageSize;
        }
        if (sorter && sorterDicRef.current) {
          if (sorterDicRef.current[sorter.field as keyof T] !== undefined) {
            const value = sorterDicRef.current[sorter.field as keyof T];
            if (sortType === "sort") {
              params.sort = value;
            } else {
              params.orderBy = value;
              params.orderDirection =
                sorter.order === "ascend" ? "ASC" : "DESC";
            }
          }
        }
        return params;
      }
      if (sorter) {
        setSorter(sorter);
      }
      if (filters) {
        setFilter(filters);
      }
      setLoading(true);
      server({ pagination, filters, sorter, params: generateParams() }).then(
        ({ list = [], totalSize: resTotal }) => {
          setLoading(false);
          setDatasource(list);
          setTotal(resTotal || list.length);
        }
      );
    },
    [pageSize, server, setFilter, setSorter, sortType, sorterDicRef]
  );

  /* 跳页、过滤、排序 */
  const onChange = useCallback(
    function(
      pagination: PaginationConfig | boolean,
      filters: Record<keyof T, string[]>,
      sorter: SorterResult<T>
    ) {
      if (typeof pagination !== "boolean") {
        setCurrent(pagination.current || 1);
        setPageSize(pagination.pageSize || pageSize);
      }
      if (rowSelection && !multiplyPageSelect) {
        setSelectedRowKeys([]);
      }
      serverV2(pagination, filters, sorter);
    },
    [multiplyPageSelect, pageSize, rowSelection, serverV2]
  );

  /**提供一个让外界主动刷新列表的api */
  const reloadTable = useCallback(
    /**loadFromFirstPage: 是否跳到第一页，默认在当前页面刷新 */
    (loadFromFirstPage?: boolean) => {
      const cur = loadFromFirstPage ? 1 : current;
      setCurrent(cur);
      serverV2({ current: cur, pageSize });
    },
    [current, pageSize, serverV2]
  );

  const rowSelectionV2: TableRowSelection<T> = useMemo(() => {
    return {
      selectedRowKeys,
      ...rowSelection,
      onChange: (
        selectedRowKeys: string[] | number[],
        selectedRows: Object[]
      ) => {
        if (rowSelection?.onChange) {
          rowSelection.onChange(selectedRowKeys, selectedRows);
        }
        setSelectedRowKeys(selectedRowKeys);
      },
    };
  }, [rowSelection, selectedRowKeys]);

  useEffect(() => {
    setCurrent(1);
    serverV2({ current: 1, pageSize }, filterRef.current, sortRef.current);
    /* 当server(filterData)或pageSize变化的时候，会重新去请求数据 */
  }, [filterRef, pageSize, serverV2, sortRef]);

  return {
    /**antd-table的props，直接放在<Table />上 */
    tableProps: {
      loading: hasLoading ? loading : undefined,
      dataSource,
      onChange,
      rowKey,
      rowSelection: rowSelection ? rowSelectionV2 : undefined,
      pagination: {
        current,
        pageSize,
        total,
      },
    },
    reloadTable,
    setDatasource,
    setSelectedRowKeys,
  };
}
