import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ConfigProvider, App as AntdApp } from 'antd';
import 'antd/dist/reset.css';
import './styles.css';
import { store, persistor } from './store';
import { Root } from './root/Root';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
          <AntdApp>
            <Root />
          </AntdApp>
        </ConfigProvider>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);
