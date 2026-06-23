import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Spin, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { defectApi } from '../../api/defect';
import dayjs from 'dayjs';

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'blue', text: '待处理' },
  in_progress: { color: 'orange', text: '处理中' },
  fully_resolved: { color: 'green', text: '已全部消除' },
  partially_resolved: { color: 'gold', text: '已部分消除' },
  cancelled: { color: 'default', text: '已取消' },
};

const severityMap: Record<number, { color: string; text: string }> = {
  1: { color: 'red', text: '一级(危急)' },
  2: { color: 'orange', text: '二级(严重)' },
  3: { color: 'blue', text: '三级(一般)' },
};

export default function DefectOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    defectApi.get(Number(id)).then((res) => {
      setOrder(res.data);
      setLoading(false);
    });
  }, [id]);

  const handleComplete = async (status: string) => {
    await defectApi.complete(Number(id), status);
    message.success('处理完成');
    const res = await defectApi.get(Number(id));
    setOrder(res.data);
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!order) return <div>工单不存在</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/defect')}>返回</Button>
          <h2 style={{ margin: 0 }}>消缺工单 - {order.order_no}</h2>
        </Space>
        <Tag color={statusMap[order.status]?.color} style={{ fontSize: 14, padding: '4px 12px' }}>
          {statusMap[order.status]?.text}
        </Tag>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2} size="small" title="工单信息">
          <Descriptions.Item label="工单编号">{order.order_no}</Descriptions.Item>
          <Descriptions.Item label="等级">
            <Tag color={severityMap[order.severity]?.color}>{severityMap[order.severity]?.text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="缺陷名称">{order.defect_name}</Descriptions.Item>
          <Descriptions.Item label="缺陷类型">{order.defect_type}</Descriptions.Item>
          <Descriptions.Item label="紧急抢修">
            {order.is_emergency === 'true' ? <Tag color="red">是</Tag> : '否'}
          </Descriptions.Item>
          <Descriptions.Item label="位置">
            {[order.location_province, order.location_city, order.location_district, order.location_detail].filter(Boolean).join('')}
          </Descriptions.Item>
          <Descriptions.Item label="巡检人">{order.inspector_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核人">{order.reviewer_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>{order.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="完成时间">{order.completed_at ? dayjs(order.completed_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="处理操作">
        <div style={{ display: 'flex', gap: 16 }}>
          {order.status === 'pending' && (
            <Button type="primary" onClick={async () => {
              await defectApi.update(order.id, { status: 'in_progress' });
              const res = await defectApi.get(Number(id));
              setOrder(res.data);
              message.success('开始处理');
            }}>开始处理</Button>
          )}
          {order.status === 'in_progress' && (
            <Space>
              <Button type="primary" onClick={() => handleComplete('fully_resolved')}>全部消除</Button>
              <Button onClick={() => handleComplete('partially_resolved')}>部分消除</Button>
            </Space>
          )}
          {(order.status === 'pending' || order.status === 'in_progress') && (
            <Button danger onClick={async () => {
              await defectApi.cancel(order.id);
              const res = await defectApi.get(Number(id));
              setOrder(res.data);
              message.success('已取消');
            }}>取消工单</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
