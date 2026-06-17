import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Spin, message, Input, Modal } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { inspectionApi } from '../../api/inspection';
import dayjs from 'dayjs';

export default function InspectionReview() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<any>(null);
  const [defects, setDefects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
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

  const handleApprove = async () => {
    try {
      await inspectionApi.review(Number(id), { action: 'approve' });
      message.success('审核通过，消缺工单已自动生成');
      navigate('/inspection');
    } catch {
      message.error('审核失败');
    }
  };

  const handleReject = async () => {
    try {
      await inspectionApi.review(Number(id), { action: 'reject', reason: rejectReason });
      message.success('已驳回');
      setRejectModal(false);
      navigate('/inspection');
    } catch {
      message.error('驳回失败');
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!task) return <div>任务不存在</div>;

  const severityMap: Record<number, { color: string; text: string }> = {
    1: { color: 'red', text: '一级(危急)' },
    2: { color: 'orange', text: '二级(严重)' },
    3: { color: 'blue', text: '三级(一般)' },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inspection')}>返回</Button>
          <h2 style={{ margin: 0 }}>巡检审核 - {task.task_no}</h2>
        </Space>
        <Space>
          <Button type="primary" onClick={handleApprove}>批量通过</Button>
          <Button danger onClick={() => setRejectModal(true)}>驳回</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="任务编号">{task.task_no}</Descriptions.Item>
          <Descriptions.Item label="设备">{task.equipment_name}</Descriptions.Item>
          <Descriptions.Item label="巡检人">{task.inspector_name}</Descriptions.Item>
          <Descriptions.Item label="巡检日期">{task.inspection_date}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={`缺陷列表 (${defects.length}条) - AI辅助审核`}>
        {defects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>无缺陷 - 标记为「无缺陷」巡检</div>
        ) : (
          defects.map((d: any) => (
            <Card key={d.id} size="small" style={{ marginBottom: 12 }} type="inner">
              <div style={{ display: 'flex', gap: 24 }}>
                {/* 左: AI原始判断 */}
                <div style={{ flex: 1, padding: 12, background: '#f6f8fa', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#1a7a3a' }}>AI 原始判断</div>
                  {d.ai_raw_result ? (
                    <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(d.ai_raw_result, null, 2)}</pre>
                  ) : (
                    <div style={{ color: '#999' }}>无AI记录(纯人工标注)</div>
                  )}
                </div>

                {/* 中: 箭头 */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, color: '#999' }}>→</div>

                {/* 右: 人工修正结果 */}
                <div style={{ flex: 1, padding: 12, background: '#fff7e6', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#fa8c16' }}>人工终稿</div>
                  <div>
                    <Tag color={severityMap[d.severity]?.color}>{severityMap[d.severity]?.text}</Tag>
                    <strong>{d.defect_name}</strong>
                    <span style={{ color: '#666', marginLeft: 8 }}>{d.defect_type}</span>
                  </div>
                  {d.confidence && <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>AI置信度: {(d.confidence * 100).toFixed(0)}%</div>}
                  {d.is_emergency === 'true' && <Tag color="red" style={{ marginTop: 4 }}>紧急抢修</Tag>}
                  {d.description && <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>{d.description}</div>}
                </div>
              </div>
            </Card>
          ))
        )}
      </Card>

      <Modal
        title="驳回原因"
        open={rejectModal}
        onOk={handleReject}
        onCancel={() => setRejectModal(false)}
      >
        <Input.TextArea
          rows={3}
          placeholder="请填写驳回原因"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
