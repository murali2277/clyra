import React from 'react';
import { signInWithGoogle } from '../services/authService';

const Login = () => {
  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  return (
    <div className="login-container">
      <h2>Welcome to the P2P Chat</h2>
      <p>Please sign in with your Google account to continue.</p>
      <button onClick={handleSignIn}>
        Sign in with Google
      </button>
    </div>
  );
};

export default Login;
