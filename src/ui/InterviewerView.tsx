import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Table, Card, Input, Tag, Modal, Descriptions } from 'antd';

export const InterviewerView: React.FC = () => {
  const candidates = useSelector((s: RootState) => s.candidates.list);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => candidates
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0)), [candidates, search]);

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Score', dataIndex: 'finalScore', key: 'finalScore', render: (v: number) => v ?? '-' },
    { title: 'Status', key: 'status', render: (_: any, r: any) => r.completed ? <Tag color="green">Completed</Tag> : <Tag color="blue">In Progress</Tag> }
  ];

  const selected = candidates.find(c => c.id === selectedId);

  return (
    <Card title="Candidates" extra={<Input.Search placeholder="Search" onSearch={setSearch} allowClear style={{ width: 240 }} />}>      
      <Table
        dataSource={filtered.map(c => ({ ...c, key: c.id }))}
        columns={columns}
        size="small"
        onRow={record => ({ onClick: () => setSelectedId(record.id) })}
      />

      <Modal open={!!selected} title={selected?.name} width={800} onCancel={() => setSelectedId(null)} footer={null}>
        {selected && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Email">{selected.email}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selected.phone}</Descriptions.Item>
              <Descriptions.Item label="Score" span={2}>{selected.finalScore ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Summary" span={2}>{selected.summary ?? 'N/A'}</Descriptions.Item>
            </Descriptions>
            <Card title="Questions" size="small" style={{ marginTop: 12 }}>
              {selected.questions.map((q, i) => (
                <Card key={q.id} type="inner" title={`Q${i + 1} (${q.difficulty}) - ${q.score ?? (q.evaluating ? '…' : '-')}` } style={{ marginBottom: 8 }}>
                  <p><strong>Prompt:</strong> {q.prompt}</p>
                  <p><strong>Answer:</strong> {q.answer || '(no answer)'} </p>
                  {q.evaluating && <p><em>Evaluating with AI…</em></p>}
                  {q.feedback && <p><strong>Feedback:</strong> {q.feedback}</p>}
                </Card>
              ))}
            </Card>
          </>
        )}
      </Modal>
    </Card>
  );
};
