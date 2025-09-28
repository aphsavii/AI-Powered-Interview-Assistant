import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { v4 as uuid } from 'uuid';
import { generateQuestionAI, scoreAnswerAI, generateSummaryAI } from '../../services/aiService';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export interface InterviewQuestion {
  id: string;
  difficulty: QuestionDifficulty;
  prompt: string;
  answer?: string;
  score?: number; // per-question score 0-100
  startedAt?: number;
  answeredAt?: number;
  timeLimitSec: number;
  evaluating?: boolean;
  feedback?: string;
}

export interface CandidateProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  resumeFileName?: string;
  createdAt: number;
  completed: boolean;
  finalScore?: number;
  summary?: string;
  questions: InterviewQuestion[];
  chat: Array<{ role: 'system' | 'assistant' | 'user'; content: string; ts: number }>;
}

interface CandidatesState {
  list: CandidateProfile[];
  activeCandidateId?: string;
  aiStatus?: 'idle' | 'loading' | 'error';
  aiError?: string | null;
}

const initialState: CandidatesState = {
  list: [],
  aiStatus: 'idle',
  aiError: null
};

const questionTiming: Record<QuestionDifficulty, number> = { easy: 20, medium: 60, hard: 120 };

export const generateQuestion = (difficulty: QuestionDifficulty): InterviewQuestion => {
  // Placeholder deterministic question generation (replace with real AI call later)
  const basePrompts: Record<QuestionDifficulty, string[]> = {
    easy: [
      'Explain the difference between var, let, and const in JavaScript.',
      'What is JSX and why is it used in React?',
      'How do you create a REST endpoint with Express?'
    ],
    medium: [
      'Describe how React reconciliation works and why keys are important.',
      'Explain event loop and microtasks vs macrotasks in Node.js.',
      'How would you structure a scalable folder architecture for a full-stack app?'
    ],
    hard: [
      'Design a high-level architecture for a real-time collaborative editor (React frontend, Node backend).',
      'Optimize a React + Node application experiencing memory leaks under load. Outline steps & tools.',
      'Explain how you would implement server-side rendering with data hydration for a complex dashboard.'
    ]
  };
  const prompts = basePrompts[difficulty];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  return {
    id: uuid(),
    difficulty,
    prompt,
    timeLimitSec: questionTiming[difficulty]
  };
};

// Async thunks
export const fetchAIQuestion = createAsyncThunk(
  'candidates/fetchAIQuestion',
  async (payload: { candidateId: string; difficulty: QuestionDifficulty }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const cand: CandidateProfile | undefined = state.candidates.list.find((c: CandidateProfile) => c.id === payload.candidateId);
      const existingPrompts = cand ? cand.questions.map(q => q.prompt.trim()) : [];
      const q = await generateQuestionAI(payload.difficulty, existingPrompts);
      return { ...payload, prompt: q.prompt };
    } catch (e: any) {
      return rejectWithValue(e?.message || 'Failed to get AI question');
    }
  }
);

export const scoreAIAnswer = createAsyncThunk(
  'candidates/scoreAIAnswer',
  async (payload: { candidateId: string; questionId: string; questionPrompt: string; answer: string }, { rejectWithValue }) => {
    try {
      const res = await scoreAnswerAI(payload.questionPrompt, payload.answer);
      return { ...payload, score: res.score, feedback: res.feedback };
    } catch (e: any) {
      return rejectWithValue(e?.message || 'Failed to score answer');
    }
  }
);

export const generateAISummary = createAsyncThunk(
  'candidates/generateAISummary',
  async (payload: { candidateId: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const c = state.candidates.list.find((c: CandidateProfile) => c.id === payload.candidateId);
      if (!c) throw new Error('Candidate not found');
  const transcript = c.questions.map((q: InterviewQuestion) => `Q: ${q.prompt}\nA: ${q.answer || ''}\nScore: ${q.score || 0}`).join('\n---\n');
      const avg = c.questions.length ? Math.round(c.questions.reduce((acc: number, q: InterviewQuestion) => acc + (q.score || 0), 0) / c.questions.length) : 0;
      const res = await generateSummaryAI(transcript, avg);
      return { candidateId: c.id, summary: res.summary, finalScore: avg };
    } catch (e: any) {
      return rejectWithValue(e?.message || 'Failed to summarize');
    }
  }
);

