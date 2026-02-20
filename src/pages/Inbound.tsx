import { useEffect, useState, useRef, useMemo } from 'react';
import { Form, Select, InputNumber, DatePicker, Input, Button, Card, message, Modal } from 'antd';
import dayjs from 'dayjs';
import type { Item, Claim } from '../vite-env.d';

const today = dayjs().format('YYYY-MM-DD');
const NEW_PREFIX = '__new__';
const NEW_ITEM_PREFIX = '__new_item__';

// 状态翻译映射
const statusMap: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  PARTIAL: '部分到货',
  ARRIVED: '全部到齐',
  CLOSED: '已关闭',
};

export default function Inbound() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [operators, setOperators] = useState<{ name: string }[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimId, setClaimId] = useState<number | undefined>();
  const [filterItems, setFilterItems] = useState<Item[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategorySearch, setNewItemCategorySearch] = useState('');
  const [pendingNewItem, setPendingNewItem] = useState<Item | null>(null);
  const [form] = Form.useForm();
  const [newItemForm] = Form.useForm();
  const qtyRef = useRef<any>(null);

  const load = () => {
    window.electronAPI.items.list(true).then((data: any) => setItems(Array.isArray(data) ? data : [])).catch(() => setItems([]));
    window.electronAPI.categories?.list?.().then((data: any) => setCategories(Array.isArray(data) ? data : [])).catch(() => setCategories([]));
    window.electronAPI.operators.list().then((data: any) => setOperators(Array.isArray(data) ? data : [])).catch(() => setOperators([]));
    window.electronAPI.claims.forInbound().then((data: any) => setClaims(Array.isArray(data) ? data : [])).catch(() => setClaims([]));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!claimId) {
      setFilterItems(items);
      return;
    }
    window.electronAPI.claims.itemsByClaim(claimId).then((rows: any) => {
      const ids = new Set((rows || []).map((r: any) => r.item_id));
      setFilterItems(items.filter((i) => ids.has(i.id)));
    });
  }, [claimId, items]);

  const categoryOptions = useMemo(() => {
    const base = categories.map((c) => ({ label: c.name, value: c.id }));
    if (!categorySearch.trim()) return base;
    const lower = categorySearch.trim().toLowerCase();
    const matched = base.filter((o) => o.label.toLowerCase().includes(lower));
    if (matched.length > 0) return matched;
    return [...base, { label: `新增分类：${categorySearch.trim()}`, value: `${NEW_PREFIX}${categorySearch.trim()}` }];
  }, [categories, categorySearch]);

  const newItemCategoryOptions = useMemo(() => {
    const base = categories.map((c) => ({ label: c.name, value: c.id }));
    if (!newItemCategorySearch.trim()) return base;
    const lower = newItemCategorySearch.trim().toLowerCase();
    const matched = base.filter((o) => o.label.toLowerCase().includes(lower));
    if (matched.length > 0) return matched;
    return [...base, { label: `新增分类：${newItemCategorySearch.trim()}`, value: `${NEW_PREFIX}${newItemCategorySearch.trim()}` }];
  }, [categories, newItemCategorySearch]);

  const handleCategoryChange = (value: number | string) => {
    if (typeof value === 'string' && value.startsWith(NEW_PREFIX)) {
      const name = value.slice(NEW_PREFIX.length);
      if (!name) return;
      window.electronAPI.categories
        .create(name)
        .then((res: { id: number; name: string } | { error: string; existingId: number }) => {
          if ('error' in res && res.error === 'NAME_EXISTS') {
            // 分类已存在
            load();
            form.setFieldsValue({ category_id: res.existingId });
            setCategorySearch('');
            message.info('已存在同名分类，已自动选中');
          } else if ('id' in res) {
            // 创建成功
            setCategories((prev) => [...prev.filter((c) => c.name !== res.name), res].sort((a, b) => a.name.localeCompare(b.name)));
            form.setFieldsValue({ category_id: res.id });
            setCategorySearch('');
            message.success('已创建并选中分类');
          }
        })
        .catch((e: any) => {
          const payload = e?.payload ?? e;
          if (payload?.error === 'NAME_EXISTS' && payload?.existingId != null) {
            load();
            form.setFieldsValue({ category_id: payload.existingId });
            setCategorySearch('');
            message.info('已存在同名分类，已自动选中');
          } else {
            message.error(e?.message || '创建分类失败');
          }
        });
      return;
    }
    form.setFieldsValue({ category_id: value });
  };

  const onFinish = (v: any) => {
    const row = {
      item_id: v.item_id,
      qty: v.qty,
      biz_date: dayjs(v.biz_date).format('YYYY-MM-DD'),
      operator: v.operator,
      note: v.note || undefined,
      claim_id: claimId || undefined,
      category_id: v.category_id ?? undefined,
    };
    window.electronAPI.movements
      .in(row)
      .then(() => {
        message.success('入库成功');
        form.setFieldsValue({ qty: undefined, note: undefined });
        setPendingNewItem(null);
        qtyRef.current?.focus();
      })
      .catch((e) => message.error(e?.message || '入库失败'));
  };

  const baseItemList = claimId ? filterItems : items;
  const itemOptions = useMemo(() => {
    const list = pendingNewItem ? [...baseItemList, pendingNewItem] : baseItemList;
    const opts = (list || [])
      .filter((i) => {
        const unit = i.unit || '';
        return !itemSearch.trim() || `${i.name} ${unit}`.toLowerCase().includes(itemSearch.trim().toLowerCase());
      })
      .map((i) => {
        const unit = i.unit || '';
        return { label: unit ? `${i.name} (${unit})` : i.name, value: i.id };
      });
    if (itemSearch.trim()) {
      opts.push({ label: `新增物资：${itemSearch.trim()}`, value: `${NEW_ITEM_PREFIX}${itemSearch.trim()}` });
    }
    return opts;
  }, [baseItemList, pendingNewItem, itemSearch]);

  const handleNewItemCategoryChange = (value: number | string) => {
    if (typeof value === 'string' && value.startsWith(NEW_PREFIX)) {
      const name = value.slice(NEW_PREFIX.length);
      if (!name) return;
      window.electronAPI.categories
        .create(name)
        .then((res: { id: number; name: string } | { error: string; existingId: number }) => {
          if ('error' in res && res.error === 'NAME_EXISTS') {
            // 分类已存在
            load();
            newItemForm.setFieldsValue({ category_id: res.existingId });
            setNewItemCategorySearch('');
            message.info('已存在同名分类，已自动选中');
          } else if ('id' in res) {
            // 创建成功
            setCategories((prev) => [...prev.filter((c) => c.name !== res.name), res].sort((a, b) => a.name.localeCompare(b.name)));
            newItemForm.setFieldsValue({ category_id: res.id });
            setNewItemCategorySearch('');
            message.success('已创建并选中分类');
          }
        })
        .catch((e: any) => {
          const payload = e?.payload ?? e;
          if (payload?.error === 'NAME_EXISTS' && payload?.existingId != null) {
            load();
            newItemForm.setFieldsValue({ category_id: payload.existingId });
            setNewItemCategorySearch('');
            message.info('已存在同名分类，已自动选中');
          } else {
            message.error(e?.message || '创建分类失败');
          }
        });
      return;
    }
    newItemForm.setFieldsValue({ category_id: value });
  };

  const handleItemChange = (value: number | string) => {
    if (typeof value === 'string' && value.startsWith(NEW_ITEM_PREFIX)) {
      const name = value.slice(NEW_ITEM_PREFIX.length).trim();
      if (!name) return;
      setNewItemName(name);
      newItemForm.setFieldsValue({
        unit: undefined,
        spec: undefined,
        min_stock: 0,
        category_id: form.getFieldValue('category_id') ?? undefined,
      });
      setNewItemCategorySearch('');
      setNewItemModalOpen(true);
      return;
    }
    const item = (pendingNewItem ? [...baseItemList, pendingNewItem] : baseItemList).find((i) => i.id === value);
    if (item?.category_id != null) form.setFieldsValue({ category_id: item.category_id });
  };

  const onNewItemOk = () => {
    newItemForm.validateFields().then((v) => {
      const categoryId = v.category_id ?? undefined;
      window.electronAPI.items
        .create({
          name: newItemName.trim(),
          unit: v.unit.trim(),
          spec: v.spec?.trim() || undefined,
          min_stock: v.min_stock ?? 0,
          category_id: categoryId ?? undefined,
        } as any)
        .then((res: { id: number }) => {
          const newItem: Item = {
            id: res.id,
            name: newItemName.trim(),
            unit: v.unit.trim(),
            min_stock: v.min_stock ?? 0,
            is_active: 1,
            spec: v.spec?.trim(),
            category_id: categoryId ?? null,
            created_at: new Date().toISOString(),
          };
          setItems((prev) => [...prev.filter((i) => i.id !== res.id), newItem].sort((a, b) => a.name.localeCompare(b.name)));
          setPendingNewItem(newItem);
          form.setFieldsValue({ item_id: res.id });
          setNewItemModalOpen(false);
          setItemSearch('');
          newItemForm.resetFields();
          message.success('已添加物资，请继续填写数量等信息后提交入库');
        })
        .catch((e: any) => {
          const payload = e?.payload ?? e;
          if (payload?.error === 'NAME_EXISTS' && payload?.existingId != null) {
            load();
            form.setFieldsValue({ item_id: payload.existingId });
            setNewItemModalOpen(false);
            setItemSearch('');
            message.info('已存在同名物资，已自动选中');
          } else {
            message.error(e?.message || '添加物资失败');
          }
        });
    });
  };

  const opOptions = (operators || []).map((o) => ({ label: o.name, value: o.name }));

  return (
    <Card title="物资入库">
      <Form
        form={form}
        layout="inline"
        onFinish={onFinish}
        style={{ flexWrap: 'wrap', gap: 8 }}
        initialValues={{ biz_date: dayjs(), qty: undefined }}
      >
        <Form.Item name="claim_id" label="关联申报" style={{ width: 200 }}>
          <Select
            placeholder="不关联"
            allowClear
            options={[
              { label: '不关联', value: undefined },
              ...(claims || []).map((c) => ({
                label: `${c.claim_no || '未命名'} (${statusMap[c.status] || c.status})`,
                value: c.id,
              })),
            ]}
            onChange={setClaimId}
          />
        </Form.Item>
        <Form.Item name="item_id" label="*物资" rules={[{ required: true, message: '请选择或新增物资' }]} style={{ minWidth: 200 }}>
          <Select
            showSearch
            placeholder="选择或输入名称以新增"
            options={itemOptions}
            filterOption={false}
            onSearch={setItemSearch}
            onChange={handleItemChange}
            onBlur={() => setItemSearch('')}
          />
        </Form.Item>
        <Form.Item name="category_id" label="*分类" rules={[{ required: true, message: '请选择或新增分类' }]} style={{ minWidth: 160 }}>
          <Select
            showSearch
            placeholder="选择或输入新增"
            options={categoryOptions}
            filterOption={false}
            onSearch={setCategorySearch}
            onChange={handleCategoryChange}
            onBlur={() => setCategorySearch('')}
            allowClear
          />
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

      <Modal
        title="新增物资"
        open={newItemModalOpen}
        onOk={onNewItemOk}
        onCancel={() => { setNewItemModalOpen(false); setItemSearch(''); setNewItemCategorySearch(''); }}
        okText="确定添加"
        destroyOnClose
      >
        <Form form={newItemForm} layout="vertical" initialValues={{ min_stock: 0 }}>
          <Form.Item label="物资名称">
            <Input value={newItemName} readOnly />
          </Form.Item>
          <Form.Item name="category_id" label="分类" style={{ marginBottom: 16 }}>
            <Select
              showSearch
              placeholder="选择或输入新增"
              options={newItemCategoryOptions}
              filterOption={false}
              onSearch={setNewItemCategorySearch}
              onChange={handleNewItemCategoryChange}
              onBlur={() => setNewItemCategorySearch('')}
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="unit" label="*单位" rules={[{ required: true, message: '请输入单位' }]}>
            <Input placeholder="如：个、包、支" />
          </Form.Item>
          <Form.Item name="spec" label="规格型号">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="min_stock" label="最低库存预警">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
