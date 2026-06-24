import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Spin, message, Input, Modal, Row, Col, Image, Divider, Select, Empty } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { inspectionApi } from '../../api/inspection';

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

type DefectAction = 'pending' | 'approved' | 'corrected' | 'removed';

interface DefectWithAction {
  id: number;
  defect_type: string;
  defect_name: string;
  severity: number;
  confidence?: number;
  source: string;
  description?: string;
  is_emergency: string;
  ai_raw_result?: any;
  // UI state
  action: DefectAction;
  corrected_name?: string;
  corrected_type?: string;
  corrected_severity?: number;
  corrected_emergency?: string;
  corrected_description?: string;
}

export default function InspectionReview() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<any>(null);
  const [defects, setDefects] = useState<DefectWithAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; defect: DefectWithAction | null }>({ open: false, defect: null });
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      inspectionApi.get(Number(id)),
      inspectionApi.getDefects(Number(id)),
    ]).then(([taskRes, defectRes]) => {
      setTask(taskRes.data);
      setDefects((defectRes.data || []).map((d: any) => ({
        ...d,
        action: 'pending' as DefectAction,
        corrected_name: d.defect_name,
        corrected_type: d.defect_type,
        corrected_severity: d.severity,
        corrected_emergency: d.is_emergency,
        corrected_description: d.description,
      })));
      setLoading(false);
    });
  }, [id]);

  const updateDefect = (defectId: number, updates: Partial<DefectWithAction>) => {
    setDefects(prev => prev.map(d => d.id === defectId ? { ...d, ...updates } : d));
  };

  const handleApproveDefect = (defectId: number) => {
    updateDefect(defectId, { action: 'approved' });
  };

  const handleRemoveDefect = (defectId: number) => {
    updateDefect(defectId, { action: 'removed' });
  };

  const handleCorrectDefect = (defect: DefectWithAction) => {
    setEditModal({ open: true, defect: { ...defect } });
  };

  const handleSaveCorrection = () => {
    if (!editModal.defect) return;
    const d = editModal.defect;
    updateDefect(d.id, {
      action: 'corrected',
      corrected_name: d.corrected_name || d.defect_name,
      corrected_type: d.corrected_type || d.defect_type,
      corrected_severity: d.corrected_severity ?? d.severity,
      corrected_emergency: d.corrected_emergency ?? d.is_emergency,
      corrected_description: d.corrected_description,
    });
    setEditModal({ open: false, defect: null });
  };

  const handleSubmitReview = async () => {
    const hasPending = defects.some(d => d.action === 'pending');
    if (hasPending) {
      message.warning('还有缺陷未处理，请先逐个审核');
      return;
    }

    setSubmitting(true);
    try {
      const approvedDefects = defects.filter(d => d.action === 'approved');
      const correctedDefects = defects.filter(d => d.action === 'corrected');
      const hasRemoved = defects.some(d => d.action === 'removed');

      // If all are approved as-is and some defects exist, use approve
      if (approvedDefects.length === defects.length && defects.length > 0) {
        await inspectionApi.review(Number(id), { action: 'approve' });
        message.success('审核通过，消缺工单已自动生成');
      } else if (approvedDefects.length === defects.length && defects.length === 0 && correctedDefects.length === 0) {
        // All removed -> approve with no defects
        await inspectionApi.review(Number(id), { action: 'approve' });
        message.success('审核通过');
      } else if (correctedDefects.length > 0 || approvedDefects.length > 0) {
        // Mix of approved and corrected -> use correct action
        const finalDefects = [
          ...approvedDefects.map(d => ({
            defect_type: d.defect_type,
            defect_name: d.defect_name,
            severity: d.severity,
            confidence: d.confidence,
            source: d.source,
            description: d.description,
            is_emergency: d.is_emergency,
          })),
          ...correctedDefects.map(d => ({
            defect_type: d.corrected_type || d.defect_type,
            defect_name: d.corrected_name || d.defect_name,
            severity: d.corrected_severity ?? d.severity,
            confidence: d.confidence,
            source: 'corrected',
            description: d.corrected_description || d.description,
            is_emergency: d.corrected_emergency || d.is_emergency,
          })),
        ];
        await inspectionApi.review(Number(id), { action: 'correct', corrected_defects: finalDefects });
        message.success('修正审核完成，消缺工单已生成');
      } else {
        // Nothing approved -> use reject
        if (!rejectReason) {
          setRejectModal(true);
          setSubmitting(false);
          return;
        }
        await inspectionApi.review(Number(id), { action: 'reject', reason: rejectReason });
        message.success('已驳回');
      }
      navigate('/inspection');
    } catch {
      message.error('审核操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { message.warning('请填写驳回原因'); return; }
    setSubmitting(true);
    try {
      await inspectionApi.review(Number(id), { action: 'reject', reason: rejectReason });
      message.success('已驳回');
      setRejectModal(false);
      navigate('/inspection');
    } catch {
      message.error('驳回失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!task) return <div>任务不存在</div>;

  const pendingCount = defects.filter(d => d.action === 'pending').length;
  const approvedCount = defects.filter(d => d.action === 'approved').length;
  const removedCount = defects.filter(d => d.action === 'removed').length;
  const correctedCount = defects.filter(d => d.action === 'corrected').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inspection')}>返回</Button>
          <h2 style={{ margin: 0 }}>巡检审核 - {task.task_no}</h2>
        </Space>
        <Space>
          <span style={{ color: '#666', fontSize: 13 }}>
            待处理: <strong style={{ color: '#faad14' }}>{pendingCount}</strong>
            &nbsp;| 通过: <strong style={{ color: '#52c41a' }}>{approvedCount}</strong>
            &nbsp;| 修正: <strong style={{ color: '#722ed1' }}>{correctedCount}</strong>
            &nbsp;| 剔除: <strong style={{ color: '#ff4d4f' }}>{removedCount}</strong>
          </span>
          <Button type="primary" onClick={handleSubmitReview} loading={submitting} icon={<CheckOutlined />}>
            提交审核结果
          </Button>
          <Button danger onClick={() => setRejectModal(true)} icon={<CloseOutlined />}>
            整单驳回
          </Button>
        </Space>
      </div>

      {/* Task Info */}
      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="任务编号">{task.task_no}</Descriptions.Item>
          <Descriptions.Item label="审核状态">
            <Tag color="purple">待审核</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="设备">{task.equipment_name}</Descriptions.Item>
          <Descriptions.Item label="设备类型">{task.equipment_type}</Descriptions.Item>
          <Descriptions.Item label="巡检人">{task.inspector_name}</Descriptions.Item>
          <Descriptions.Item label="巡检日期">{task.inspection_date}</Descriptions.Item>
          <Descriptions.Item label="所属客户">{task.customer_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="线路/站所">{task.line_name || task.station_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="地址" span={2}>
            {[task.location_province, task.location_city, task.location_district, task.location_street, task.address_detail]
              .filter(Boolean).join(' ')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Defects Review */}
      <Card
        title={`缺陷审核 (${defects.length}条)`}
        extra={
          defects.length > 0 && (
            <Space size="small">
              <Button size="small" onClick={() => setDefects(prev => prev.map(d => ({ ...d, action: 'approved' as DefectAction })))}>
                全部通过
              </Button>
              <Button size="small" danger onClick={() => setDefects(prev => prev.map(d => ({ ...d, action: 'removed' as DefectAction })))}>
                全部剔除
              </Button>
              <Button size="small" onClick={() => setDefects(prev => prev.map(d => ({ ...d, action: 'pending' as DefectAction })))}>
                全部重置
              </Button>
            </Space>
          )
        }
      >
        {defects.length === 0 ? (
          <Empty description="无缺陷 - 标记为「无缺陷」巡检">
            <Button type="primary" onClick={handleSubmitReview} loading={submitting}>确认通过</Button>
          </Empty>
        ) : (
          defects.map((d: DefectWithAction) => {
            const isModified = d.source === 'manual' || d.source === 'corrected';
            const actionColor = d.action === 'approved' ? '#52c41a' : d.action === 'corrected' ? '#722ed1' : d.action === 'removed' ? '#ff4d4f' : '#d9d9d9';
            const actionBg = d.action === 'approved' ? '#f6ffed' : d.action === 'corrected' ? '#f9f0ff' : d.action === 'removed' ? '#fff2f0' : '#fff';

            return (
              <Card
                key={d.id}
                size="small"
                style={{ marginBottom: 12, border: `1px solid ${actionColor}`, background: actionBg }}
                type="inner"
              >
                {/* AI vs Human comparison row */}
                <Row gutter={16}>
                  {/* Left: AI Original */}
                  <Col span={11}>
                    <div style={{ padding: 12, background: '#f6f8fa', borderRadius: 6, height: '100%' }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, color: '#1a7a3a', fontSize: 13 }}>
                        AI 原始判断
                      </div>
                      {d.ai_raw_result ? (
                        <div>
                          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', margin: 0, maxHeight: 150, overflow: 'auto' }}>
                            {JSON.stringify(d.ai_raw_result, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div style={{ color: '#999', fontSize: 12 }}>
                          <Tag color={sourceMap[d.source]?.color} style={{ marginBottom: 8 }}>
                            {sourceMap[d.source]?.text}
                          </Tag>
                          <div>{isModified ? '无AI记录(纯人工标注)' : `AI置信度: ${d.confidence ? (d.confidence * 100).toFixed(0) + '%' : '-'}`}</div>
                        </div>
                      )}
                    </div>
                  </Col>

                  {/* Center: Arrow + Action */}
                  <Col span={2} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 20, color: actionColor }}>→</div>
                    {d.action !== 'pending' && (
                      <Tag color={actionColor} style={{ marginTop: 4 }}>
                        {d.action === 'approved' ? '已通过' : d.action === 'corrected' ? '已修正' : '已剔除'}
                      </Tag>
                    )}
                  </Col>

                  {/* Right: Human Final */}
                  <Col span={11}>
                    <div style={{
                      padding: 12, background: d.action === 'corrected' ? '#f9f0ff' : '#fff7e6',
                      borderRadius: 6, border: d.action === 'corrected' ? '1px dashed #722ed1' : 'none',
                      opacity: d.action === 'removed' ? 0.4 : 1,
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, color: '#fa8c16', fontSize: 13 }}>
                        人工终稿
                        {d.action === 'corrected' && <Tag color="purple" style={{ marginLeft: 8 }}>已修正</Tag>}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <Tag color={severityMap[d.action === 'corrected' ? (d.corrected_severity ?? d.severity) : d.severity]?.color}>
                          {severityMap[d.action === 'corrected' ? (d.corrected_severity ?? d.severity) : d.severity]?.text}
                        </Tag>
                        <strong style={{ textDecoration: d.action === 'corrected' ? 'underline' : 'none' }}>
                          {d.action === 'corrected' ? d.corrected_name : d.defect_name}
                        </strong>
                      </div>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        <span>{d.action === 'corrected' ? d.corrected_type : d.defect_type}</span>
                        {d.confidence && d.action !== 'corrected' && (
                          <span style={{ marginLeft: 8, color: '#999' }}>AI置信度: {(d.confidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      {d.is_emergency === 'true' && <Tag color="red" style={{ marginTop: 4 }}>紧急抢修</Tag>}
                      {d.description && (
                        <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                          {d.action === 'corrected' ? (d.corrected_description || d.description) : d.description}
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>

                {/* Per-defect action buttons */}
                <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px dashed #e8e8e8', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  {d.action !== 'approved' && (
                    <Button size="small" type="primary" ghost icon={<CheckOutlined />} onClick={() => handleApproveDefect(d.id)}>
                      通过
                    </Button>
                  )}
                  {d.action !== 'corrected' && (
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleCorrectDefect(d)}>
                      修正
                    </Button>
                  )}
                  {d.action !== 'removed' && (
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveDefect(d.id)}>
                      剔除
                    </Button>
                  )}
                  {d.action !== 'pending' && (
                    <Button size="small" onClick={() => updateDefect(d.id, {
                      action: 'pending',
                      corrected_name: d.defect_name,
                      corrected_type: d.defect_type,
                      corrected_severity: d.severity,
                      corrected_emergency: d.is_emergency,
                      corrected_description: d.description,
                    })}>
                      重置
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </Card>

      {/* Reject Modal */}
      <Modal
        title="整单驳回"
        open={rejectModal}
        onOk={handleReject}
        onCancel={() => setRejectModal(false)}
        confirmLoading={submitting}
      >
        <div style={{ marginBottom: 12 }}>
          <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
          驳回后任务将退回至巡检人重新处理
        </div>
        <Input.TextArea
          rows={4}
          placeholder="请填写驳回原因（必填）"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

      {/* Correct/Edit Modal */}
      <Modal
        title="修正缺陷信息"
        open={editModal.open}
        onOk={handleSaveCorrection}
        onCancel={() => setEditModal({ open: false, defect: null })}
        width={520}
      >
        {editModal.defect && (
          <div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f6f8fa', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#1a7a3a', marginBottom: 8 }}>原始 AI 标注</div>
              <div><Tag color={severityMap[editModal.defect.severity]?.color}>{severityMap[editModal.defect.severity]?.text}</Tag>
                <strong>{editModal.defect.defect_name}</strong>
                <span style={{ color: '#666', marginLeft: 8 }}>{editModal.defect.defect_type}</span>
                {editModal.defect.confidence && <span style={{ color: '#999', marginLeft: 8 }}>置信度: {(editModal.defect.confidence * 100).toFixed(0)}%</span>}
              </div>
            </div>

            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>缺陷名称</div>
                <Input
                  value={editModal.defect.corrected_name || editModal.defect.defect_name}
                  onChange={(e) => setEditModal(prev => ({
                    ...prev,
                    defect: { ...prev.defect!, corrected_name: e.target.value },
                  }))}
                />
              </div>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>缺陷类型</div>
                <Input
                  value={editModal.defect.corrected_type || editModal.defect.defect_type}
                  onChange={(e) => setEditModal(prev => ({
                    ...prev,
                    defect: { ...prev.defect!, corrected_type: e.target.value },
                  }))}
                />
              </div>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>严重等级</div>
                <Select
                  value={editModal.defect.corrected_severity ?? editModal.defect.severity}
                  onChange={(v) => setEditModal(prev => ({
                    ...prev,
                    defect: { ...prev.defect!, corrected_severity: v },
                  }))}
                  style={{ width: '100%' }}
                  options={[
                    { label: '一级(危急)', value: 1 },
                    { label: '二级(严重)', value: 2 },
                    { label: '三级(一般)', value: 3 },
                  ]}
                />
              </div>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>紧急抢修</div>
                <Select
                  value={editModal.defect.corrected_emergency || editModal.defect.is_emergency}
                  onChange={(v) => setEditModal(prev => ({
                    ...prev,
                    defect: { ...prev.defect!, corrected_emergency: v },
                  }))}
                  style={{ width: '100%' }}
                  options={[
                    { label: '否', value: 'false' },
                    { label: '是', value: 'true' },
                  ]}
                />
              </div>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>描述</div>
                <Input.TextArea
                  rows={3}
                  value={editModal.defect.corrected_description || editModal.defect.description || ''}
                  onChange={(e) => setEditModal(prev => ({
                    ...prev,
                    defect: { ...prev.defect!, corrected_description: e.target.value },
                  }))}
                />
              </div>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}
