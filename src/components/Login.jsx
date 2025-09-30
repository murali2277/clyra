import React from 'react';
import { signInWithGoogle } from '../services/authService';
import BlurText from './BlurText';
import './Login.css'; // Import Login.css

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
      <BlurText
        text="Welcome to CLYRA"
        delay={200}
        animateBy="words"
        direction="top"
        onAnimationComplete={() => console.log('Animation completed!')}
        className="welcome-text-animation"
      />
      <p style={{ textAlign: 'center' }}>Please sign in with your Google account to continue.</p>
      <button onClick={handleSignIn} className="signin-button" style={{ display: 'block', margin: '0 auto', border: "solid 1px white", backgroundColor: "transparent", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", transition: "background-color 0.3s, color 0.3s" }} onMouseEnter={e => { e.target.style.backgroundColor = "white"; e.target.style.color = "black"; }} onMouseLeave={e => { e.target.style.backgroundColor = "transparent"; e.target.style.color = "white"; }}>
        Sign in with Google &nbsp;<i class="fa fa-sign-in" aria-hidden="true"></i>
      </button>
    </div>
  );
};

export default Login;