const candidatesSlice = createSlice({
  name: 'candidates',
  initialState,
  reducers: {
    createCandidate: {
      prepare(partial: Partial<CandidateProfile>) {
        return {
          payload: {
            id: uuid(),
            name: partial.name || '',
            email: partial.email || '',
            phone: partial.phone || '',
            resumeFileName: partial.resumeFileName,
            createdAt: Date.now(),
            completed: false,
            questions: [],
            chat: [] as CandidateProfile['chat']
          } as CandidateProfile
        };
      },
      reducer(state: CandidatesState, action: PayloadAction<CandidateProfile>) {
        state.list.push(action.payload);
        state.activeCandidateId = action.payload.id;
      }
    },
    setActiveCandidate(state: CandidatesState, action: PayloadAction<string | undefined>) {
      state.activeCandidateId = action.payload;
    },
    appendChat(state: CandidatesState, action: PayloadAction<{ candidateId: string; role: 'system' | 'assistant' | 'user'; content: string }>) {
      const c = state.list.find((c: CandidateProfile) => c.id === action.payload.candidateId);
      if (!c) return;
      c.chat.push({ role: action.payload.role, content: action.payload.content, ts: Date.now() });
    },
    addNextQuestion(state: CandidatesState, action: PayloadAction<{ candidateId: string; difficulty: QuestionDifficulty }>) {
      const c = state.list.find((c: CandidateProfile) => c.id === action.payload.candidateId);
      if (!c) return;
      const q = generateQuestion(action.payload.difficulty);
      q.startedAt = Date.now();
      c.questions.push(q);
    },
    answerQuestion(state: CandidatesState, action: PayloadAction<{ candidateId: string; questionId: string; answer: string; auto?: boolean }>) {
      const c = state.list.find((c: CandidateProfile) => c.id === action.payload.candidateId);
      if (!c) return;
      const q = c.questions.find((q: InterviewQuestion) => q.id === action.payload.questionId);
      if (!q) return;
      if (!q.answer) {
        q.answer = action.payload.answer;
        q.answeredAt = Date.now();
        // mark evaluating until AI scoring returns
        q.evaluating = true;
      }
    },
    finalizeCandidate(state: CandidatesState, action: PayloadAction<{ candidateId: string }>) {
      const c = state.list.find((c: CandidateProfile) => c.id === action.payload.candidateId);
      if (!c) return;
      if (!c.completed) {
        // Summary will be populated by AI summary thunk; we just mark complete here if already scored
        const allScored = c.questions.every(q => typeof q.score === 'number');
        if (allScored) {
          c.completed = true;
        }
      }
    },
    updateProfile(state: CandidatesState, action: PayloadAction<{ candidateId: string; patch: Partial<Pick<CandidateProfile, 'name' | 'email' | 'phone'>> }>) {
      const c = state.list.find((c: CandidateProfile) => c.id === action.payload.candidateId);
      if (!c) return;
      Object.assign(c, action.payload.patch);
    },
    resetActiveInterview(state: CandidatesState) {
      // Clears active candidate id so UI can prompt for new resume
      state.activeCandidateId = undefined;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAIQuestion.pending, (state) => {
        state.aiStatus = 'loading';
        state.aiError = null;
      })
      .addCase(fetchAIQuestion.fulfilled, (state, action) => {
        state.aiStatus = 'idle';
        const c = state.list.find(c => c.id === action.payload.candidateId);
        if (!c) return;
        const q: InterviewQuestion = {
          id: uuid(),
          difficulty: action.payload.difficulty,
          prompt: action.payload.prompt,
          timeLimitSec: questionTiming[action.payload.difficulty as QuestionDifficulty],
          startedAt: Date.now()
        };
        c.questions.push(q);
      })
      .addCase(fetchAIQuestion.rejected, (state, action) => {
        state.aiStatus = 'error';
        state.aiError = (action.payload as string) || 'Failed to fetch question';
      })
      .addCase(scoreAIAnswer.pending, (state) => {
        state.aiStatus = 'loading';
      })
      .addCase(scoreAIAnswer.fulfilled, (state, action) => {
        state.aiStatus = 'idle';
        const c = state.list.find(c => c.id === action.payload.candidateId);
        if (!c) return;
        const q = c.questions.find(q => q.id === action.payload.questionId);
        if (!q) return;
        q.score = action.payload.score;
        q.feedback = action.payload.feedback;
        q.evaluating = false;
      })
      .addCase(scoreAIAnswer.rejected, (state, action) => {
        state.aiStatus = 'error';
        state.aiError = (action.payload as string) || 'Failed to score answer';
      })
      .addCase(generateAISummary.fulfilled, (state, action) => {
        const c = state.list.find(c => c.id === action.payload.candidateId);
        if (!c) return;
        c.summary = action.payload.summary;
        c.finalScore = action.payload.finalScore;
        c.completed = true;
      });
  }
});

export const {
  createCandidate,
  setActiveCandidate,
  appendChat,
  addNextQuestion,
  answerQuestion,
  finalizeCandidate,
  updateProfile,
  resetActiveInterview
} = candidatesSlice.actions;
export default candidatesSlice.reducer;
