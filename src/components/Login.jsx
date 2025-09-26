import React from 'react';
import { signInWithGoogle } from '../services/authService';
import SplitText from "./SplitText";
import './Login.css'; // Import Login.css

const handleAnimationComplete = () => {
  console.log('All letters have animated!');
};

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
      <SplitText
        text="Welcome to the CLyra"
        className="login-title text-center mb-5" /* Use custom class and remove Tailwind font styles */
        delay={100}
        duration={0.6}
        ease="power3.out"
        splitType="chars"
        from={{ opacity: 0, y: 40 }}
        to={{ opacity: 1, y: 0 }}
        threshold={0.1}
        rootMargin="-100px"
        textAlign="center"
        onLetterAnimationComplete={handleAnimationComplete}
        tag="h2"
      />
      <p style={{ textAlign: 'center' }}>Please sign in with your Google account to continue.</p>
      <button onClick={handleSignIn} style={{ display: 'block', margin: '0 auto', border: "solid 1px white", backgroundColor: "transparent", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", transition: "background-color 0.3s, color 0.3s" }} onMouseEnter={e => { e.target.style.backgroundColor = "white"; e.target.style.color = "black"; }} onMouseLeave={e => { e.target.style.backgroundColor = "transparent"; e.target.style.color = "white"; }}>
        Sign in with Google
      </button>
    </div>
  );
};

export default Login;
