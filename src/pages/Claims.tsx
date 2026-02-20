import { useEffect, useState, useMemo } from 'react';
import { Card, Table, Button, Modal, Form, Input, DatePicker, Select, AutoComplete, message, InputNumber, Switch, Dropdown } from 'antd';
import { DownloadOutlined, PrinterOutlined, FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Claim, Item } from '../vite-env.d';
import { useCompanyName } from '../contexts/CompanyNameContext';
import { exportClaimToPDF, exportClaimToExcel, printClaim } from '../utils/claimExport';

const statusMap: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  PARTIAL: '部分到货',
  ARRIVED: '全部到齐',
  CLOSED: '已关闭',
};

const NEW_ITEM_PREFIX = '__NEW__:';

export default function Claims() {
  const navigate = useNavigate();
  const { titleWithCompany, companyName } = useCompanyName();
  const [list, setList] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('biz_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [categorySearchInModal, setCategorySearchInModal] = useState('');
  const [operators, setOperators] = useState<{ name: string }[]>([]);
  const [detailRows, setDetailRows] = useState<{ item_id: number; requested_qty: number; spec?: string; remark?: string; category_id?: number | null }[]>([]);
  const [itemSearchByRow, setItemSearchByRow] = useState<Record<number, string>>({});
  const [categorySearchInDetail, setCategorySearchInDetail] = useState('');
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [addItemForm] = Form.useForm();
  const [addingForRowIndex, setAddingForRowIndex] = useState<number | null>(null);
  const [addItemNamePreFill, setAddItemNamePreFill] = useState('');
  const [addItemSubmitting, setAddItemSubmitting] = useState(false);

  const NEW_CAT_PREFIX = '__newcat__';

  const load = () => {
    const api = window.electronAPI as any;
    const listFn = api?.claims?.list;
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    (listFn ? listFn(sortBy, order) : Promise.resolve([]))
      .then((data: any) => {
        setList(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        console.error('加载申报单列表失败:', e);
        setList([]);
        setLoading(false);
      });
  };

  const loadItems = () =>
    window.electronAPI.items.list(true).then((data: any) => setItems(Array.isArray(data) ? data : [])).catch(() => setItems([]));

  useEffect(() => {
    load();
  }, [sortBy, sortOrder]);

  useEffect(() => {
    loadItems();
    window.electronAPI.operators.list().then((data: any) => setOperators(Array.isArray(data) ? data : [])).catch(() => setOperators([]));
    window.electronAPI.categories?.list?.().then((data: any) => setCategories(Array.isArray(data) ? data : [])).catch(() => setCategories([]));
  }, []);

  const addItemCategoryOptions = useMemo(() => {
    const base = categories.map((c) => ({ label: c.name, value: c.id }));
    if (!categorySearchInModal.trim()) return base;
    const lower = categorySearchInModal.trim().toLowerCase();
    const matched = base.filter((o) => o.label.toLowerCase().includes(lower));
    if (matched.length > 0) return matched;
    return [...base, { label: `新增分类：${categorySearchInModal.trim()}`, value: `${NEW_CAT_PREFIX}${categorySearchInModal.trim()}` }];
  }, [categories, categorySearchInModal]);

  /** 已有物资的型号规格列表，用于申报明细中规格型号的下拉辅助输入 */
  const specOptionsForDetail = useMemo(() => {
    const set = new Set<string>();
    (items || []).forEach((i) => {
      const s = (i as { spec?: string }).spec?.trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort().map((s) => ({ value: s }));
  }, [items]);

  /** 申报明细中「类别」列的下拉选项：现有分类 + 可新增分类 */
  const detailCategoryOptions = useMemo(() => {
    const base = categories.map((c) => ({ label: c.name, value: c.id }));
    const search = (categorySearchInDetail || '').trim();
    if (!search) return base;
    const lower = search.toLowerCase();
    const matched = base.filter((o) => (o.label as string).toLowerCase().includes(lower));
    if (matched.length > 0) return matched;
    return [...base, { label: `新增分类：${search}`, value: `${NEW_CAT_PREFIX}${search}` }];
  }, [categories, categorySearchInDetail]);

  const addDetailRow = () => {
    setDetailRows((r) => [...r, { item_id: 0, requested_qty: 0, spec: '', remark: '', category_id: undefined }]);
  };

  const removeDetailRow = (idx: number) => {
    setDetailRows((r) => r.filter((_, i) => i !== idx));
  };

  const openCreate = () => {
    form.resetFields();
    const first = items[0];
    const firstId = first?.id || 0;
    setDetailRows([{
      item_id: firstId,
      requested_qty: 1,
      spec: (first as any)?.spec ?? '',
      remark: '',
      category_id: (first as any)?.category_id ?? undefined,
    }]);
    setItemSearchByRow({});
    setCategorySearchInDetail('');
    setModalOpen(true);
  };

  const getItemOptionsForRow = (idx: number) => {
    const search = (itemSearchByRow[idx] || '').trim().toLowerCase();
    const base = (items || []).map((i) => {
      const unit = (i as any).unit ?? (i as any).unit_default ?? '';
      return { label: unit ? `${i.name} (${unit})` : i.name, value: i.id };
    });
    if (!search) return base;
    const filtered = base.filter((o) => (o.label as string).toLowerCase().includes(search));
    const hasMatch = (items || []).some((i) => {
      const unit = (i as any).unit ?? (i as any).unit_default ?? '';
      return i.name.toLowerCase().includes(search) || unit.toLowerCase().includes(search);
    });
    if (!hasMatch && search.length > 0) {
      return [...filtered, { label: `新增物资：${itemSearchByRow[idx]}`, value: `${NEW_ITEM_PREFIX}${itemSearchByRow[idx]}` }];
    }
    return filtered;
  };

  const onItemSelect = (idx: number, value: number | string) => {
    if (typeof value === 'string' && value.startsWith(NEW_ITEM_PREFIX)) {
      const name = value.slice(NEW_ITEM_PREFIX.length);
      setAddItemNamePreFill(name);
      setAddingForRowIndex(idx);
      addItemForm.setFieldsValue({ name, spec: undefined, category_id: undefined, requested_qty: 1, unit: undefined, remark: undefined, min_stock: 0, is_active: true });
      setCategorySearchInModal('');
      setAddItemModalOpen(true);
      setItemSearchByRow((prev) => ({ ...prev, [idx]: '' }));
      return;
    }
    const item = (items || []).find((i) => i.id === (value as number)) as (Item & { category_id?: number; spec?: string }) | undefined;
    setDetailRows((r) =>
      r.map((x, i) =>
        i === idx
          ? {
              ...x,
              item_id: value as number,
              spec: x.spec ?? item?.spec ?? '',
              category_id: item?.category_id ?? undefined,
            }
          : x
      )
    );
  };

  const handleDetailCategorySelect = (idx: number, value: number | string) => {
    if (typeof value === 'string' && value.startsWith(NEW_CAT_PREFIX)) {
      const name = value.slice(NEW_CAT_PREFIX.length);
      if (!name) return;
      window.electronAPI.categories.create(name).then((res: { id: number; name: string }) => {
        setCategories((prev) => [...prev.filter((c) => c.name !== res.name), res].sort((a, b) => a.name.localeCompare(b.name)));
        setDetailRows((r) => r.map((x, i) => (i === idx ? { ...x, category_id: Number(res.id) } : x)));
        setCategorySearchInDetail('');
        message.success('已创建并选中分类');
      }).catch((e: any) => {
        const payload = e?.payload ?? e;
        if (payload?.error === 'NAME_EXISTS' && payload?.existingId != null) {
          setDetailRows((r) => r.map((x, i) => (i === idx ? { ...x, category_id: Number(payload.existingId) } : x)));
          setCategorySearchInDetail('');
          message.info('已存在同名分类，已自动选中');
        } else message.error(e?.message || '创建分类失败');
      });
      return;
    }
    const numVal = typeof value === 'number' ? value : Number(value);
    setDetailRows((r) => r.map((x, i) => (i === idx ? { ...x, category_id: Number.isNaN(numVal) ? undefined : numVal } : x)));
  };

  const handleAddItemCategoryChange = (value: number | string) => {
    if (typeof value === 'string' && value.startsWith(NEW_CAT_PREFIX)) {
      const name = value.slice(NEW_CAT_PREFIX.length);
      if (!name) return;
      window.electronAPI.categories.create(name).then((res: { id: number; name: string }) => {
        setCategories((prev) => [...prev.filter((c) => c.name !== res.name), res].sort((a, b) => a.name.localeCompare(b.name)));
        addItemForm.setFieldsValue({ category_id: res.id });
        setCategorySearchInModal('');
        message.success('已创建并选中分类');
      }).catch((e: any) => {
        const payload = e?.payload ?? e;
        if (payload?.error === 'NAME_EXISTS' && payload?.existingId != null) {
          load();
          addItemForm.setFieldsValue({ category_id: payload.existingId });
          setCategorySearchInModal('');
          message.info('已存在同名分类，已自动选中');
        } else message.error(e?.message || '创建分类失败');
      });
      return;
    }
    addItemForm.setFieldsValue({ category_id: value });
  };

  const onAddItemOk = () => {
    addItemForm.validateFields().then((v) => {
      const name = (v.name && String(v.name).trim()) || '';
      const unit = (v.unit && String(v.unit).trim()) || '';
      if (!name) {
        message.warning('物资名称不能为空');
        return;
      }
      if (!unit) {
        message.warning('单位不能为空');
        return;
      }
      const requestedQty = Math.max(1, Number(v.requested_qty) || 1);
      setAddItemSubmitting(true);
      window.electronAPI.items
        .create({
          name,
          unit,
          spec: v.spec?.trim() || undefined,
          category_id: v.category_id ?? undefined,
          min_stock: v.min_stock ?? 0,
          is_active: v.is_active !== false ? 1 : 0,
        } as any)
        .then((res) => {
          const newId = res.id;
          const rowIdx = addingForRowIndex;
          const fv = addItemForm.getFieldsValue();
          return Promise.resolve(loadItems()).then(() => {
            if (rowIdx !== null) {
              setDetailRows((r) =>
                r.map((x, i) =>
                  i === rowIdx
                    ? {
                        ...x,
                        item_id: newId,
                        requested_qty: requestedQty,
                        spec: fv.spec?.trim() ?? '',
                        remark: fv.remark?.trim() ?? '',
                        category_id: fv.category_id ?? undefined,
                      }
                    : x
                )
              );
            }
            setAddItemModalOpen(false);
            setAddingForRowIndex(null);
            addItemForm.resetFields();
            setCategorySearchInModal('');
            message.success('物资已添加，已选中到当前行');
          });
        })
        .catch((e: any) => {
          const payload = e?.payload;
          if (payload?.error === 'NAME_EXISTS' && payload?.existingId != null && addingForRowIndex !== null) {
            message.warning('已存在该物资，请直接选择');
            setDetailRows((r) => r.map((x, i) => (i === addingForRowIndex ? { ...x, item_id: payload.existingId } : x)));
            loadItems();
            setAddItemModalOpen(false);
            setAddingForRowIndex(null);
          } else if (payload?.error === 'DB_READONLY') {
            message.error(`数据库只读：${payload?.message || '无法写入数据库'}${payload?.dbPath ? `\n路径: ${payload.dbPath}` : ''}`);
            console.error('数据库只读错误:', payload);
          } else {
            message.error(payload?.message || e?.message || '创建失败');
          }
        })
        .finally(() => setAddItemSubmitting(false));
    });
  };

  const onCreate = () => {
    form.validateFields().then((v) => {
      const claim_no = v.claim_no || 'CL' + Date.now();
      const itemsPayload = detailRows
        .filter((r) => r.item_id && r.requested_qty > 0)
        .map((r) => {
          const sel = (items || []).find((i) => i.id === r.item_id) as (Item & { category_id?: number }) | undefined;
          const rawCat = r.category_id != null ? r.category_id : sel?.category_id;
          const categoryId = rawCat != null && rawCat !== '' ? Number(rawCat) : null;
          return {
            item_id: r.item_id,
            requested_qty: r.requested_qty,
            spec: r.spec?.trim() || undefined,
            remark: r.remark?.trim() || undefined,
            category_id: categoryId != null && !Number.isNaN(categoryId) ? categoryId : null,
          };
        });
      if (itemsPayload.length === 0) {
        message.warning('请至少添加一条申报明细');
        return;
      }
      window.electronAPI.claims
        .create({
          claim_no,
          biz_date: dayjs(v.biz_date).format('YYYY-MM-DD'),
          requester: v.requester,
          status: 'DRAFT',
          note: v.note,
          items: itemsPayload,
        } as any)
        .then(() => {
          message.success('申报单已创建');
          setModalOpen(false);
          load();
        })
        .catch((e) => message.error(e?.message || '创建失败'));
    });
  };

  const columns = [
    {
      title: '申报单号',
      dataIndex: 'claim_no',
      key: 'claim_no',
      width: 140,
      sorter: true,
      sortOrder: sortBy === 'claim_no' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : undefined,
    },
    {
      title: '日期',
      dataIndex: 'biz_date',
      key: 'biz_date',
      width: 100,
      sorter: true,
      sortOrder: sortBy === 'biz_date' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : undefined,
    },
    { title: '申请人', dataIndex: 'requester', key: 'requester', width: 90 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => statusMap[s] || s },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, row: Claim) => {
        const mainTitle = titleWithCompany('物资申报表');
        const handleExport = (type: 'pdf' | 'excel' | 'print') => {
          window.electronAPI.claims.get(row.id).then((detail: any) => {
            if (detail) {
              try {
                if (type === 'pdf') {
                  exportClaimToPDF(detail, mainTitle, companyName);
                  message.success('PDF 导出成功');
                } else if (type === 'excel') {
                  exportClaimToExcel(detail, mainTitle, companyName).then(() => message.success('Excel 导出成功')).catch((e: any) => message.error(e?.message || '导出失败'));
                } else if (type === 'print') {
                  printClaim(detail, mainTitle);
                }
              } catch (e: any) {
                console.error('导出失败:', e);
                message.error('导出失败：' + (e?.message || String(e)));
              }
            }
          }).catch((e: any) => {
            console.error('获取申报单详情失败:', e);
            message.error('获取申报单详情失败：' + (e?.message || String(e)));
          });
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

        return (
          <>
            <Button type="link" size="small" onClick={() => navigate('/claim/' + row.id)}>
              详情
            </Button>
            <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
              <Button type="link" size="small" icon={<DownloadOutlined />}>
                导出
              </Button>
            </Dropdown>
          </>
        );
      },
    },
  ];

  return (
    <Card title="申报列表" extra={<Button type="primary" onClick={openCreate}>新建申报</Button>}>
      <Table
        loading={loading}
        columns={columns}
        dataSource={list}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 15 }}
        onChange={(_, __, sorter: any) => {
          const col = sorter?.columnKey ?? sorter?.field;
          if (col === 'claim_no' || col === 'biz_date') {
            setSortBy(col);
            setSortOrder(sorter?.order === 'ascend' ? 'asc' : 'desc');
          }
        }}
      />
      <Modal
        title="新建申报单"
        open={modalOpen}
        onOk={onCreate}
        onCancel={() => setModalOpen(false)}
        width={860}
      >
        <Form form={form} layout="vertical" initialValues={{ biz_date: dayjs(), claim_no: 'CL' + Date.now() }}>
          <Form.Item name="claim_no" label="申报单号" rules={[{ required: true }]}>
            <Input placeholder="如 CL20250218001" />
          </Form.Item>
          <Form.Item name="biz_date" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="requester" label="申请人" rules={[{ required: true }]}>
            <Select placeholder="选择经办人" options={(operators || []).map((o) => ({ label: o.name, value: o.name }))} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>申报明细</strong>
            <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>（与物资申请表列一致：物资名称、型号规格、类别、申报数量、单位、备注）</span>
            <Button type="link" size="small" onClick={addDetailRow}>+ 添加</Button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px', width: '16%' }}>物资名称</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', width: '22%' }}>型号规格</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', width: '12%' }}>类别</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', width: '10%' }}>申报数量</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', width: '8%' }}>单位</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', width: '22%' }}>备注</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {detailRows.map((row, idx) => {
                  const selItem = (items || []).find((i) => i.id === row.item_id) as (Item & { category_id?: number }) | undefined;
                  const unit = (selItem as any)?.unit ?? (selItem as any)?.unit_default ?? '—';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '4px' }}>
                        <Select
                          style={{ width: '100%', minWidth: 120 }}
                          placeholder="搜索或选择物资，无匹配时可新增"
                          showSearch
                          filterOption={false}
                          options={getItemOptionsForRow(idx)}
                          value={row.item_id && typeof row.item_id === 'number' ? row.item_id : undefined}
                          onSearch={(val) => setItemSearchByRow((prev) => ({ ...prev, [idx]: val }))}
                          onSelect={(v) => onItemSelect(idx, v)}
                          notFoundContent={null}
                          dropdownStyle={{ minWidth: 200 }}
                        />
                      </td>
                      <td style={{ padding: '4px' }}>
                        <AutoComplete
                          placeholder="可选，可搜索或选择已有规格"
                          value={row.spec ?? ''}
                          options={specOptionsForDetail}
                          onSelect={(v) => setDetailRows((r) => r.map((x, i) => (i === idx ? { ...x, spec: v } : x)))}
                          onChange={(v) => setDetailRows((r) => r.map((x, i) => (i === idx ? { ...x, spec: v ?? '' } : x)))}
                          filterOption={(input, option) =>
                            (option?.value ?? '').toString().toLowerCase().includes((input || '').toLowerCase())
                          }
                          allowClear
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '4px' }}>
                        <Select
                          placeholder="选择或新增分类"
                          allowClear
                          showSearch
                          filterOption={false}
                          onSearch={setCategorySearchInDetail}
                          options={detailCategoryOptions}
                          value={row.category_id != null ? row.category_id : (selItem as (Item & { category_id?: number }) | undefined)?.category_id}
                          onSelect={(v) => handleDetailCategorySelect(idx, v)}
                          style={{ width: '100%', minWidth: 100 }}
                          dropdownStyle={{ minWidth: 160 }}
                        />
                      </td>
                      <td style={{ padding: '4px' }}>
                        <InputNumber
                          min={1}
                          placeholder="数量"
                          value={row.requested_qty || undefined}
                          onChange={(v) => setDetailRows((r) => r.map((x, i) => (i === idx ? { ...x, requested_qty: v || 0 } : x)))}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '4px', color: '#666' }}>{unit}</td>
                      <td style={{ padding: '4px' }}>
                        <Input
                          placeholder="可选"
                          value={row.remark ?? ''}
                          onChange={(e) => setDetailRows((r) => r.map((x, i) => (i === idx ? { ...x, remark: e.target.value } : x)))}
                          allowClear
                        />
                      </td>
                      <td style={{ padding: '4px' }}>
                        <Button type="link" danger size="small" onClick={() => removeDetailRow(idx)}>删除</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal
        title="新增物资"
        open={addItemModalOpen}
        onOk={onAddItemOk}
        onCancel={() => {
          setAddItemModalOpen(false);
          setAddingForRowIndex(null);
          addItemForm.resetFields();
          setCategorySearchInModal('');
        }}
        confirmLoading={addItemSubmitting}
        destroyOnClose
        width={420}
      >
        <Form form={addItemForm} layout="vertical" initialValues={{ min_stock: 0, is_active: true, requested_qty: 1 }}>
          <Form.Item name="name" label="*物资名称" rules={[{ required: true, message: '请输入物资名称' }]}>
            <Input placeholder="如：签字笔" />
          </Form.Item>
          <Form.Item name="spec" label="规格型号">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="category_id" label="分类">
            <Select
              showSearch
              placeholder="选择或输入新增"
              options={addItemCategoryOptions}
              filterOption={false}
              onSearch={setCategorySearchInModal}
              onChange={handleAddItemCategoryChange}
              onBlur={() => setCategorySearchInModal('')}
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="requested_qty" label="*申报数量" rules={[{ required: true }, { type: 'number', min: 1 }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unit" label="*单位" rules={[{ required: true, message: '请输入单位' }]}>
            <Input placeholder="如：个、盒、支、本" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="min_stock" label="最低预警库存">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
