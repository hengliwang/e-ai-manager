import { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Table, Tag, Spin } from 'antd';
import {
  ToolOutlined,
  ScheduleOutlined,
  AuditOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { dashboardApi } from '../../api/defect';
import { inspectionApi } from '../../api/inspection';
import dayjs from 'dayjs';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>({});
  const [defectDist, setDefectDist] = useState<any[]>([]);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getDefectDistribution(),
      inspectionApi.list({ limit: 5 }),
    ]).then(([statsRes, distRes, tasksRes]) => {
      setStats(statsRes.data);
      setDefectDist(distRes.data);
      setRecentTasks(tasksRes.data.items || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;

  const pieOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: defectDist,
      label: { show: true, formatter: '{b}: {c}' },
    }],
  };

  const taskColumns = [
    { title: '任务编号', dataIndex: 'task_no', key: 'task_no', width: 150 },
    { title: '设备名称', dataIndex: 'equipment_name', key: 'equipment_name' },
    { title: '巡检日期', dataIndex: 'inspection_date', key: 'inspection_date', width: 110 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => {
        const map: Record<string, { color: string; text: string }> = {
          pending: { color: 'blue', text: '待巡检' },
          in_progress: { color: 'orange', text: '进行中' },
          submitted: { color: 'purple', text: '待审核' },
          completed: { color: 'green', text: '已巡检' },
          rejected: { color: 'red', text: '已驳回' },
        };
        return <Tag color={map[s]?.color}>{map[s]?.text || s}</Tag>;
      },
    },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 80,
      render: (p: number) => {
        const map: Record<number, { color: string; text: string }> = { 1: 'red', 2: 'orange', 3: 'default' };
        const texts: Record<number, string> = { 1: '危急', 2: '严重', 3: '一般' };
        return <Tag color={map[p] || 'default'}>{texts[p] || p}</Tag>;
      },
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>数据看板</h2>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="设备总数" value={stats.total_equipment} prefix={<ToolOutlined />} valueStyle={{ color: '#1a7a3a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="待巡检任务" value={stats.pending_tasks} prefix={<ScheduleOutlined />} valueStyle={{ color: '#1677ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="待审核" value={stats.submitted_tasks} prefix={<AuditOutlined />} valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="待处理缺陷" value={stats.pending_defects} prefix={<AlertOutlined />} valueStyle={{ color: '#cf1322' }} /></Card>
        </Col>
      </Row>

      <div className="charts-row">
        <Card title="缺陷分布">
          {defectDist.length > 0 ? (
            <ReactECharts option={pieOption} style={{ height: 300 }} />
          ) : (
            <div style={{ textAlign: 'center', padding: 80, color: '#999' }}>暂无缺陷数据</div>
          )}
        </Card>
        <Card title="巡检完成情况">
          <div style={{ padding: '40px 0' }}>
            <Row gutter={24}>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, color: '#1a7a3a', fontWeight: 700 }}>{stats.completed_tasks || 0}</div>
                <div style={{ color: '#666' }}>已完成</div>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, color: '#1677ff', fontWeight: 700 }}>{stats.pending_tasks || 0}</div>
                <div style={{ color: '#666' }}>待巡检</div>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, color: '#722ed1', fontWeight: 700 }}>{stats.submitted_tasks || 0}</div>
                <div style={{ color: '#666' }}>待审核</div>
              </Col>
            </Row>
          </div>
        </Card>
      </div>

      <Card title="最新巡检任务">
        <Table
          dataSource={recentTasks}
          columns={taskColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
}
