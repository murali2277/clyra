import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from './services/authService';
import Login from './components/Login';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  return (
    <div className="App">
      {user ? <Chat user={user} /> : <Login />}
    </div>
  );
}

export default App;
