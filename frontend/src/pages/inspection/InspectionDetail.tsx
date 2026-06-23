import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { inspectionApi } from '../../api/inspection';

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'blue', text: '待巡检' },
  in_progress: { color: 'orange', text: '进行中' },
  submitted: { color: 'purple', text: '待审核' },
  completed: { color: 'green', text: '已巡检' },
  rejected: { color: 'red', text: '已驳回' },
  cancelled: { color: 'default', text: '已取消' },
  suspended: { color: 'default', text: '已挂起' },
};

export default function InspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<any>(null);
  const [defects, setDefects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      inspectionApi.get(Number(id)),
      inspectionApi.getDefects(Number(id)),
    ]).then(([taskRes, defectRes]) => {
      setTask(taskRes.data);
      setDefects(defectRes.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!task) return <div>任务不存在</div>;

  const severityMap: Record<number, { color: string; text: string }> = {
    1: { color: 'red', text: '一级(危急)' },
    2: { color: 'orange', text: '二级(严重)' },
    3: { color: 'blue', text: '三级(一般)' },
  };

  const sourceMap: Record<string, { color: string; text: string }> = {
    ai: { color: 'blue', text: 'AI识别' },
    manual: { color: 'green', text: '人工新增' },
    corrected: { color: 'purple', text: '人工修正' },
    removed: { color: 'red', text: '人工剔除' },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inspection')}>返回</Button>
          <h2 style={{ margin: 0 }}>巡检任务详情 - {task.task_no}</h2>
        </Space>
        <Tag color={statusMap[task.status]?.color} style={{ fontSize: 14, padding: '4px 12px' }}>
          {statusMap[task.status]?.text}
        </Tag>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2} size="small" title="基本信息">
          <Descriptions.Item label="任务编号">{task.task_no}</Descriptions.Item>
          <Descriptions.Item label="巡检类型">{task.inspection_type}</Descriptions.Item>
          <Descriptions.Item label="设备名称">{task.equipment_name}</Descriptions.Item>
          <Descriptions.Item label="设备类型">{task.equipment_type}</Descriptions.Item>
          <Descriptions.Item label="巡检日期">{task.inspection_date}</Descriptions.Item>
          <Descriptions.Item label="巡检人">{task.inspector_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属客户">{task.customer_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="缺陷数">{task.defect_count || 0}</Descriptions.Item>
          {task.cancel_reason && <Descriptions.Item label="取消原因">{task.cancel_reason}</Descriptions.Item>}
          {task.reject_reason && <Descriptions.Item label="驳回原因">{task.reject_reason}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card title="缺陷记录">
        {defects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>无缺陷记录</div>
        ) : (
          defects.map((d: any) => (
            <Card key={d.id} size="small" style={{ marginBottom: 8 }} type="inner">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Space>
                  <Tag color={severityMap[d.severity]?.color}>{severityMap[d.severity]?.text}</Tag>
                  <strong>{d.defect_name}</strong>
                  <span style={{ color: '#666' }}>{d.defect_type}</span>
                  {d.confidence && <span style={{ color: '#999' }}>置信度: {(d.confidence * 100).toFixed(0)}%</span>}
                </Space>
                <Space>
                  <Tag color={sourceMap[d.source]?.color}>{sourceMap[d.source]?.text}</Tag>
                  {d.is_emergency === 'true' && <Tag color="red">紧急抢修</Tag>}
                </Space>
              </div>
              {d.description && <div style={{ marginTop: 8, color: '#666' }}>{d.description}</div>}
            </Card>
          ))
        )}
      </Card>
    </div>
  );
}
