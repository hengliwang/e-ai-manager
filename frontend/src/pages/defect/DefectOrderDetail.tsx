import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Spin, message, Modal, Form, Input, Select, Upload, Image, Row, Col } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, CameraOutlined } from '@ant-design/icons';
import { defectApi, type DefectOrder } from '../../api/defect';
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
  const [order, setOrder] = useState<DefectOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [processModal, setProcessModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [processForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [cancelForm] = Form.useForm();
  const navigate = useNavigate();

  const fetchOrder = async () => {
    if (!id) return;
    const res = await defectApi.get(Number(id));
    setOrder(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const handleProcess = async (values: any) => {
    const photoPaths: string[] = [];
    if (values.after_photos?.fileList) {
      for (const f of values.after_photos.fileList) {
        photoPaths.push(f.name || f.response?.path || '/photos/' + f.name);
      }
    }
    await defectApi.process(Number(id), {
      process_status: values.process_status,
      process_description: values.process_description,
      after_photo_paths: photoPaths.length > 0 ? photoPaths : undefined,
    });
    message.success('处理完成');
    setProcessModal(false);
    processForm.resetFields();
    fetchOrder();
  };

  const handleAssign = async (values: { repairer_id: number }) => {
    await defectApi.assign(Number(id), values.repairer_id);
    message.success('已派发');
    setAssignModal(false);
    assignForm.resetFields();
    fetchOrder();
  };

  const handleCancel = async (values: { reason: string }) => {
    await defectApi.cancel(Number(id), values.reason);
    message.success('已取消');
    setCancelModal(false);
    cancelForm.resetFields();
    fetchOrder();
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!order) return <div>工单不存在</div>;

  const photoBaseUrl = 'http://localhost:8000';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/defect')}>返回</Button>
          <h2 style={{ margin: 0 }}>消缺工单 - {order.order_no}</h2>
        </Space>
        <Space>
          <Tag color={statusMap[order.status]?.color} style={{ fontSize: 14, padding: '4px 12px' }}>
            {statusMap[order.status]?.text}
          </Tag>
          {order.overdue_days ? <Tag color="red">超期{order.overdue_days}天</Tag> : null}
        </Space>
      </div>

      {/* 基础信息 */}
      <Card style={{ marginBottom: 16 }} title="工单信息">
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="工单编号">{order.order_no}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusMap[order.status]?.color}>{statusMap[order.status]?.text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="缺陷名称">{order.defect_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="缺陷类型">{order.defect_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="缺陷等级">
            <Tag color={severityMap[order.severity]?.color}>{severityMap[order.severity]?.text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="紧急抢修">
            {order.is_emergency === 'true' ? <Tag color="red">是</Tag> : '否'}
          </Descriptions.Item>
          <Descriptions.Item label="设备名称">{order.equipment_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="设备类型">{order.equipment_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属客户">{order.customer_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="位置">
            {[order.location_province, order.location_city, order.location_district, order.location_street, order.location_detail].filter(Boolean).join('') || '-'}
            {order.longitude && order.latitude ? (
              <a href={`https://uri.amap.com/marker?position=${order.longitude},${order.latitude}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
                查看地图
              </a>
            ) : null}
          </Descriptions.Item>
          <Descriptions.Item label="经纬度">
            {order.longitude && order.latitude ? `${order.longitude}, ${order.latitude}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="上报人">{order.inspector_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核人">{order.reviewer_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="处理人">{order.repairer_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="缺陷描述" span={2}>{order.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{order.created_at ? dayjs(order.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="SLA截止时间">
            {order.deadline ? (
              <span style={{ color: order.overdue_days ? '#ff4d4f' : undefined }}>
                {dayjs(order.deadline).format('YYYY-MM-DD HH:mm')}
              </span>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">{order.completed_at ? dayjs(order.completed_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="取消时间">{order.cancelled_at ? dayjs(order.cancelled_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          {order.cancel_reason && (
            <Descriptions.Item label="取消原因" span={2}>
              <span style={{ color: '#ff4d4f' }}>{order.cancel_reason}</span>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* 历史处理记录 */}
      {order.last_processed_date && (
        <Card style={{ marginBottom: 16 }} title="历史处理记录">
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="最近处理日期">
              {dayjs(order.last_processed_date).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="最近处理人">{order.last_processor_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="处理结果" span={2}>
              {order.last_process_result === 'fully_resolved' ? '已全部消除' :
               order.last_process_result === 'partially_resolved' ? '已部分消除' : order.last_process_result || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 处理说明 + 处理记录 */}
      {order.process_description && (
        <Card style={{ marginBottom: 16 }} title="处理记录">
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="处理说明">{order.process_description}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 照片对比 */}
      <Card title="照片对比" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={12}>
            <h4 style={{ textAlign: 'center' }}>
              <CameraOutlined /> 消缺前
            </h4>
            {order.before_photo_path ? (
              <Image src={photoBaseUrl + order.before_photo_path} style={{ width: '100%' }} fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999', background: '#f5f5f5', borderRadius: 8 }}>
                无消缺前照片
              </div>
            )}
          </Col>
          <Col span={12}>
            <h4 style={{ textAlign: 'center' }}>
              <CameraOutlined /> 消缺后
            </h4>
            {order.after_photo_paths && order.after_photo_paths.length > 0 ? (
              <Image.PreviewGroup>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {order.after_photo_paths.map((path: string, idx: number) => (
                    <Image key={idx} src={photoBaseUrl + path} width="48%" style={{ objectFit: 'cover' }} />
                  ))}
                </div>
              </Image.PreviewGroup>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999', background: '#f5f5f5', borderRadius: 8 }}>
                无消缺后照片
              </div>
            )}
          </Col>
        </Row>
      </Card>

      {/* 操作区 */}
      <Card title="操作">
        <Space size={12}>
          {order.can_assign && (
            <Button type="primary" onClick={() => { assignForm.resetFields(); setAssignModal(true); }}>
              派发处理人
            </Button>
          )}
          {order.can_start && (
            <Button type="primary" onClick={async () => {
              await defectApi.update(order.id, { status: 'in_progress' });
              message.success('已开始处理');
              fetchOrder();
            }}>开始处理</Button>
          )}
          {order.can_process && (
            <Button type="primary" onClick={() => { processForm.resetFields(); setProcessModal(true); }}>
              处理缺陷
            </Button>
          )}
          {order.can_cancel && (
            <Button danger onClick={() => { cancelForm.resetFields(); setCancelModal(true); }}>
              取消工单
            </Button>
          )}
          {order.can_delete && (
            <Button danger onClick={async () => {
              await defectApi.delete(order.id);
              message.success('工单已删除');
              navigate('/defect');
            }}>删除工单</Button>
          )}
        </Space>
      </Card>

      {/* 处理弹窗 */}
      <Modal title="处理缺陷" open={processModal} width={640}
        onCancel={() => setProcessModal(false)} onOk={() => processForm.submit()}>
        <Form form={processForm} layout="vertical" onFinish={handleProcess}>
          <Form.Item label="处理状态" name="process_status" rules={[{ required: true, message: '请选择处理状态' }]}>
            <Select options={[
              { label: '已全部消除', value: 'fully_resolved' },
              { label: '已部分消除', value: 'partially_resolved' },
            ]} />
          </Form.Item>
          <Form.Item label="处理说明" name="process_description" rules={[{ required: true, message: '请填写处理说明' }]}>
            <Input.TextArea rows={4} placeholder="请描述处理措施和结果" />
          </Form.Item>
          <Form.Item label="处理后照片" name="after_photos" extra="至少上传1张，包含全景、细节">
            <Upload multiple maxCount={5} beforeUpload={() => false} listType="picture-card">
              <div>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>上传</div>
              </div>
            </Upload>
          </Form.Item>
          <div style={{ padding: '8px 12px', background: '#fff7e6', borderRadius: 4, fontSize: 13, color: '#ad6800' }}>
            提示：系统将AI比对处理前后照片。若缺陷特征未明显消失，会弹出警告提示。
          </div>
        </Form>
      </Modal>

      {/* 派发弹窗 */}
      <Modal title="派发工单" open={assignModal}
        onCancel={() => setAssignModal(false)} onOk={() => assignForm.submit()}>
        <Form form={assignForm} layout="vertical" onFinish={handleAssign}>
          <Form.Item label="处理人" name="repairer_id" rules={[{ required: true }]}>
            <Select options={[
              { label: '赵强 (检修一班)', value: 5 },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 取消弹窗 */}
      <Modal title="取消工单" open={cancelModal}
        onCancel={() => setCancelModal(false)} onOk={() => cancelForm.submit()}>
        <Form form={cancelForm} layout="vertical" onFinish={handleCancel}>
          <Form.Item label="取消原因" name="reason" rules={[{ required: true }]}>
            <Select placeholder="请选择取消原因" options={[
              { label: '重复派单', value: '重复派单' },
              { label: '缺陷已自然消除', value: '缺陷已自然消除' },
              { label: '设备已停运', value: '设备已停运' },
              { label: '其他', value: '其他' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
