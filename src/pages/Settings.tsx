import { useState, useEffect } from 'react';
import { Card, List, Button, Input, message, Upload, Space, Table, Modal, Form, InputNumber, Select } from 'antd';
import { PlusOutlined, InboxOutlined, EditOutlined } from '@ant-design/icons';
import { useCompanyName } from '../contexts/CompanyNameContext';

interface ItemRow {
  id: number;
  name: string;
  category_id?: number | null;
  category_name?: string | null;
  spec_default?: string | null;
  unit_default: string;
  min_stock: number;
  is_active: number;
}

export default function Settings() {
  const { companyName, setCompanyName: setCompanyNameCtx, refreshCompanyName } = useCompanyName();
  const [companyInput, setCompanyInput] = useState('');
  const [operators, setOperators] = useState<{ name: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [itemSearchQ, setItemSearchQ] = useState('');
  const [itemList, setItemList] = useState<ItemRow[]>([]);
  const [itemListLoading, setItemListLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [itemEditOpen, setItemEditOpen] = useState(false);
  const [itemEditing, setItemEditing] = useState<ItemRow | null>(null);
  const [itemForm] = Form.useForm();

  useEffect(() => {
    window.electronAPI.operators.list().then((data: any) => setOperators(Array.isArray(data) ? data : [])).catch(() => setOperators([]));
  }, []);

  useEffect(() => {
    window.electronAPI.categories.list().then((data: any) => setCategories(Array.isArray(data) ? data : [])).catch(() => setCategories([]));
  }, []);

  const loadItemList = () => {
    setItemListLoading(true);
    window.electronAPI.items.search(itemSearchQ).then((data: any) => {
      setItemList(Array.isArray(data) ? data : []);
    }).catch(() => setItemList([])).finally(() => setItemListLoading(false));
  };

  useEffect(() => {
    loadItemList();
  }, []);

  useEffect(() => {
    setCompanyInput(companyName);
  }, [companyName]);

  const saveCompanyName = () => {
    const api = window.electronAPI as any;
    if (!api?.settings?.setCompanyName) return;
    api.settings.setCompanyName(companyInput.trim()).then(() => {
      setCompanyNameCtx(companyInput.trim());
      refreshCompanyName();
      message.success('公司名称已保存');
    }).catch((e: any) => message.error(e?.message || '保存失败'));
  };

  const addOperator = () => {
    if (!newName.trim()) return;
    window.electronAPI.operators.add(newName.trim()).then(() => {
      message.success('已添加');
      setNewName('');
      window.electronAPI.operators.list().then((data: any) => setOperators(Array.isArray(data) ? data : [])).catch(() => setOperators([]));
    });
  };

  const exportBackup = () => {
    window.electronAPI.dbBackup.export().then((buf) => {
      const blob = new Blob([buf]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'warehouse_backup_' + new Date().toISOString().slice(0, 10) + '.db';
      a.click();
      URL.revokeObjectURL(a.href);
      message.success('备份已导出');
    });
  };

  const openItemEdit = (row: ItemRow) => {
    setItemEditing(row);
    itemForm.setFieldsValue({
      name: row.name,
      category_id: row.category_id ?? undefined,
      spec_default: row.spec_default ?? '',
      unit_default: row.unit_default ?? '',
      min_stock: row.min_stock ?? 0,
    });
    setItemEditOpen(true);
  };

  const saveItemEdit = () => {
    if (!itemEditing) return;
    itemForm.validateFields().then((v) => {
      if (!v.name || String(v.name).trim() === '') {
        message.error('物资名称不能为空');
        return;
      }
      if (v.min_stock != null && v.min_stock < 0) {
        message.error('预警下限不能为负数');
        return;
      }
      window.electronAPI.items.update(itemEditing.id, {
        name: String(v.name).trim(),
        category_id: v.category_id ?? null,
        spec_default: v.spec_default ? String(v.spec_default).trim() : null,
        unit_default: v.unit_default ? String(v.unit_default).trim() : '',
        min_stock: v.min_stock ?? 0,
      }).then(() => {
        message.success('已保存');
        setItemEditOpen(false);
        setItemEditing(null);
        loadItemList();
      }).catch((e: any) => message.error(e?.message || '保存失败'));
    });
  };

  const importBackup = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('http://127.0.0.1:41731/api/db/import', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || '导入失败');
      }
      await response.json();
      message.success('已恢复备份，请刷新页面查看');
      // 刷新操作员列表
      window.electronAPI.operators.list().then((data: any) => setOperators(Array.isArray(data) ? data : [])).catch(() => setOperators([]));
    } catch (e: any) {
      message.error(e?.message || '恢复失败');
    }
    return false; // prevent upload
  };

  return (
    <div>
      <Card title="公司名称" style={{ marginBottom: 16 }}>
        <p style={{ color: '#666', marginBottom: 8 }}>用于导出标题、系统主标题等显示。留空则不加前缀。</p>
        <Space.Compact style={{ width: 320 }}>
          <Input
            placeholder="输入公司名称"
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            onPressEnter={saveCompanyName}
          />
          <Button type="primary" onClick={saveCompanyName}>保存</Button>
        </Space.Compact>
      </Card>
      <Card title="经办人管理" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            placeholder="输入新经办人姓名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onPressEnter={addOperator}
            style={{ width: 200 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={addOperator}>添加</Button>
        </div>
        <List
          size="small"
          dataSource={operators}
          renderItem={(o) => <List.Item>{o.name}</List.Item>}
        />
      </Card>
      <Card title="物资资料修正" style={{ marginBottom: 16 }}>
        <p style={{ color: '#ff4d4f', marginBottom: 12 }}>
          此处仅修正物资基础信息，不会改变库存数量。库存调整请走入库/出库/调整单。
        </p>
        <Space.Compact style={{ width: 320, marginBottom: 16 }}>
          <Input
            placeholder="按名称/规格搜索"
            value={itemSearchQ}
            onChange={(e) => setItemSearchQ(e.target.value)}
            onPressEnter={loadItemList}
          />
          <Button type="primary" onClick={loadItemList}>搜索</Button>
        </Space.Compact>
        <Table
          size="small"
          loading={itemListLoading}
          dataSource={itemList}
          rowKey="id"
          pagination={{ pageSize: 15 }}
          columns={[
            { title: '名称', dataIndex: 'name', key: 'name', width: 140 },
            { title: '分类', dataIndex: 'category_name', key: 'category_name', width: 100, render: (v: string) => v || '未分类' },
            { title: '规格型号', dataIndex: 'spec_default', key: 'spec_default', width: 120, render: (v: string) => v || '-' },
            { title: '单位', dataIndex: 'unit_default', key: 'unit_default', width: 60 },
            { title: '预警下限', dataIndex: 'min_stock', key: 'min_stock', width: 80 },
            { title: '启用', dataIndex: 'is_active', key: 'is_active', width: 60, render: (v: number) => (v === 1 ? '是' : '否') },
            {
              title: '操作',
              key: 'action',
              width: 80,
              render: (_: unknown, row: ItemRow) => (
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openItemEdit(row)}>
                  编辑
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Card title="数据库备份与恢复">
        <p>备份文件将保存到本地，恢复后请重启应用。</p>
        <Space>
          <Button onClick={exportBackup}>导出备份</Button>
          <Upload accept=".db" showUploadList={false} beforeUpload={importBackup}>
            <Button icon={<InboxOutlined />}>选择文件恢复</Button>
          </Upload>
        </Space>
      </Card>
      <Modal
        title="编辑物资"
        open={itemEditOpen}
        onOk={saveItemEdit}
        onCancel={() => { setItemEditOpen(false); setItemEditing(null); }}
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item name="name" label="物资名称" rules={[{ required: true, message: '名称不能为空' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category_id" label="分类">
            <Select
              allowClear
              placeholder="选择分类"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="spec_default" label="规格型号">
            <Input placeholder="如：型号、规格" />
          </Form.Item>
          <Form.Item name="unit_default" label="单位" rules={[{ required: true, message: '单位不能为空' }]}>
            <Input placeholder="如：个、包、支" />
          </Form.Item>
          <Form.Item name="min_stock" label="预警下限" rules={[{ type: 'number', min: 0, message: '不能为负数' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
