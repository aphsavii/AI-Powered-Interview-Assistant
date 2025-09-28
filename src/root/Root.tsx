import React, { useEffect } from 'react';
import { Tabs, Modal } from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { setWelcomeBackShown } from '../store/slices/sessionSlice';
import { IntervieweeView } from '../ui/IntervieweeView';
import { InterviewerView } from '../ui/InterviewerView';

export const Root: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { welcomeBackShown, lastActiveAt } = useSelector((s: RootState) => s.session);
  const candidates = useSelector((s: RootState) => s.candidates.list);

  useEffect(() => {
    const inactiveMs = Date.now() - (lastActiveAt || Date.now());
    if (!welcomeBackShown && inactiveMs > 5000 && candidates.some(c => !c.completed)) {
      Modal.info({
        title: 'Welcome Back',
        content: 'You have an unfinished interview. You can resume where you left off.',
        onOk: () => dispatch(setWelcomeBackShown(true))
      });
    }
  }, [welcomeBackShown, lastActiveAt, candidates, dispatch]);

  return (
    <div className="min-h-screen  bg-slate-50 py-4">
      <div className="container">
        <Tabs
          className="bg-white rounded-md shadow-sm p-4"
          items={[
            { key: 'interviewee', label: 'Interviewee', children: <div className="pt-2"><IntervieweeView /></div> },
            { key: 'interviewer', label: 'Interviewer', children: <div className="pt-2"><InterviewerView /></div> }
          ]}
        />
      </div>
    </div>
  );
};
