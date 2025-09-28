import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SessionState {
  welcomeBackShown: boolean;
  lastActiveAt?: number;
}

const initialState: SessionState = {
  welcomeBackShown: false
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    markActivity(state) {
      state.lastActiveAt = Date.now();
    },
    setWelcomeBackShown(state, action: PayloadAction<boolean>) {
      state.welcomeBackShown = action.payload;
    }
  }
});

export const { markActivity, setWelcomeBackShown } = sessionSlice.actions;
export default sessionSlice.reducer;
