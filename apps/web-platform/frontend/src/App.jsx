import { useEffect } from 'react';
import AppRouter from './routes/AppRouter';
import { appTarget } from './config/appTarget';
import { consumeSessionFromUrl } from './utils/authStorage';

function App() {
  useEffect(() => {
    consumeSessionFromUrl();

    document.body.classList.remove('operator-theme');

    if (appTarget === 'operator') {
      document.body.classList.add('operator-theme');
    }
  }, []);

  return <AppRouter />;
}

export default App;
