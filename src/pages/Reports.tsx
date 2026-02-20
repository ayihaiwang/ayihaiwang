import { useEffect, useState, useRef } from 'react';
import { Card, DatePicker, Select, Button, Table, Space, message, Dropdown } from 'antd';
import { DownloadOutlined, PrinterOutlined, FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import type { DailyRow, TopItemRow, MovementRow, Item } from '../vite-env.d';
import { useCompanyName } from '../contexts/CompanyNameContext';
import { exportReportToPDF, exportReportToExcel, printReport } from '../utils/reportExport';

export default function Reports() {
  const { companyName } = useCompanyName();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [itemId, setItemId] = useState<number | undefined>();
  const [operator, setOperator] = useState<string | undefined>();
  const [items, setItems] = useState<Item[]>([]);
  const [operators, setOperators] = useState<{ name: string }[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [topIn, setTopIn] = useState<TopItemRow[]>([]);
  const [topOut, setTopOut] = useState<TopItemRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const chartARef = useRef<any>(null);
  const chartBRef = useRef<any>(null);

  const loadFilters = () => {
    window.electronAPI.items.list(true).then((data: any) => setItems(Array.isArray(data) ? data : [])).catch(() => setItems([]));
    window.electronAPI.operators.list().then((data: any) => setOperators(Array.isArray(data) ? data : [])).catch(() => setOperators([]));
  };

  const loadReport = () => {
    const start = dateRange[0].format('YYYY-MM-DD');
    const end = dateRange[1].format('YYYY-MM-DD');
    setLoading(true);
    Promise.all([
      window.electronAPI.reports.daily(start, end, itemId, operator),
      window.electronAPI.reports.topItems(start, end, 'IN', 10),
      window.electronAPI.reports.topItems(start, end, 'OUT', 10),
      window.electronAPI.reports.movements(start, end, itemId, operator),
    ])
      .then(([d, ti, to, m]) => {
        setDaily(Array.isArray(d) ? d : []);
        setTopIn(Array.isArray(ti) ? ti : []);
        setTopOut(Array.isArray(to) ? to : []);
        setMovements(Array.isArray(m) ? m : []);
      })
      .catch((e) => {
        console.error('加载报表失败:', e);
        message.error(e?.message || '加载失败');
        setDaily([]);
        setTopIn([]);
        setTopOut([]);
        setMovements([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => loadFilters(), []);
  useEffect(() => loadReport(), [dateRange, itemId, operator]);

  const start = dateRange[0].format('YYYY-MM-DD');
  const end = dateRange[1].format('YYYY-MM-DD');
  const chartAOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['入库', '出库'] },
    xAxis: { type: 'category', data: (daily || []).map((d) => d?.date || '') },
    yAxis: { type: 'value' },
    series: [
      { name: '入库', type: 'bar', data: (daily || []).map((d) => d?.in_qty || 0) },
      { name: '出库', type: 'bar', data: (daily || []).map((d) => d?.out_qty || 0) },
    ],
  };
  const chartBOption = {
    tooltip: {},
    xAxis: { type: 'category', data: (topOut || []).map((t) => t?.item_name || ''), axisLabel: { interval: 0, rotate: 30 } },
    yAxis: { type: 'value' },
    series: [{ name: '出库量', type: 'bar', data: (topOut || []).map((t) => t?.total_qty || 0) }],
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'print') => {
    const reportData = {
      dateRange: [start, end] as [string, string],
      daily,
      topIn,
      topOut,
      movements,
      itemId,
      operator,
    };

    try {
      if (type === 'pdf') {
        exportReportToPDF(reportData, companyName);
        message.success('PDF 导出成功');
      } else if (type === 'excel') {
        await exportReportToExcel(reportData, companyName);
        message.success('Excel 导出成功');
      } else if (type === 'print') {
        printReport(reportData, companyName);
      }
    } catch (e: any) {
      console.error('导出失败:', e);
      message.error('导出失败：' + (e?.message || String(e)));
    }
  };

  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'pdf',
      label: '导出 PDF',
      icon: <FilePdfOutlined />,
      onClick: () => handleExport('pdf'),
    },
    {
      key: 'excel',
      label: '导出 Excel',
      icon: <FileExcelOutlined />,
      onClick: () => handleExport('excel'),
    },
    {
      key: 'print',
      label: '打印',
      icon: <PrinterOutlined />,
      onClick: () => handleExport('print'),
    },
  ];

  const columns = [
    { title: '日期', dataIndex: 'biz_date', key: 'biz_date', width: 100 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 60, render: (t: string) => (t === 'IN' ? '入库' : '出库') },
    { title: '物资', dataIndex: 'item_name', key: 'item_name' },
    { title: '数量', dataIndex: 'qty', key: 'qty', width: 80 },
    { title: '经办人', dataIndex: 'operator', key: 'operator', width: 90 },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
  ];

  return (
    <div>
      <Card title="统计报表" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>日期范围：</span>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
          />
          <span>物资：</span>
          <Select
            placeholder="全部"
            allowClear
            style={{ width: 160 }}
            options={[{ label: '全部', value: undefined }, ...(items || []).map((i) => ({ label: i.name, value: i.id }))]}
            value={itemId}
            onChange={setItemId}
          />
          <span>经办人：</span>
          <Select
            placeholder="全部"
            allowClear
            style={{ width: 100 }}
            options={[{ label: '全部', value: undefined }, ...(operators || []).map((o) => ({ label: o.name, value: o.name }))]}
            value={operator}
            onChange={setOperator}
          />
        </Space>
      </Card>

      <Card title="按天入库/出库" style={{ marginBottom: 16 }}>
        <ReactECharts ref={chartARef} option={chartAOption} style={{ height: 320 }} />
      </Card>

      <Card title="Top10 物资出库量" style={{ marginBottom: 16 }}>
        <ReactECharts ref={chartBRef} option={chartBOption} style={{ height: 280 }} />
      </Card>

      <Card title="导出报表" style={{ marginBottom: 16 }}>
        <Space>
          <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
            <Button type="primary" icon={<DownloadOutlined />}>
              导出报表
            </Button>
          </Dropdown>
        </Space>
      </Card>

      <Card title="明细列表">
        <Table
          loading={loading}
          columns={columns}
          dataSource={movements}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
}
