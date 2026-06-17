import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tabs, Tag, Button, Space, Spin, Table, Timeline, Image } from 'antd';
import { EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { equipmentApi, type EquipmentData } from '../../api/equipment';
import { inspectionApi } from '../../api/inspection';
import dayjs from 'dayjs';

export default function EquipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [equipment, setEquipment] = useState<EquipmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inspectionRecords, setInspectionRecords] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      equipmentApi.get(Number(id)),
      inspectionApi.list({ keyword: '', limit: 50 }),
    ]).then(([eqRes, insRes]) => {
      setEquipment(eqRes.data);
      setInspectionRecords(insRes.data.items?.filter((t: any) => t.equipment_id === Number(id)) || []);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!equipment) return <div>设备不存在</div>;

  const item = equipment as any;

  const inspectionColumns = [
    { title: '任务编号', dataIndex: 'task_no', width: 150 },
    { title: '巡检日期', dataIndex: 'inspection_date', width: 110 },
    { title: '巡检人', dataIndex: 'inspector_name', width: 100 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (s: string) => {
        const map: Record<string, { color: string; text: string }> = {
          completed: { color: 'green', text: '已完成' },
          pending: { color: 'blue', text: '待巡检' },
          submitted: { color: 'purple', text: '待审核' },
          in_progress: { color: 'orange', text: '进行中' },
          suspended: { color: 'default', text: '已挂起' },
          rejected: { color: 'red', text: '已驳回' },
        };
        return <Tag color={map[s]?.color}>{map[s]?.text || s}</Tag>;
      },
    },
    { title: '缺陷数', dataIndex: 'defect_count', width: 80 },
  ];

  const tabItems = [
    {
      key: 'basic',
      label: '基础信息',
      children: (
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="设备大类"><Tag color={item.category === '电器类' ? 'blue' : 'orange'}>{item.category}</Tag></Descriptions.Item>
          <Descriptions.Item label="设备类型">{item.equipment_type}</Descriptions.Item>
          <Descriptions.Item label="设备名称">{item.equipment_name}</Descriptions.Item>
          <Descriptions.Item label="资产编码">{item.asset_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="线路名称">{item.line_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="站所名称">{item.station_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="柜型/型号">{item.cabinet_model || '-'}</Descriptions.Item>
          <Descriptions.Item label="出厂编号">{item.factory_number || '-'}</Descriptions.Item>
          <Descriptions.Item label="投运日期">{item.operation_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="厂家信息">{item.manufacturer || '-'}</Descriptions.Item>
          <Descriptions.Item label="地址" span={2}>
            {[item.province, item.city, item.district, item.street, item.address_detail].filter(Boolean).join('')}
          </Descriptions.Item>
          <Descriptions.Item label="经纬度">{item.longitude}, {item.latitude}</Descriptions.Item>
          <Descriptions.Item label="所属客户">{item.customer_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{item.remark || '-'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'inspection',
      label: '巡检记录',
      children: (
        <Table
          dataSource={inspectionRecords}
          columns={inspectionColumns}
          rowKey="id"
          size="small"
          pagination={false}
          onRow={(record) => ({
            onClick: () => navigate(`/inspection/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      ),
    },
    {
      key: 'photos',
      label: '照片时间轴',
      children: (
        <div style={{ padding: 16 }}>
          {item.photos && item.photos.length > 0 ? (
            <Timeline
              items={item.photos.map((p: any) => ({
                children: (
                  <div>
                    <div style={{ color: '#666', fontSize: 12 }}>{dayjs(p.created_at).format('YYYY-MM-DD HH:mm')}</div>
                    <div style={{ marginTop: 4 }}>
                      <Tag>{p.photo_type}</Tag>
                      {p.is_current === 'true' && <Tag color="green">当前主图</Tag>}
                    </div>
                    {p.description && <div style={{ color: '#999' }}>{p.description}</div>}
                  </div>
                ),
              }))}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无照片记录</div>
          )}
        </div>
      ),
    },
    {
      key: 'logs',
      label: '变更日志',
      children: (
        <div style={{ padding: 16 }}>
          {item.audit_logs && item.audit_logs.length > 0 ? (
            <Timeline
              items={item.audit_logs.map((log: any) => ({
                children: (
                  <div>
                    <div style={{ color: '#666', fontSize: 12 }}>{dayjs(log.modified_at).format('YYYY-MM-DD HH:mm')}</div>
                    <div><strong>{log.field_name}</strong>: {log.old_value || '(空)'} → {log.new_value}</div>
                  </div>
                ),
              }))}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无变更记录</div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/equipment')}>返回</Button>
          <h2 style={{ margin: 0 }}>{item.equipment_name}</h2>
        </Space>
        <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/equipment/${id}/edit`)}>
          编辑
        </Button>
      </div>
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}
