import { useEffect, useState, useRef } from 'react';
import { Form, Select, InputNumber, DatePicker, Input, Button, Card, message } from 'antd';
import dayjs from 'dayjs';
import type { Item } from '../vite-env.d';

export default function Outbound() {
  const [items, setItems] = useState<Item[]>([]);
  const [operators, setOperators] = useState<{ name: string }[]>([]);
  const [form] = Form.useForm();
  const qtyRef = useRef<any>(null);

  useEffect(() => {
    window.electronAPI.items.list(true).then((data: any) => setItems(Array.isArray(data) ? data : [])).catch(() => setItems([]));
    window.electronAPI.operators.list().then((data: any) => setOperators(Array.isArray(data) ? data : [])).catch(() => setOperators([]));
  }, []);

  const onFinish = (v: any) => {
    const row = {
      item_id: v.item_id,
      qty: v.qty,
      biz_date: dayjs(v.biz_date).format('YYYY-MM-DD'),
      operator: v.operator,
      note: v.note || undefined,
    };
    window.electronAPI.movements
      .out(row)
      .then(() => {
        message.success('出库成功');
        form.setFieldsValue({ qty: undefined, note: undefined });
        qtyRef.current?.focus();
      })
      .catch((e) => message.error(e?.message || '出库失败'));
  };

  const options = (items || []).map((i) => ({ label: `${i.name} (${i.unit})`, value: i.id }));
  const opOptions = (operators || []).map((o) => ({ label: o.name, value: o.name }));

  return (
    <Card title="出库录入">
      <Form
        form={form}
        layout="inline"
        onFinish={onFinish}
        style={{ flexWrap: 'wrap', gap: 8 }}
        initialValues={{ biz_date: dayjs(), qty: undefined }}
      >
        <Form.Item name="item_id" label="物资" rules={[{ required: true }]} style={{ minWidth: 180 }}>
          <Select showSearch optionFilterProp="label" placeholder="选择物资" options={options} />
        </Form.Item>
        <Form.Item name="qty" label="数量" rules={[{ required: true }, { type: 'number', min: 1 }]}>
          <InputNumber min={1} ref={qtyRef} />
        </Form.Item>
        <Form.Item name="biz_date" label="日期" rules={[{ required: true }]}>
          <DatePicker />
        </Form.Item>
        <Form.Item name="operator" label="经办人" rules={[{ required: true }]}>
          <Select placeholder="选择" options={opOptions} style={{ width: 100 }} />
        </Form.Item>
        <Form.Item name="note" label="备注">
          <Input placeholder="可选" style={{ width: 120 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">提交</Button>
        </Form.Item>
      </Form>
      <p style={{ color: '#888', marginTop: 8 }}>出库时会校验库存，不足将提示错误。</p>
    </Card>
  );
}
