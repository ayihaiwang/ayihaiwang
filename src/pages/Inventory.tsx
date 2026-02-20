import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Switch, message, Dropdown, Select, DatePicker, Drawer, Spin, Divider } from 'antd';
import { DownloadOutlined, PrinterOutlined, FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ColumnType } from 'antd/es/table';
import type { ResizeCallbackData } from 'react-resizable';
import type { StockRow } from '../vite-env.d';
import { useCompanyName } from '../contexts/CompanyNameContext';
import { exportInventoryToPDF, exportInventoryToExcel, printInventory } from '../utils/inventoryExport';
import { ResizableTitle } from '../components/ResizableTitle';
import {
  getInventoryColumnWidths,
  setInventoryColumnWidths,
  clearInventoryColumnWidths,
  DEFAULT_INVENTORY_COLUMN_WIDTHS,
} from '../utils/inventoryColumnWidths';
import dayjs, { Dayjs } from 'dayjs';

const SEARCH_FIELDS = [
  { label: '物品名称', value: 'name' },
  { label: '规格型号', value: 'spec' },
  { label: '入库日期', value: 'in_date' },
  { label: '分类', value: 'category_name' },
] as const;


interface ItemDetailData {
  item: { id: number; name: string; spec: string | null; unit: string; category_name: string | null; min_stock?: number };
  stock: { qty: number; updated_at?: string };
  last_inbound_at: string | null;
  outbounds: Array<{
    doc_id: number | null;
    doc_no: string | null;
    biz_date: string;
    occurred_at: string;
    qty: number;
    operator_name: string | null;
    remark: string | null;
  }>;
}

interface MoveRow {
  created_at: string;
  move_type: string;
  qty_delta: number;
  doc_no: string | null;
  doc_id: number | null;
  operator_name: string | null;
  remark: string | null;
}

const CATEGORY_ALL = '';

