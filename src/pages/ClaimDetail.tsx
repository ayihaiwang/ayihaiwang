import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, Select, message, Dropdown, Modal, Space } from 'antd';
import { DownloadOutlined, PrinterOutlined, FilePdfOutlined, FileExcelOutlined, EyeOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ColumnType } from 'antd/es/table';
import type { ResizeCallbackData } from 'react-resizable';
/// <reference path="../vite-env.d.ts" />
import { useCompanyName } from '../contexts/CompanyNameContext';
import {
  exportClaimToPDF,
  exportClaimToExcel,
  printClaim,
  getClaimColumnWidths,
  setClaimColumnWidths,
  CLAIM_COLUMN_KEYS,
  DEFAULT_CLAIM_WIDTHS,
} from '../utils/claimExport';
import { ResizableTitle } from '../components/ResizableTitle';

const statusMap: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  PARTIAL: '部分到货',
  ARRIVED: '全部到齐',
  CLOSED: '已关闭',
};

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { titleWithCompany, companyName } = useCompanyName();
  const [detail, setDetail] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [claimWidths, setClaimWidths] = useState<Record<string, number>>(() => {
    try {
      const arr = getClaimColumnWidths();
      return CLAIM_COLUMN_KEYS.reduce((acc, k, i) => ({ ...acc, [k]: arr[i] ?? DEFAULT_CLAIM_WIDTHS[i] }), {} as Record<string, number>);
    } catch {
      return CLAIM_COLUMN_KEYS.reduce((acc, k, i) => ({ ...acc, [k]: DEFAULT_CLAIM_WIDTHS[i] }), {} as Record<string, number>);
    }
  });

  useEffect(() => {
    if (!id) return;
    setLoadError(null);
    const numId = Number(id);
    if (Number.isNaN(numId)) {
      setDetail(null);
      setLoading(false);
      setLoadError('无效的申报单 ID');
      return;
    }
    const api = (typeof window !== 'undefined' && window.electronAPI) ? window.electronAPI : null;
    if (!api?.claims?.get) {
      setDetail(null);
      setLoading(false);
      setLoadError('API 未就绪，请刷新页面重试');
      return;
    }
    api.claims.get(numId).then((data: any) => {
      setDetail(data || null);
      setLoading(false);
      setLoadError(data ? null : '申报单不存在');
    }).catch((e) => {
      console.error('加载申报单详情失败:', e);
      setDetail(null);
      setLoading(false);
      setLoadError(e?.message || '加载失败，请检查网络或稍后重试');
    });
  }, [id]);

  const handleClaimResize = useCallback((key: string) => (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
    setClaimWidths((prev) => ({ ...prev, [key]: Math.max(2, Math.round(size.width / 8)) }));
  }, []);

  const setStatus = (status: string) => {
    if (!id) return;
    window.electronAPI.claims.updateStatus(Number(id), status).then(() => {
      message.success('状态已更新');
      window.electronAPI.claims.get(Number(id)).then(setDetail as any);
    });
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}>加载中...</div>;
  if (!detail) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p>{loadError || '申报单不存在'}</p>
        <Button type="primary" onClick={() => navigate('/claims')} style={{ marginTop: 8 }}>返回申报列表</Button>
      </div>
    );
  }

  const items = Array.isArray(detail.items) ? detail.items : [];
  const columns = [
    { title: '物资名称', dataIndex: 'item_name', key: 'item_name', width: 120 },
    { title: '型号规格', dataIndex: 'item_spec', key: 'item_spec', width: 140, ellipsis: true },
    { title: '类别', dataIndex: 'category_name', key: 'category_name', width: 100 },
    { title: '申报数量', dataIndex: 'requested_qty', key: 'requested_qty', width: 90, align: 'center' as const },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 120, ellipsis: true },
    { title: '已到货', dataIndex: 'received_qty', key: 'received_qty', width: 80, align: 'center' as const },
    {
      title: '未到货',
      key: 'pending',
      width: 80,
      align: 'center' as const,
      render: (_: any, r: ClaimItemRow) => Math.max(0, (r.requested_qty ?? 0) - (r.received_qty ?? 0)),
    },
  ];

  const canSubmit = detail.status === 'DRAFT';
  const canClose = !['CLOSED'].includes(detail.status);

  const mainTitle = titleWithCompany('物资申报表');

  const openPreview = () => {
    const arr = getClaimColumnWidths();
    setClaimWidths(CLAIM_COLUMN_KEYS.reduce((acc, k, i) => ({ ...acc, [k]: arr[i] }), {} as Record<string, number>));
    setPreviewOpen(true);
  };

  const saveClaimFormat = () => {
    setClaimColumnWidths(claimWidths);
    message.success('已保存为默认申报页格式，导出 PDF/Excel/打印 将使用当前列宽');
    setPreviewOpen(false);
  };

  const previewDataSource = (detail.items || []).map((item: any, idx: number) => ({
    key: idx,
    col0: idx + 1,
    col1: item.item_name || '',
    col2: item.category_name ?? '',
    col3: (item.item_spec ?? item.spec) ?? '',
    col4: item.unit || '',
    col5: item.requested_qty ?? item.qty ?? 0,
    col6: item.remark ?? '',
  }));

  const PREVIEW_HEADERS = ['序号', '物资名称', '分类', '规格型号', '单位', '申报数量', '备注'];
  const previewColumns: ColumnType<any>[] = CLAIM_COLUMN_KEYS.map((key, i) => {
    const exportUnits = claimWidths[key] ?? DEFAULT_CLAIM_WIDTHS[i];
    const px = Math.max(48, (exportUnits || 0) * 8);
    return {
      title: PREVIEW_HEADERS[i],
      dataIndex: key,
      key,
      width: px,
      onHeaderCell: () => ({
        width: px,
        minWidth: 40,
        onResize: handleClaimResize(key),
      }),
      align: (i === 0 || i === 4 || i === 5 ? 'center' : undefined) as 'center' | undefined,
    };
  });

  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'pdf',
      label: '导出 PDF',
      icon: <FilePdfOutlined />,
      onClick: () => exportClaimToPDF(detail, mainTitle, companyName),
    },
    {
      key: 'excel',
      label: '导出 Excel',
      icon: <FileExcelOutlined />,
      onClick: () => exportClaimToExcel(detail, mainTitle, companyName).then(() => message.success('Excel 导出成功')).catch((e: any) => message.error(e?.message || '导出失败')),
    },
    {
      key: 'print',
      label: '打印',
      icon: <PrinterOutlined />,
      onClick: () => printClaim(detail, mainTitle),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button type="text" onClick={() => navigate('/claims')}>
          ← 返回申报列表
        </Button>
        <Button icon={<EyeOutlined />} onClick={openPreview}>
          申报页预览
        </Button>
        <Dropdown menu={{ items: exportMenuItems }} trigger={['click']}>
          <Button type="primary" icon={<DownloadOutlined />}>
            导出
          </Button>
        </Dropdown>
      </div>
      <Card title={`申报单 ${detail.claim_no}`}>
        <p>日期：{detail.biz_date} | 申请人：{detail.requester} | 状态：{statusMap[detail.status] || detail.status}</p>
        {detail.note && <p>备注：{detail.note}</p>}
        <div style={{ marginBottom: 16 }}>
          <Select
            value={detail.status}
            onChange={setStatus}
            style={{ width: 140 }}
            options={[
              { value: detail.status, label: statusMap[detail.status] || detail.status },
              ...(canSubmit ? [{ value: 'SUBMITTED', label: '→ 提交' }] : []),
              ...(canClose ? [{ value: 'CLOSED', label: '→ 关闭' }] : []),
            ]}
          />
          <span style={{ marginLeft: 8 }}>变更状态</span>
        </div>
        <Table columns={columns} dataSource={items} rowKey="id" size="small" pagination={false} />
      </Card>

      <Modal
        title="申报页预览 — 拖动表头调整列宽，保存后将用于导出 PDF/Excel 与打印"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setPreviewOpen(false)}>关闭</Button>
            <Button type="primary" onClick={saveClaimFormat}>
              保存为默认格式
            </Button>
          </Space>
        }
        width="90%"
        destroyOnClose
      >
        <p style={{ marginBottom: 12, color: '#666' }}>
          调整下列列宽后点击「保存为默认格式」，之后导出的 PDF、Excel 及打印将使用当前列宽比例。
        </p>
        <Table
          columns={previewColumns}
          dataSource={previewDataSource}
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          components={{ header: { cell: ResizableTitle } }}
        />
      </Modal>
    </div>
  );
}
