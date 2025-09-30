import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    let isMounted = true;
    let statusInterval;

    // Message and event handler function
    const handleWebRTCEvents = (eventData) => {
      if (!isMounted) return;

      // Handle different types of events
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
        // This is a message event
        console.log('Chat: Received message event:', eventData.data);
        try {
          const messageData = JSON.parse(eventData.data);
          console.log('Chat: Parsed message:', messageData);
          const messageWithTimer = {
            ...messageData,
            timer: setTimeout(() => {
              setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== messageData.id));
            }, 30000),
          };
          setMessages((prevMessages) => [...prevMessages, messageWithTimer]);
        } catch (error) {
          console.error('Chat: Error parsing received message:', error);
        }
      }
    };

    // Connect to WebRTC service and set message handler
    webrtcService.connect(user.email);
    webrtcService.setMessageHandler(handleWebRTCEvents);

    // Start connection status monitoring
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

      // Clear message timers
      messages.forEach(msg => {
        if (msg.timer) {
          clearTimeout(msg.timer);
        }
      });
      
      console.log('Chat: Component unmounting');
    };
  }, [user.email, messages]);

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
        resetConnection();
        alert('Failed to accept invite. Please try again.');
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

    const messageWithTimer = {
      ...message,
      timer: setTimeout(() => {
        setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== message.id));
      }, 30000),
    };
    
    setMessages((prevMessages) => [...prevMessages, messageWithTimer]);
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isConnected && (
            <>
              <span style={{ color: 'green', fontSize: '14px' }}>
                Connected to: {receiverEmail}
              </span>
              <button 
                onClick={resetConnection} 
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  backgroundColor: 'transparent',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  height: '30px',
                  width: '60px',
                }}
              >
                Reset
              </button>
            </>
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
            color: '#666',
            fontStyle: 'italic',
            marginTop: '50px'
          }}>
            Start chatting! Messages will disappear after 30 seconds.
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender === user.email ? 'sent' : 'received'}`}>
            <p>{msg.text}</p>
            <small style={{ fontSize: '10px', opacity: 0.7 }}>
              {new Date(msg.timestamp).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}
            </small>
          </div>
        ))}
      </div>
      
      {showChatInterface ? (
        <div className="message-input">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            autoFocus
          />
          <button 
            onClick={handleSendMessage} 
            disabled={!newMessage.trim() || connectionStatus.dataChannelState !== 'open'}
            style={{
              opacity: (!newMessage.trim() || connectionStatus.dataChannelState !== 'open') ? 0.5 : 1,
              cursor: (!newMessage.trim() || connectionStatus.dataChannelState !== 'open') ? 'not-allowed' : 'pointer'
            }}
          >
            Send
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
              <div style={{ display: 'flex', gap: '10px', padding: '10px', alignItems: 'stretch' }}>
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
