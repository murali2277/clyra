import React, { useState, useEffect, useRef } from 'react';
import webrtcService from '../services/webrtcService';
import { signOut } from '../services/authService';

const Chat = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteReceived, setInviteReceived] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const messageTimers = useRef({}); // Use useRef to store timers
  const audioRef = useRef({}); // Use useRef to store audio refs for playback

  // Function to clear a specific message timer
  const clearMessageTimer = (messageId) => {
    if (messageTimers.current[messageId]) {
      clearTimeout(messageTimers.current[messageId]);
      delete messageTimers.current[messageId];
    }
  };

  // Function to play audio
  const playAudio = (messageId) => {
    const audioEl = audioRef.current[messageId];
    if (audioEl) {
      audioEl.play().catch(e => console.error("Error playing audio:", e));
    }
  };

  useEffect(() => {
    let isMounted = true;
    let statusInterval;

    const handleWebRTCEvents = (eventData) => {
      if (!isMounted) return;

      if (eventData.type === 'connection') {
        if (eventData.status === 'open') {
          console.log('Chat: Data channel opened - connection established');
          setIsConnected(true);
          setIsConnecting(false);
          setInviteSent(false);
          setInviteReceived(null);
        } else if (eventData.status === 'closed') {
          console.log('Chat: Data channel closed');
          setIsConnected(false);
          setIsConnecting(false);
        }
      } else if (eventData.type === 'error') {
        console.error('Chat: WebRTC error:', eventData.message);
        setIsConnecting(false);
        alert(eventData.message);
      } else if (eventData.data) {
        try {
          // Attempt to parse as JSON for text messages
          const messageData = JSON.parse(eventData.data);
          console.log('Chat: Received text message event:', messageData);

          const timer = setTimeout(() => {
            setMessages((prevMessages) => {
              const updatedMessages = prevMessages.filter((msg) => msg.id !== messageData.id);
              clearMessageTimer(messageData.id);
              return updatedMessages;
            });
          }, 30000);

          messageTimers.current[messageData.id] = timer;
          setMessages((prevMessages) => [...prevMessages, messageData]);
        } catch (error) {
          // If not JSON, assume it's an ArrayBuffer for audio
          console.log('Chat: Received potential audio message event.');
          const audioBlob = new Blob([eventData.data], { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);

          const audioMessage = {
            id: Date.now(),
            audio: audioUrl,
            sender: receiverEmail, // Assuming receiver is the sender of audio
            timestamp: new Date().toISOString(),
          };

          const timer = setTimeout(() => {
            setMessages((prevMessages) => {
              const updatedMessages = prevMessages.filter((msg) => msg.id !== audioMessage.id);
              clearMessageTimer(audioMessage.id);
              URL.revokeObjectURL(audioUrl); // Clean up blob URL
              return updatedMessages;
            });
          }, 30000);

          messageTimers.current[audioMessage.id] = timer;
          setMessages((prevMessages) => [...prevMessages, audioMessage]);
        }
      }
    };

    webrtcService.connect(user.email);
    webrtcService.setMessageHandler(handleWebRTCEvents);

    statusInterval = setInterval(() => {
      const status = webrtcService.getConnectionStatus();
      setConnectionStatus(status);
    }, 1000);

    // Socket event handlers
    if (webrtcService.socket) {
      webrtcService.socket.on('invite', (fromEmail) => {
        if (isMounted) {
          console.log('Chat: Received invite from', fromEmail);
          setInviteReceived(fromEmail);
          setIsConnecting(false);
          setInviteSent(false);
        }
      });

      webrtcService.socket.on('invite-accepted', (fromEmail) => {
        if (isMounted) {
          console.log(`Chat: Invite accepted by ${fromEmail} - starting connection process`);
          setReceiverEmail(fromEmail);
          setIsConnecting(true);
          setInviteSent(false);
          setInviteReceived(null);
          
          try {
            webrtcService.initiatePeerConnection(user.email, fromEmail);
          } catch (error) {
            console.error('Chat: Error initiating peer connection:', error);
            alert('Failed to establish connection. Please try again.');
            resetConnection();
          }
        }
      });

      webrtcService.socket.on('invite-declined', (fromEmail) => {
        if (isMounted) {
          console.log(`Chat: Invite declined by ${fromEmail}`);
          setInviteSent(false);
          setIsConnecting(false);
          alert(`Invite declined by ${fromEmail}`);
        }
      });

      webrtcService.socket.on('user-not-found', (data) => {
        if (isMounted) {
          console.log('Chat: User not found:', data.email);
          setInviteSent(false);
          setIsConnecting(false);
          alert(`User ${data.email} is not online or not found.`);
        }
      });

      webrtcService.socket.on('signaling-error', (data) => {
        if (isMounted) {
          console.log('Chat: Signaling error:', data.message);
          setIsConnecting(false);
          alert(`Connection failed: ${data.message}`);
          resetConnection();
        }
      });

      webrtcService.socket.on('disconnect', () => {
        if (isMounted) {
          console.log('Chat: Socket disconnected');
          setIsConnected(false);
          setIsConnecting(false);
        }
      });
    }

    return () => {
      isMounted = false;
      
      // Clear status monitoring
      if (statusInterval) {
        clearInterval(statusInterval);
      }

      // Clear all message timers when component unmounts
      for (const messageId in messageTimers.current) {
        clearTimeout(messageTimers.current[messageId]);
      }
      messageTimers.current = {}; // Reset the ref
      
      console.log('Chat: Component unmounting');
    };
  }, [user.email, receiverEmail]); // Added receiverEmail to dependency array for audio sender

  // Reset connection method
  const resetConnection = () => {
    console.log('Chat: Resetting connection');
    setIsConnected(false);
    setIsConnecting(false);
    setReceiverEmail('');
    setInviteSent(false);
    setInviteReceived(null);
    setMessages([]);
    webrtcService.reset();
    // Clear all message timers on reset
    for (const messageId in messageTimers.current) {
      clearTimeout(messageTimers.current[messageId]);
    }
    messageTimers.current = {};
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioChunks([]);

      recorder.ondataavailable = (event) => {
        setAudioChunks((prev) => [...prev, event.data]);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        console.log('Recording stopped. Audio chunks:', audioChunks);
        // Do not send here, wait for send button click
      };

      recorder.start();
      console.log('Recording started.');
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not start recording. Please ensure microphone access is granted.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      console.log('Recording stopped.');
    }
  };

  const handleSendAudioMessage = () => {
    if (!isConnected) {
      alert('Not connected to a peer.');
      return;
    }
    if (audioChunks.length === 0) {
      alert('No audio recorded to send.');
      return;
    }
    if (!webrtcService.dataChannel || webrtcService.dataChannel.readyState !== 'open') {
      alert('Data channel is not ready. Current state: ' + (webrtcService.dataChannel?.readyState || 'undefined'));
      return;
    }

    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      const success = webrtcService.sendMessage(arrayBuffer);

      if (!success) {
        alert('Failed to send audio message. Please check connection.');
        return;
      }

      console.log('Chat: Audio message sent successfully.');

      const audioUrl = URL.createObjectURL(audioBlob);
      const message = {
        id: Date.now(),
        audio: audioUrl,
        sender: user.email,
        timestamp: new Date().toISOString(),
      };

      const timer = setTimeout(() => {
        setMessages((prevMessages) => {
          const updatedMessages = prevMessages.filter((msg) => msg.id !== message.id);
          clearMessageTimer(message.id);
          URL.revokeObjectURL(audioUrl); // Clean up blob URL
          return updatedMessages;
        });
      }, 30000);

      messageTimers.current[message.id] = timer;
      setMessages((prevMessages) => [...prevMessages, message]);
      setAudioChunks([]);
    };
    reader.readAsArrayBuffer(audioBlob);
  };


  const handleSendInvite = () => {
    if (!webrtcService.socket || !webrtcService.socket.connected) {
      alert('Not connected to signaling server. Please try again.');
      return;
    }
    if (!receiverEmail.trim()) {
      alert('Please enter a receiver email.');
      return;
    }
    if (receiverEmail === user.email) {
      alert('Cannot send invite to yourself.');
      return;
    }

    console.log('Chat: Sending invite to', receiverEmail);
    webrtcService.socket.emit('send-invite', { to: receiverEmail, from: user.email });
    setInviteSent(true);
    
    // Auto-reset invite after 30 seconds
    setTimeout(() => {
      setInviteSent(false);
    }, 30000);
  };

  const handleAcceptInvite = () => {
    if (!webrtcService.socket || !webrtcService.socket.connected) {
      alert('Not connected to signaling server. Please try again.');
      return;
    }
    
    if (inviteReceived) {
      try {
        console.log('Chat: Accepting invite from', inviteReceived);
        webrtcService.socket.emit('accept-invite', { to: inviteReceived, from: user.email });
        setReceiverEmail(inviteReceived);
        setIsConnecting(true);
        setInviteReceived(null);
        
        // The receiver will wait for the initiator to start the connection
        console.log('Chat: Waiting for peer connection from', inviteReceived);
      } catch (error) {
        console.error('Chat: Error accepting invite:', error);
        alert('Failed to accept invite. Please try again.');
        resetConnection();
      }
    }
  };

  const handleDeclineInvite = () => {
    if (!webrtcService.socket || !webrtcService.socket.connected) {
      alert('Not connected to signaling server. Please try again.');
      return;
    }
    if (inviteReceived) {
      console.log('Chat: Declining invite from', inviteReceived);
      webrtcService.socket.emit('decline-invite', { to: inviteReceived, from: user.email });
      setInviteReceived(null);
    }
  };

  const handleSendMessage = () => {
    if (!isConnected) {
      alert('Not connected to a peer.');
      return;
    }

    if (!newMessage.trim()) {
      alert('Please enter a message.');
      return;
    }

    const status = webrtcService.getConnectionStatus();
    console.log('Chat: Connection status:', status);

    if (!webrtcService.dataChannel || webrtcService.dataChannel.readyState !== 'open') {
      alert('Data channel is not ready. Current state: ' + (webrtcService.dataChannel?.readyState || 'undefined'));
      return;
    }

    const message = {
      id: Date.now(),
      text: newMessage,
      sender: user.email,
      timestamp: new Date().toISOString(),
    };

    const success = webrtcService.sendMessage(JSON.stringify(message));
    
    if (!success) {
      alert('Failed to send message. Please check connection.');
      return;
    }

    console.log('Chat: Message sent successfully:', message);

    // Set a timer for the sent message
    const timer = setTimeout(() => {
      setMessages((prevMessages) => {
        const updatedMessages = prevMessages.filter((msg) => msg.id !== message.id);
        clearMessageTimer(message.id); // Clear timer when message is removed
        return updatedMessages;
      });
    }, 30000);

    messageTimers.current[message.id] = timer; // Store timer in ref
    setMessages((prevMessages) => [...prevMessages, message]); // Add message without timer property
    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isConnected) {
        handleSendMessage();
      } else if (inviteReceived) {
        handleAcceptInvite();
      } else if (!isConnecting) {
        handleSendInvite();
      }
    }
  };

  // Determine what UI to show
  const showChatInterface = isConnected;
  const showConnecting = isConnecting && !isConnected;
  const showInviteReceived = inviteReceived && !isConnecting && !isConnected;
  const showInviteInput = !inviteReceived && !isConnecting && !isConnected && !inviteSent;
  const showInviteSent = inviteSent && !isConnecting && !isConnected;

  return (
    <div className="chat-container" id="vanta-chat-bg">
      <div className="chat-header">
        <div className="header-titles">
          <h2>CLYRA</h2>
          <h2 className="welcome-message">Welcome, {user.displayName}</h2>
          {isConnected && (
            <span className="connected-to-message">
              Connected to: {receiverEmail}
            </span>
          )}
        </div>
        <div className="header-buttons">
          {isConnected && (
            <button 
              onClick={resetConnection} 
              className="glassmorphic-small-button"
            >
              Reset
            </button>
          )}
          <div className="container">
            <div className="btn">
              <a onClick={signOut}>Sign Out &nbsp;<i className="fa fa-sign-out" aria-hidden="true"></i></a>
            </div>
          </div>
        </div>
      </div>
      
      <div className="messages">
        {showConnecting && (
          <div style={{
            textAlign: 'center',
            color: '#666',
            fontStyle: 'italic',
            marginTop: '50px'
          }}>
            Connecting to {receiverEmail}... Please wait.
          </div>
        )}
        
        {messages.length === 0 && isConnected && (
          <div style={{
            textAlign: 'center',
            color: '#ffffffc3',
            fontStyle: 'italic',
            marginTop: '50px'
          }}>
            Start chatting! Messages will disappear after 30 seconds.
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender === user.email ? 'sent' : 'received'}`}>
            {msg.text && <p>{msg.text}</p>}
            {msg.audio && (
              <div className="audio-message">
                <audio ref={el => audioRef.current[msg.id] = el} src={msg.audio} controls></audio>
                <button onClick={() => playAudio(msg.id)}>Play Audio</button>
              </div>
            )}
            <small style={{ fontSize: '10px', opacity: 0.7 }}>
              {new Date(msg.timestamp).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}
            </small>
          </div>
        ))}
      </div>
      
      {showChatInterface ? (
        <div className="message-input">
          <div
            style={{
              marginRight: '10px',
              width: '40px',
              height: '40px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              opacity: (!isConnected || connectionStatus.dataChannelState !== 'open') ? 0.7 : 1,
              cursor: (!isConnected || connectionStatus.dataChannelState !== 'open') ? 'not-allowed' : 'pointer',
            }}
            onClick={() => {
              if (isConnected && connectionStatus.dataChannelState === 'open') {
                if (isRecording) {
                  stopRecording();
                  handleSendAudioMessage();
                } else {
                  startRecording();
                }
              }
            }}
          >
            <lord-icon
                src="https://cdn.lordicon.com/iamvsnir.json"
                trigger={isRecording ? 'loop' : 'hover'}
                colors={isRecording ? 'primary:#e83a30,secondary:#f24c00,tertiary:#ffffff,quaternary:#f24c00,quinary:#000000' : 'primary:#4f1091,secondary:#a866ee,tertiary:#ffffff,quaternary:#f24c00,quinary:#000000'}
                class="voice-message-icon"
            >
            </lord-icon>
          </div>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            autoFocus
            disabled={isRecording}
          />
          <button 
            onClick={handleSendMessage} 
            disabled={!newMessage.trim() || connectionStatus.dataChannelState !== 'open' || isRecording}
            style={{
              opacity: (!newMessage.trim() || connectionStatus.dataChannelState !== 'open' || isRecording) ? 0.5 : 1,
              cursor: (!newMessage.trim() || connectionStatus.dataChannelState !== 'open' || isRecording) ? 'not-allowed' : 'pointer',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <span className="material-icons">send</span>
          </button>
        </div>
      ) : (
        <div className="connection-input">
          {showInviteReceived && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ marginBottom: '15px', fontSize: '16px' }}>
                Invitation from <strong>{inviteReceived}</strong>
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <div className="accept-container">
                  <div className="btn">
                    <button onClick={handleAcceptInvite} className="accept-button">
                      Accept
                    </button>
                  </div>
                </div>
                <div className="decline-container">
                  <div className="btn">
                    <button onClick={handleDeclineInvite} className="decline-button">
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showConnecting && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ fontSize: '16px' }}>
                Connecting to {receiverEmail}...
              </p>
            </div>
          )}

          {showInviteSent && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ fontSize: '16px' }}>
                Invite sent to {receiverEmail}. Waiting for response...
              </p>
              <button 
                onClick={resetConnection}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginTop: '10px',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)',
                  transition: 'all 0.3s ease'
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {showInviteInput && (
            <div style={{ width: '100%', maxWidth: '500px' }}>
              <div className="invite-input-container">
                <input
                  type="email"
                  className="invite-email-input"
                  value={receiverEmail}
                  onChange={(e) => setReceiverEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter receiver email"
                  autoFocus
                />
                <div className="container send-invite-container">
                  <div className="btn">
                    <a 
                      onClick={handleSendInvite} 
                      className="send-invite-button"
                      style={{
                        cursor: (!receiverEmail.trim() || !connectionStatus.socketConnected) ? 'not-allowed' : 'pointer',
                        opacity: (!receiverEmail.trim() || !connectionStatus.socketConnected) ? 0.5 : 1,
                      }}
                    >
                      Send Invite &nbsp;<i className="fa fa-share-square-o" aria-hidden="true"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;
