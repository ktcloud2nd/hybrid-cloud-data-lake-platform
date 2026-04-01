import { useEffect } from 'react';
import AppRouter from './routes/AppRouter';
import { consumeSessionFromUrl } from './utils/authStorage';

function App() {
  useEffect(() => {
    consumeSessionFromUrl();
  }, []);

  return <AppRouter />;
}

export default App;