export default function Inventory() {
  const { companyName } = useCompanyName();
  const [list, setList] = useState<StockRow[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StockRow | null>(null);
  const [form] = Form.useForm();
  const [categoryFilter, setCategoryFilter] = useState<string>(CATEGORY_ALL);
  const [searchField, setSearchField] = useState<string>('name');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => getInventoryColumnWidths());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<ItemDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMoves, setDetailMoves] = useState<MoveRow[]>([]);

  const load = (params?: {
    qField?: string;
    q?: string;
    date_from?: string;
    date_to?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    if (params?.qField) queryParams.append('qField', params.qField);
    if (params?.q) queryParams.append('q', params.q);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const query = queryParams.toString();
    const url = query ? `/stocks?${query}` : '/stocks';
    window.electronAPI.stocks.list(url).then((data: any) => {
      setList(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch((e) => {
      console.error('加载库存失败:', e);
      setList([]);
      setLoading(false);
    });
  };

  useEffect(() => {
    load({
      qField: searchField === 'in_date' ? 'in_date' : (searchField as any),
      q: searchField !== 'in_date' ? searchKeyword : undefined,
      date_from: searchField === 'in_date' && dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
      date_to: searchField === 'in_date' && dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      sortBy: sortKey as any,
      sortOrder: sortDir,
    });
  }, [searchField, searchKeyword, dateRange, sortKey, sortDir]);
  useEffect(() => {
    window.electronAPI.categories?.list?.()
      .then((data: any) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  const sortableKeys = ['name', 'category_name', 'spec', 'qty', 'last_in_date', 'updated_at'];

  const filteredAndSorted = useMemo(() => {
    let data = [...list];
    // 前端只做分类过滤（后端已处理搜索和排序）
    if (categoryFilter !== CATEGORY_ALL) {
      const match = categoryFilter === '__未分类__' ? '' : categoryFilter;
      data = data.filter((row: StockRow) => (row.category_name ?? '') === match);
    }
    return data;
  }, [list, categoryFilter]);

  const categoryOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [{ label: '全部', value: CATEGORY_ALL }];
    categories.forEach((c) => opts.push({ label: c.name, value: c.name }));
    const hasUncategorized = list.some((row) => (row.category_name ?? '').trim() === '');
    if (hasUncategorized) opts.push({ label: '未分类', value: '__未分类__' });
    return opts;
  }, [categories, list]);

  const handleResize = useCallback((key: string) => (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
    setColumnWidths((prev) => ({ ...prev, [key]: size.width }));
  }, []);

  const saveColumnWidths = useCallback(() => {
    setInventoryColumnWidths(columnWidths);
    message.success('已保存当前列宽');
  }, [columnWidths]);

  const restoreDefaultColumnWidths = useCallback(() => {
    clearInventoryColumnWidths();
    setColumnWidths({ ...DEFAULT_INVENTORY_COLUMN_WIDTHS });
    message.success('已恢复默认列宽');
  }, []);

  const handleSearch = useCallback(() => {
    load({
      qField: searchField === 'in_date' ? 'in_date' : (searchField as any),
      q: searchField !== 'in_date' ? searchKeyword : undefined,
      date_from: searchField === 'in_date' && dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
      date_to: searchField === 'in_date' && dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      sortBy: sortKey as any,
      sortOrder: sortDir,
    });
  }, [searchField, searchKeyword, dateRange, sortKey, sortDir]);

  const baseColumns: ColumnType<StockRow>[] = [
    { title: '物资名称', dataIndex: 'name', key: 'name', sorter: true, showSorterTooltip: { title: '点击切换升序/降序/取消排序' } },
    { title: '分类', dataIndex: 'category_name', key: 'category_name', sorter: true, showSorterTooltip: { title: '点击切换升序/降序/取消排序' }, render: (v: string) => v || '未分类' },
    { title: '规格型号', dataIndex: 'spec', key: 'spec', sorter: true, showSorterTooltip: { title: '点击切换升序/降序/取消排序' }, render: (v: string) => v || '-' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    {
      title: '当前库存',
      dataIndex: 'qty',
      key: 'qty',
      sorter: true,
      showSorterTooltip: { title: '点击切换升序/降序/取消排序' },
      render: (qty: number, row: StockRow) =>
        row.min_stock > 0 && qty < row.min_stock ? <span style={{ color: 'red' }}>{qty} (低于预警)</span> : qty,
    },
    { title: '最低预警', dataIndex: 'min_stock', key: 'min_stock' },
    { title: '最近入库日期', dataIndex: 'last_in_date', key: 'last_in_date', sorter: true, showSorterTooltip: { title: '点击切换升序/降序/取消排序' }, render: (v: string) => v || '-' },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', sorter: true, showSorterTooltip: { title: '点击切换升序/降序/取消排序' } },
    {
      title: '详情',
      key: 'detail',
      width: 90,
      render: (_: unknown, row: StockRow) => (
        <Button type="link" size="small" onClick={() => openDetail(row)}>
          查看
        </Button>
      ),
    },
  ];

  const columns = baseColumns.map((col) => ({
    ...col,
    width: columnWidths[col.key as string] ?? DEFAULT_INVENTORY_COLUMN_WIDTHS[col.key as string],
    onHeaderCell: () => ({
      width: columnWidths[col.key as string] ?? DEFAULT_INVENTORY_COLUMN_WIDTHS[col.key as string],
      minWidth: 60,
      onResize: handleResize(col.key as string),
    }),
  }));

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (row: StockRow) => {
    setEditing(row as any);
    form.setFieldsValue({
      name: row.name,
      unit: row.unit,
      min_stock: row.min_stock,
      is_active: row.is_active === 1,
      spec: (row as any).spec ?? '',
    });
    setModalOpen(true);
  };

  const openDetail = (row: StockRow) => {
    const itemId = row.item_id;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    setDetailMoves([]);
    Promise.all([
      window.electronAPI.stocks.itemDetail(itemId),
      window.electronAPI.stocks.itemMoves(itemId, 200),
    ])
      .then(([detail, moves]) => {
        setDetailData(detail);
        setDetailMoves(Array.isArray(moves) ? moves : []);
      })
      .catch((e) => {
        console.error('加载详情失败:', e);
        message.error(e?.message || '加载详情失败');
      })
      .finally(() => setDetailLoading(false));
  };

  const onOk = () => {
    form.validateFields().then((v) => {
      if (editing) {
        window.electronAPI.items
          .update(editing.item_id, {
            name: v.name,
            unit_default: v.unit,
            min_stock: v.min_stock,
            is_active: v.is_active ? 1 : 0,
            spec_default: v.spec,
          } as any)
          .then(() => {
            message.success('已更新');
            setModalOpen(false);
            load({
              qField: searchField === 'in_date' ? 'in_date' : (searchField as any),
              q: searchField !== 'in_date' ? searchKeyword : undefined,
              date_from: searchField === 'in_date' && dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
              date_to: searchField === 'in_date' && dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
              sortBy: sortKey as any,
              sortOrder: sortDir,
            });
          });
      } else {
        window.electronAPI.items
          .create({
            name: v.name,
            unit_default: v.unit,
            min_stock: v.min_stock || 0,
            spec_default: v.spec,
          } as any)
          .then(() => {
            message.success('已添加');
            setModalOpen(false);
            load({
              qField: searchField === 'in_date' ? 'in_date' : (searchField as any),
              q: searchField !== 'in_date' ? searchKeyword : undefined,
              date_from: searchField === 'in_date' && dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
              date_to: searchField === 'in_date' && dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
              sortBy: sortKey as any,
              sortOrder: sortDir,
            });
          });
      }
    });
  };

  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'pdf',
      label: '导出 PDF',
      icon: <FilePdfOutlined />,
      onClick: () => exportInventoryToPDF(filteredAndSorted, companyName),
    },
    {
      key: 'excel',
      label: '导出 Excel',
      icon: <FileExcelOutlined />,
      onClick: () => exportInventoryToExcel(filteredAndSorted, companyName),
    },
    {
      key: 'print',
      label: '打印',
      icon: <PrinterOutlined />,
      onClick: () => printInventory(filteredAndSorted, companyName),
    },
  ];

  return (
    <Card
      title="库存总表"
      extra={
        <Space wrap align="center" size="middle">
          <Space wrap size="small">
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              style={{ width: 130 }}
              placeholder="分类"
            />
            <Select
              value={searchField}
              onChange={(v) => {
                setSearchField(v);
                setSearchKeyword('');
                setDateRange(null);
              }}
              options={SEARCH_FIELDS as any}
              style={{ width: 120 }}
            />
            {searchField === 'in_date' ? (
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
                allowClear
                style={{ width: 240 }}
              />
            ) : (
              <Input
                placeholder="输入后回车或点击搜索"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onPressEnter={handleSearch}
                allowClear
                style={{ width: 160 }}
              />
            )}
            <Button onClick={handleSearch}>搜索</Button>
          </Space>
          <Divider type="vertical" style={{ height: 24, margin: 0 }} />
          <Space size="small">
            <Button onClick={saveColumnWidths}>保存当前列宽</Button>
            <Button onClick={restoreDefaultColumnWidths}>恢复默认列宽</Button>
          </Space>
          <Divider type="vertical" style={{ height: 24, margin: 0 }} />
          <Space size="small">
            <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
              <Button icon={<DownloadOutlined />}>导出</Button>
            </Dropdown>
            <Button type="primary" onClick={openAdd}>
              新增物资
            </Button>
          </Space>
        </Space>
      }
    >
      <Table
        loading={loading}
        columns={columns}
        dataSource={filteredAndSorted}
        rowKey="item_id"
        size="small"
        pagination={{ pageSize: 20 }}
        components={{ header: { cell: ResizableTitle } }}
        onRow={(row) => ({ onDoubleClick: () => openEdit(row) })}
        onChange={(_, __, sorter: any) => {
          const single = Array.isArray(sorter) ? sorter[0] : sorter;
          const key = single?.columnKey ?? single?.field;
          const order = single?.order;
          if (!key || !sortableKeys.includes(key)) {
            setSortKey(null);
            return;
          }
          // 映射前端列名到后端排序字段
          const sortByMap: Record<string, string> = {
            name: 'name',
            category_name: 'category',
            spec: 'spec',
            qty: 'qty',
            last_in_date: 'last_in_date',
            updated_at: 'name', // updated_at 暂不支持后端排序，使用 name
          };
          const backendSortKey = sortByMap[key] || key;
          if (order === 'ascend') {
            setSortKey(backendSortKey);
            setSortDir('asc');
          } else if (order === 'descend') {
            setSortKey(backendSortKey);
            setSortDir('desc');
          } else {
            setSortKey(null);
          }
        }}
      />
      <Modal
        title={editing ? '编辑物资' : '新增物资'}
        open={modalOpen}
        onOk={onOk}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="spec" label="规格型号">
            <Input placeholder="如：型号、规格" />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true }]}>
            <Input placeholder="如：个、包、支" />
          </Form.Item>
          <Form.Item name="min_stock" label="最低库存预警">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
      <Drawer
        title="物品详情"
        placement="right"
        width={560}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailData(null);
          setDetailMoves([]);
        }}
      >
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : detailData ? (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{detailData.item.name}</div>
              <div style={{ color: '#666', fontSize: 14 }}>{detailData.item.spec || '无规格'}</div>
            </div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1890ff' }}>
                {detailData.stock.qty} <span style={{ fontSize: 14, fontWeight: 400, color: '#666' }}>{detailData.item.unit}</span>
              </div>
              <div style={{ marginTop: 4, color: '#666' }}>
                分类：{detailData.item.category_name || '未分类'}
              </div>
              <div style={{ marginTop: 4, color: '#666' }}>
                预警下限：{detailData.item.min_stock ?? 0}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>最近入库时间：</strong>
              {detailData.last_inbound_at || '-'}
            </div>
            <div style={{ marginTop: 20 }}>
              <strong>库存流水</strong>
              {detailMoves.length === 0 ? (
                <div style={{ marginTop: 8, color: '#999' }}>暂无流水记录</div>
              ) : (
                <Table
                  size="small"
                  dataSource={detailMoves}
                  rowKey={(_, i) => String(i)}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 150 },
                    { title: '类型', dataIndex: 'move_type', key: 'move_type', width: 70, render: (v: string) => ({ in: '入库', out: '出库', adjust: '调整' }[v] || v) },
                    { title: '数量', dataIndex: 'qty_delta', key: 'qty_delta', width: 80 },
                    { title: '单据号', dataIndex: 'doc_no', key: 'doc_no', width: 90, render: (v: string, r: MoveRow) => v || (r.doc_id ? `#${r.doc_id}` : '-') },
                    { title: '经办人', dataIndex: 'operator_name', key: 'operator_name', width: 80, render: (v: string) => v || '-' },
                    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true, render: (v: string) => v || '-' },
                  ]}
                />
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </Card>
  );
}
