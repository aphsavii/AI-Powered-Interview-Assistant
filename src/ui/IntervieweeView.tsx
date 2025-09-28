import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Upload, Form, Input, Space, Typography, Progress, Alert, Skeleton, Tooltip } from 'antd';
import type { UploadProps } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { parseResume } from '../services/resumeParser';
import { RootState, AppDispatch } from '../store';
import {
  createCandidate,
  answerQuestion,
  finalizeCandidate,
  updateProfile,
  fetchAIQuestion,
  scoreAIAnswer,
  generateAISummary,
  resetActiveInterview
} from '../store/slices/candidatesSlice';

const { Dragger } = Upload;

// entity extraction moved to resumeParser service

export const IntervieweeView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { list, activeCandidateId, aiStatus } = useSelector((s: RootState) => s.candidates);
  const active = list.find(c => c.id === activeCandidateId);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [collectingMissing, setCollectingMissing] = useState(false);
  const [form] = Form.useForm();
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const firstQuestionRequestedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const advancingRef = useRef(false);
  const prevQuestionsLenRef = useRef<number>(0);

  const startInterviewIfReady = useCallback(() => {
    if (!active) return;
    if (!active.name || !active.email || !active.phone) return; // wait until profile complete
    if (collectingMissing) return; // still collecting missing fields
    if (active.questions.length === 0 && !firstQuestionRequestedRef.current && aiStatus !== 'loading') {
      firstQuestionRequestedRef.current = true;
      dispatch(fetchAIQuestion({ candidateId: active.id, difficulty: 'easy' }));
      setActiveQuestionIndex(0);
    }
  }, [active, dispatch, collectingMissing, aiStatus]);

  useEffect(() => { startInterviewIfReady(); }, [startInterviewIfReady]);

  // Reset guard if candidate changes
  useEffect(() => {
    firstQuestionRequestedRef.current = false;
  }, [activeCandidateId]);

  const currentQuestion = active?.questions[activeQuestionIndex];
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition lazily
  const ensureRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      // Use only final results to reduce flicker; fall back to last interim if none final
      let finalTranscript = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalTranscript += res[0].transcript + ' ';
        else interim += res[0].transcript + ' ';
      }
      const combined = (finalTranscript + interim).trim();
      if (combined) form.setFieldsValue({ answer: combined });
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => { setListening(false); };
    recognitionRef.current = rec;
    return rec;
  };

  const toggleListening = () => {
    const rec = ensureRecognition();
    if (!rec) return;
    if (listening) {
      rec.stop();
    } else {
      try { rec.start(); setListening(true); } catch { /* ignore start errors */ }
    }
  };

  // Release advancement lock when a new question arrives
  useEffect(() => {
    if (!active) return;
    if (active.questions.length !== prevQuestionsLenRef.current) {
      prevQuestionsLenRef.current = active.questions.length;
      advancingRef.current = false;
      setIsFetchingNext(false);
    }
  }, [active?.questions.length, active]);

  // timer effect
  useEffect(() => {
    if (!currentQuestion || currentQuestion.answer) { setRemaining(null); return; }
    const limit = currentQuestion.timeLimitSec;
    const startedAt = currentQuestion.startedAt || Date.now();
    const endAt = startedAt + limit * 1000;
    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.round((endAt - now) / 1000));
      setRemaining(left);
      if (left <= 0 && !currentQuestion.answer) {
        dispatch(answerQuestion({ candidateId: active!.id, questionId: currentQuestion.id, answer: '(No answer provided - time expired)', auto: true }));
        if (!advancingRef.current) setTimeout(() => { goNext(); }, 300);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentQuestion, dispatch, active]);

  const generateNextDifficulty = (idx: number) => {
    if (idx < 2) return 'easy';
    if (idx < 4) return 'medium';
    return 'hard';
  };

  const goNext = () => {
    if (!active) return;
    if (isFetchingNext || advancingRef.current) return;
    const nextIndex = activeQuestionIndex + 1;
    if (nextIndex >= 6) {
      advancingRef.current = true; // lock finalization
      dispatch(finalizeCandidate({ candidateId: active.id }));
      dispatch(generateAISummary({ candidateId: active.id }));
      return;
    }
    advancingRef.current = true;
    setIsFetchingNext(true);
    dispatch(fetchAIQuestion({ candidateId: active.id, difficulty: generateNextDifficulty(nextIndex) }));
    setActiveQuestionIndex(nextIndex);
  };

  const onUpload: UploadProps['beforeUpload'] = async (file) => {
    setUploadError(null);
    if (!/(pdf|docx)$/i.test(file.name)) {
      setUploadError('Only PDF or DOCX files are supported');
      return Upload.LIST_IGNORE;
    }
    try {
      const extracted = await parseResume(file as File);
      dispatch(createCandidate({ name: extracted.name, email: extracted.email, phone: extracted.phone, resumeFileName: file.name }));
      const missing = !extracted.name || !extracted.email || !extracted.phone;
      setCollectingMissing(missing);
      if (!missing) {
        // allow first question fetch on next effect cycle
        setTimeout(() => startInterviewIfReady(), 0);
      }
      return false; // prevent auto upload
    } catch (e) {
      setUploadError('Failed to parse file');
      return Upload.LIST_IGNORE;
    }
  };

  const submitMissing = async () => {
    if (!active) return;
    const values = await form.validateFields();
    dispatch(updateProfile({ candidateId: active.id, patch: values }));
    setCollectingMissing(false);
    startInterviewIfReady();
  };

  const handleAnswer = (answer: string) => {
    if (!active || !currentQuestion) return;
    dispatch(answerQuestion({ candidateId: active.id, questionId: currentQuestion.id, answer }));
    dispatch(scoreAIAnswer({ candidateId: active.id, questionId: currentQuestion.id, questionPrompt: currentQuestion.prompt, answer }));
    goNext(); // attempt to fetch next immediately; goNext handles locking
  };

  const progressPct = useMemo(() => (active ? (active.questions.length / 6) * 100 : 0), [active]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {!active && (
        <Card title="Upload Resume">
          <Dragger beforeUpload={onUpload} multiple={false} maxCount={1} showUploadList={false}>
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Click or drag PDF/DOCX to this area to start</p>
          </Dragger>
          {uploadError && <Alert type="error" message={uploadError} style={{ marginTop: 12 }} />}
        </Card>
      )}

      {active && !active.completed && (
        <>
          <Progress percent={Math.round(progressPct)} />
          {collectingMissing && (!active.name || !active.email || !active.phone) && (
            <Card title="Complete Your Profile" style={{ maxWidth: 480 }}>
              <Form layout="vertical" form={form} initialValues={{ name: active.name, email: active.email, phone: active.phone }}>
                {!active.name && <Form.Item name="name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item>}
                {!active.email && <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>}
                {!active.phone && <Form.Item name="phone" label="Phone" rules={[{ required: true }]}><Input /></Form.Item>}
                <Button type="primary" onClick={submitMissing}>Continue</Button>
              </Form>
            </Card>
          )}

          {!collectingMissing && currentQuestion && (
            <Card title={`Question ${activeQuestionIndex + 1} (${currentQuestion.difficulty.toUpperCase()})`}>
              <Typography.Paragraph>{currentQuestion.prompt}</Typography.Paragraph>
              {remaining !== null && <Alert type={remaining <= 5 ? 'error' : 'info'} message={`Time Remaining: ${remaining}s`} />}
              {!currentQuestion.answer && (
                <Form onFinish={({ answer }) => handleAnswer(answer)} style={{ marginTop: 12 }} layout="vertical">
                  <Form.Item name="answer" label="Your Answer" rules={[{ required: true }]}>                
                    <Input.TextArea rows={4} autoSize={{ minRows: 4, maxRows: 8 }} />
                  </Form.Item>
                  <Space>
                    <Button htmlType="submit" type="primary">Submit</Button>
                    <Tooltip title={(() => {
                      const supported = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                      if (!supported) return 'Speech recognition not supported in this browser';
                      return listening ? 'Listening… click to stop' : 'Use speech to text';
                    })()}>
                      <Button disabled={!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition} type={listening ? 'default' : 'dashed'} onClick={toggleListening}>
                        {listening ? 'Stop Mic' : 'Speak'}
                      </Button>
                    </Tooltip>
                  </Space>
                </Form>
              )}
              {currentQuestion.answer && (
                <Alert type="success" message={currentQuestion.evaluating ? 'Answer submitted. Scoring in background...' : 'Answer scored.'} />
              )}
            </Card>
          )}
          {!collectingMissing && !currentQuestion && (
            <Card title={activeQuestionIndex === 0 ? 'Preparing first question' : 'Loading next question'}>
              <Skeleton active paragraph={{ rows: 3 }} title={false} />
            </Card>
          )}
        </>
      )}

      {active && active.completed && (
        <Card title="Interview Complete">
          <Alert type="success" message="Interview finished. Thank you!" description="Your responses have been recorded." />
          <Button style={{ marginTop: 16 }} onClick={() => dispatch(resetActiveInterview())}>Start New Interview</Button>
        </Card>
      )}
    </Space>
  );
};
