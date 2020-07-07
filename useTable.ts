import { useState, useCallback, useEffect, useMemo } from "react";
import {
  PaginationConfig,
  SorterResult,
  TableRowSelection,
} from "antd/lib/table";

type serverFunction<T> = (
  pagination: PaginationConfig | boolean,
  filters?: Record<keyof T, string[]>,
  sorter?: SorterResult<T>
) => Promise<{
  list: T[];
  totalSize?: number;
}>;
/**一个antd-table的hooks，目的是减少一些重复工作，加快开发速度 */
export function useTable<T extends Object>({
  server,
  pageSize: initalPageSize,
  rowKey,
  rowSelection,
  hasLoading,
}: {
  /**
   * 请求数据的接口 ,
   * 约定好返回格式是{list: item[],totalSize:number}，
   * 如果后端数据不是如此，需要使用者转换一下
   */
  server: serverFunction<T>;
  /**可选，默认为10 */
  pageSize?: number;
  rowKey: keyof T & (string | number);
  /**如果值为"{}"，则把状态和状态变更全权交给useTable去处理 */
  rowSelection?: Partial<TableRowSelection<T>>;
  /**是否开启Table的loading，默认不开启。因为后台管理是内网，速度够快 */
  hasLoading?: boolean;
}) {
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(initalPageSize || 10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDatasource] = useState<T[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[] | number[]>(
    []
  );

  const serverV2 = useCallback(
    (
      pagination: PaginationConfig | boolean,
      filters?: Record<keyof T, string[]>,
      sorter?: SorterResult<T>
    ) => {
      setLoading(true);
      server(pagination, filters, sorter).then(
        ({ list = [], totalSize: resTotal }) => {
          setLoading(false);
          setDatasource(list);
          setTotal(resTotal || list.length);
        }
      );
    },
    [server]
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
      if (rowSelection) {
        setSelectedRowKeys([]);
      }
      serverV2(pagination, filters, sorter);
    },
    [pageSize, rowSelection, serverV2]
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
    serverV2({ current: 1, pageSize });
    /* 当server或pageSize变化的时候，会重新去请求数据 */
  }, [pageSize, serverV2]);

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
  };
}
