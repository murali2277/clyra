import React from 'react';
import { signInWithGoogle } from '../services/authService';
import Shuffle from './Shuffle';
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
      <Shuffle
        text="Welcome to CLYRA"
        shuffleDirection="right"
        duration={0.35}
        animationMode="evenodd"
        shuffleTimes={1}
        ease="power3.out"
        stagger={0.03}
        threshold={0.1}
        triggerOnce={true}
        triggerOnHover={true}
        respectReducedMotion={true}
      />
      <p style={{ textAlign: 'center' }}>Please sign in with your Google account to continue.</p>
      <button onClick={handleSignIn} className="signin-button" style={{ display: 'block', margin: '0 auto', border: "solid 1px white", backgroundColor: "transparent", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", transition: "background-color 0.3s, color 0.3s" }} onMouseEnter={e => { e.target.style.backgroundColor = "white"; e.target.style.color = "black"; }} onMouseLeave={e => { e.target.style.backgroundColor = "transparent"; e.target.style.color = "white"; }}>
        Sign in with Google &nbsp;<i class="fa fa-sign-in" aria-hidden="true"></i>
      </button>
    </div>
  );
};

export default Login;
