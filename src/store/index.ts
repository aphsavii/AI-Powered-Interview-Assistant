import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storageSession from 'redux-persist/lib/storage/session';
import candidatesReducer from './slices/candidatesSlice';
import sessionReducer from './slices/sessionSlice';

const rootPersistConfig = {
  key: 'root',
  storage: storageSession,
  whitelist: ['candidates', 'session']
};

const rootReducer = combineReducers({
  candidates: candidatesReducer,
  session: sessionReducer
});

const persistedReducer = persistReducer(rootPersistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false })
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
