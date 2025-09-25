import React, { useState, useEffect } from 'react';
import webrtcService from '../services/webrtcService';
import { signOut } from '../services/authService';
import cryptoService from '../utils/cryptoService';

const Chat = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [theirPublicKey, setTheirPublicKey] = useState(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteReceived, setInviteReceived] = useState(null); // Stores sender's email if invite received

  useEffect(() => {
    let isMounted = true;

    // Initialize socket connection for current user to receive invites
    webrtcService.connect(user.email);

    webrtcService.socket.on('invite', (fromEmail) => {
      if (isMounted) {
        setInviteReceived(fromEmail);
      }
    });

    webrtcService.socket.on('invite-accepted', (fromEmail) => {
      if (isMounted) { // Removed receiverEmail === fromEmail check here
        console.log(`Invite from ${fromEmail} accepted.`);
        setReceiverEmail(fromEmail); // Ensure receiverEmail is set for the accepting user
        // Now that connection is accepted, initiate WebRTC connection
        webrtcService.initiatePeerConnection(user.email, fromEmail);
        if (webrtcService.socket && webrtcService.socket.connected) {
          webrtcService.socket.emit('public-key', { to: fromEmail, from: user.email, publicKey: cryptoService.getPublicKeyBase64() });
        }
      }
    });

    webrtcService.socket.on('public-key', (data) => {
      if (!isMounted) return;
      const decoded = cryptoService.decodePublicKey(data.publicKey);
      setTheirPublicKey(decoded);
      setIsConnected(true); // Connection is fully established now
      console.log('Received peer public key');
    });

    const handleDataChannelMessage = (event) => {
      if (!isMounted) return;
      const { encrypted, nonce } = JSON.parse(event.data);
      const decryptedMessage = cryptoService.decrypt(encrypted, nonce, theirPublicKey);
      const messageWithTimer = {
        ...decryptedMessage,
        timer: setTimeout(() => {
          setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== decryptedMessage.id));
        }, 30000), // 30 seconds
      };
      setMessages((prevMessages) => [...prevMessages, messageWithTimer]);
    };

    // Set up data channel message handler once dataChannel is available
    webrtcService.peerConnection.ondatachannel = (event) => {
      webrtcService.dataChannel = event.channel;
      webrtcService.dataChannel.onmessage = handleDataChannelMessage;
    };

    if (webrtcService.dataChannel) {
      webrtcService.dataChannel.onmessage = handleDataChannelMessage;
    }

    return () => {
      isMounted = false;
      if (webrtcService.socket) {
        webrtcService.socket.disconnect();
      }
      if (webrtcService.peerConnection) {
        webrtcService.peerConnection.close();
      }
    };
  }, [user.email, receiverEmail, isConnected, theirPublicKey]);

  const handleSendInvite = () => {
    if (!webrtcService.socket || !webrtcService.socket.connected) {
      alert('Not connected to signaling server. Please try again.');
      return;
    }
    if (receiverEmail && receiverEmail !== user.email) {
      webrtcService.socket.emit('send-invite', { to: receiverEmail, from: user.email });
      setInviteSent(true);
    } else {
      alert('Please enter a valid receiver email that is not your own.');
    }
  };

  const handleAcceptInvite = () => {
    if (!webrtcService.socket || !webrtcService.socket.connected) {
      alert('Not connected to signaling server. Please try again.');
      return;
    }
    if (inviteReceived) {
      webrtcService.socket.emit('accept-invite', { to: inviteReceived, from: user.email });
      setReceiverEmail(inviteReceived); // Set receiver to the inviter
      setInviteReceived(null); // Clear invite
      // Initiate WebRTC connection after accepting
      webrtcService.initiatePeerConnection(user.email, inviteReceived);
      if (webrtcService.socket && webrtcService.socket.connected) {
        webrtcService.socket.emit('public-key', { to: inviteReceived, from: user.email, publicKey: cryptoService.getPublicKeyBase64() });
      }
      console.log(`Accepted invite from ${inviteReceived}. isConnected: true`);
    }
  };

  const handleDeclineInvite = () => {
    if (!webrtcService.socket || !webrtcService.socket.connected) {
      alert('Not connected to signaling server. Please try again.');
      return;
    }
    if (inviteReceived) {
      webrtcService.socket.emit('decline-invite', { to: inviteReceived, from: user.email });
      setInviteReceived(null);
    }
  };

  const handleSendMessage = () => {
    if (!isConnected) {
      alert('Not connected to a peer.');
      return;
    }
    const message = {
      id: Date.now(),
      text: newMessage,
      sender: user.email, // Use email as sender ID
      timestamp: new Date().toISOString(),
    };
    const { encrypted, nonce } = cryptoService.encrypt(message, theirPublicKey);
    webrtcService.sendMessage(JSON.stringify({ encrypted, nonce }));
    const messageWithTimer = {
      ...message,
      timer: setTimeout(() => {
        setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== message.id));
      }, 30000), // 30 seconds
    };
    setMessages((prevMessages) => [...prevMessages, messageWithTimer]);
    setNewMessage('');
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Welcome, {user.displayName}</h2>
        <button onClick={signOut}>Sign Out</button>
      </div>
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender === user.email ? 'sent' : 'received'}`}>
            <p>{msg.text}</p>
          </div>
        ))}
      </div>
      {isConnected ? (
        <div className="message-input">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button onClick={handleSendMessage}>Send</button>
        </div>
      ) : (
        <div className="connection-input">
          {inviteReceived ? (
            <div>
              <p>Invitation from {inviteReceived}</p>
              <button onClick={handleAcceptInvite}>Accept</button>
              <button onClick={handleDeclineInvite}>Decline</button>
            </div>
          ) : (
            <>
              <input
                type="email"
                value={receiverEmail}
                onChange={(e) => setReceiverEmail(e.target.value)}
                placeholder="Enter receiver email"
              />
              <button onClick={handleSendInvite} disabled={inviteSent}>
                {inviteSent ? 'Invite Sent' : 'Send Invite'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;
