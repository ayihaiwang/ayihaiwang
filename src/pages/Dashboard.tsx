import { useEffect, useState } from 'react';
import { Card, Row, Col, Table, Spin, message, Badge } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { StockRow, MovementRow } from '../vite-env.d';
import dayjs from 'dayjs';

interface StockAlert {
  item_id: number;
  name: string;
  unit: string;
  qty: number;
  min_stock: number;
  gap: number;
}

export default function Dashboard() {
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [daily, setDaily] = useState<{ date: string; in_qty: number; out_qty: number }[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const end = dayjs().format('YYYY-MM-DD');
    const start = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    
    // 分别加载数据，避免一个失败导致全部失败
    Promise.all([
      window.electronAPI.stocks.list().catch((e) => {
        console.error('加载库存失败:', e);
        return [];
      }),
      window.electronAPI.movements.recent(20).catch((e) => {
        console.error('加载流水失败:', e);
        return [];
      }),
      window.electronAPI.reports.daily(start, end).catch((e) => {
        console.error('加载日报失败:', e);
        return [];
      }),
      (window.electronAPI.stocks.alerts?.() || Promise.resolve([])).catch((e) => {
        console.error('加载预警失败:', e);
        return [];
      }),
    ])
      .then(([s, m, d, a]) => {
        setStocks(Array.isArray(s) ? s : []);
        setMovements(Array.isArray(m) ? m : []);
        setDaily(Array.isArray(d) ? d : []);
        setAlerts(Array.isArray(a) ? a : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalQty = (stocks || []).reduce((a, b) => a + (b?.qty || 0), 0);
  const in7 = (daily || []).reduce((a, b) => a + (b?.in_qty || 0), 0);
  const out7 = (daily || []).reduce((a, b) => a + (b?.out_qty || 0), 0);

  const chartOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['入库', '出库'] },
    xAxis: { type: 'category', data: (daily || []).map((d) => d?.date || '') },
    yAxis: { type: 'value' },
    series: [
      { name: '入库', type: 'bar', data: (daily || []).map((d) => d?.in_qty || 0) },
      { name: '出库', type: 'bar', data: (daily || []).map((d) => d?.out_qty || 0) },
    ],
  };

  const columns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: (t: string) => t?.slice(0, 19) },
    { title: '类型', dataIndex: 'type', key: 'type', width: 60, render: (t: string) => (t === 'IN' ? '入库' : '出库') },
    { title: '物资', dataIndex: 'item_name', key: 'item_name' },
    { title: '数量', dataIndex: 'qty', key: 'qty', width: 80 },
    { title: '经办人', dataIndex: 'operator', key: 'operator', width: 90 },
  ];

  if (loading) return <Spin />;

  const alertColumns = [
    { title: '物资名称', dataIndex: 'name', key: 'name' },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
    { title: '当前库存', dataIndex: 'qty', key: 'qty', width: 100 },
    { title: '预警阈值', dataIndex: 'min_stock', key: 'min_stock', width: 100 },
    {
      title: '缺口',
      key: 'gap',
      width: 100,
      render: (_: any, record: StockAlert) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{record.gap}</span>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card title="当前库存总量" size="small">{totalQty}</Card>
        </Col>
        <Col span={6}>
          <Card title="物资种类" size="small">{stocks.length}</Card>
        </Col>
        <Col span={6}>
          <Card title="近7天入库" size="small">{in7}</Card>
        </Col>
        <Col span={6}>
          <Card title="近7天出库" size="small">{out7}</Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card
            title={
              <span>
                库存预警
                {alerts.length > 0 && (
                  <Badge count={alerts.length} style={{ marginLeft: 8 }} />
                )}
              </span>
            }
            size="small"
            extra={<WarningOutlined style={{ color: alerts.length > 0 ? '#ff4d4f' : '#d9d9d9' }} />}
          >
            {alerts.length > 0 ? (
              <Table
                columns={alertColumns}
                dataSource={alerts}
                rowKey="item_id"
                pagination={false}
                size="small"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无预警</div>
            )}
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="近7天入/出库" size="small">
            <ReactECharts option={chartOption} style={{ height: 260 }} />
          </Card>
        </Col>
      </Row>
      <Card title="最近20条流水" size="small" style={{ marginTop: 16 }}>
        <Table columns={columns} dataSource={movements} rowKey="id" pagination={false} size="small" />
      </Card>
    </div>
  );
}
