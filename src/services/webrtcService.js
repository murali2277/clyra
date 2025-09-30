import io from 'socket.io-client';

const SIGNALING_SERVER_URL = 'http://localhost:3001';

class WebRTCService {
  constructor() {
    this.initializePeerConnection();
    this.socket = null;
    this.messageHandler = null;
    this.remoteId = null;
    this.pendingCandidates = []; // Initialize this
    this.isInitializing = false;
  }

  initializePeerConnection() {
    if (this.isInitializing) {
      console.log('WebRTCService: Already initializing peer connection, skipping');
      return;
    }

    this.isInitializing = true;

    // Close existing connection if it exists
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      sdpSemantics: 'unified-plan'
    });
    
    this.dataChannel = null;
    this.pendingCandidates = []; // Reset pending candidates

    // Set up peer connection event handlers
    this.setupPeerConnectionHandlers();
  }

  setupPeerConnectionHandlers() {
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('WebRTCService: ICE connection state changed:', this.peerConnection.iceConnectionState);
      
      if (this.peerConnection.iceConnectionState === 'failed' || 
          this.peerConnection.iceConnectionState === 'closed') {
        console.log('WebRTCService: Connection failed/closed, will reinitialize on next attempt');
        if (this.messageHandler) {
          this.messageHandler({ type: 'connection', status: 'failed' });
        }
      } else if (this.peerConnection.iceConnectionState === 'connected') {
        console.log('WebRTCService: ICE connection established');
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('WebRTCService: Peer connection state changed:', this.peerConnection.connectionState);
      if (this.messageHandler) {
        this.messageHandler({ type: 'peerConnection', status: this.peerConnection.connectionState });
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log('WebRTCService: ICE gathering state changed:', this.peerConnection.iceGatheringState);
    };

    this.peerConnection.onnegotiationneeded = async () => {
      console.log('WebRTCService: onnegotiationneeded triggered');
      if (this.remoteId && this.peerConnection.signalingState === 'stable') {
        try {
          await this.createOffer(this.remoteId);
        } catch (error) {
          console.error('WebRTCService: Error during onnegotiationneeded:', error);
        }
      }
    };

    // Set up data channel handler for incoming channels
    this.peerConnection.ondatachannel = (event) => {
      console.log('WebRTCService: Received data channel');
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
      if (this.messageHandler) {
        this.messageHandler({ type: 'dataChannel', status: 'received' });
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.remoteId) {
        console.log('WebRTCService: Sending ICE candidate to', this.remoteId);
        this.socket.emit('signal', { to: this.remoteId, signal: event.candidate });
      }
    };
  }

  connect(userId) {
    if (this.socket && this.socket.connected) {
      console.log('WebRTCService: Already connected to signaling server');
      return;
    }

    console.log('WebRTCService: Connecting to signaling server for user:', userId);

    this.socket = io(SIGNALING_SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      console.log(`WebRTCService: Socket.IO connected with ID: ${this.socket.id}`);
      this.socket.emit('register-user', userId);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebRTCService: Socket disconnected:', reason);
      if (reason === 'io server disconnect' || reason === 'server namespace disconnect') {
        this.socket.connect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('WebRTCService: Reconnected after', attemptNumber, 'attempts');
      this.socket.emit('register-user', userId);
    });

    // Add missing event handlers
    this.socket.on('registration-success', (data) => {
      console.log('WebRTCService: Successfully registered with server:', data);
    });

    this.socket.on('registration-error', (error) => {
      console.error('WebRTCService: Registration failed:', error.message);
      setTimeout(() => {
        if (this.socket && this.socket.connected) {
          this.socket.emit('register-user', userId);
        }
      }, 2000);
    });

    this.socket.on('invite-sent', (data) => {
      console.log('WebRTCService: Invite successfully sent to:', data.to);
    });

    this.socket.on('invite-error', (error) => {
      console.error('WebRTCService: Invite error:', error.message);
      if (this.messageHandler) {
        this.messageHandler({ type: 'error', message: error.message });
      }
    });

    this.socket.on('signal-delivered', (data) => {
      console.log('WebRTCService: Signal delivered to:', data.to);
    });

    this.socket.on('user-not-found', (data) => {
      console.error('WebRTCService: User not found:', data.email);
      if (this.messageHandler) {
        this.messageHandler({ type: 'error', message: `User ${data.email} is not online or not found.` });
      }
    });

    this.socket.on('signaling-error', (data) => {
      console.error('WebRTCService: Signaling error:', data.message);
      if (this.messageHandler) {
        this.messageHandler({ type: 'error', message: `Connection failed: ${data.message}` });
      }
      setTimeout(() => {
        console.log('WebRTCService: Retrying connection after signaling error');
        this.initializePeerConnection();
      }, 2000);
    });

    // Updated signal handler with better error handling
    this.socket.on('signal', async (data) => {
      try {
        console.log('WebRTCService: Received signal from', data.from, 'type:', data.signal.type || 'candidate');
        
      // Ensure we have a valid peer connection
      if (!this.peerConnection || this.peerConnection.signalingState === 'closed') {
        console.log('WebRTCService: Reinitializing peer connection for signal');
        this.initializePeerConnection();
      }

      if (data.signal.type === 'offer') {
          console.log('WebRTCService: Processing offer from', data.from);
          this.remoteId = data.from; // Set remoteId when receiving an offer
          if (this.peerConnection.signalingState === 'stable' || this.peerConnection.signalingState === 'have-remote-offer') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
            await this.createAnswer(data.from);
            await this.processQueuedCandidates(); // Process candidates after setting remote description
          } else {
            console.warn('WebRTCService: Received offer in unexpected signaling state:', this.peerConnection.signalingState);
          }
        } else if (data.signal.type === 'answer') {
          console.log('WebRTCService: Processing answer from', data.from);
          if (this.peerConnection.signalingState === 'have-local-offer') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
            await this.processQueuedCandidates(); // Process candidates after setting remote description
          } else {
            console.warn('WebRTCService: Received answer in unexpected signaling state:', this.peerConnection.signalingState);
          }
        } else if (data.signal.candidate) {
          console.log('WebRTCService: Processing ICE candidate from', data.from);
          if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.signal));
            } catch (e) {
              console.error('WebRTCService: Error adding received ICE candidate:', e);
            }
          } else {
            console.log('WebRTCService: Queuing ICE candidate (no remote description yet)');
            this.pendingCandidates.push(data.signal);
          }
        }
      } catch (error) {
        console.error('WebRTCService: Error handling signal:', error);
        // Don't reinitialize immediately on signal errors
      }
    });
  }

  // Process queued ICE candidates
  async processQueuedCandidates() {
    if (this.pendingCandidates && this.pendingCandidates.length > 0) {
      console.log('WebRTCService: Processing queued ICE candidates');
      for (const candidate of this.pendingCandidates) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('WebRTCService: Error adding queued candidate:', error);
        }
      }
      this.pendingCandidates = [];
    }
  }

  // Add method to set message handler from Chat component
  setMessageHandler(handler) {
    this.messageHandler = handler;
    console.log('WebRTCService: Message handler set');
    if (this.dataChannel) {
      this.setupDataChannelHandlers();
    }
  }

  // Centralized data channel handler setup
  setupDataChannelHandlers() {
    if (!this.dataChannel) return;

    console.log('WebRTCService: Setting up data channel handlers');

    this.dataChannel.onopen = () => {
      console.log('WebRTCService: Data channel opened, readyState:', this.dataChannel.readyState);
      if (this.messageHandler) {
        this.messageHandler({ type: 'connection', status: 'open' });
      }
    };

    this.dataChannel.onclose = () => {
      console.log('WebRTCService: Data channel closed');
      if (this.messageHandler) {
        this.messageHandler({ type: 'connection', status: 'closed' });
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('WebRTCService: Data channel error:', error);
      if (this.messageHandler) {
        this.messageHandler({ type: 'error', message: 'Data channel error occurred' });
      }
    };

    this.dataChannel.onmessage = (event) => {
      console.log('WebRTCService: Received message via data channel:', event.data);
      if (this.messageHandler) {
        this.messageHandler(event);
      }
    };
  }

  async createOffer(to) {
    try {
      console.log('WebRTCService: Creating offer for', to);
      
      if (this.peerConnection.signalingState === 'closed') {
        console.log('WebRTCService: Reinitializing peer connection for offer');
        this.initializePeerConnection();
      }

      this.remoteId = to;
      
      // Create data channel as the initiator
      if (!this.dataChannel) {
        console.log('WebRTCService: Creating data channel for initiator');
        this.dataChannel = this.peerConnection.createDataChannel('chat', {
          ordered: true,
          maxRetransmits: 3
        });
        this.setupDataChannelHandlers();
      }
      
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      if (this.socket && this.socket.connected) {
        this.socket.emit('signal', { to, signal: this.peerConnection.localDescription });
        console.log('WebRTCService: Offer sent to', to);
      } else {
        throw new Error('Socket not connected');
      }
    } catch (error) {
      console.error('WebRTCService: Error creating offer:', error);
      throw error;
    }
  }

  async createAnswer(to) {
    try {
      console.log('WebRTCService: Creating answer for', to);
      this.remoteId = to;
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      if (this.socket && this.socket.connected) {
        this.socket.emit('signal', { to, signal: this.peerConnection.localDescription });
        console.log('WebRTCService: Answer sent to', to);
      } else {
        throw new Error('Socket not connected');
      }
    } catch (error) {
      console.error('WebRTCService: Error creating answer:', error);
      throw error;
    }
  }

  sendMessage(message) {
    console.log('WebRTCService: Attempting to send message');
    console.log('WebRTCService: Data channel exists:', !!this.dataChannel);
    console.log('WebRTCService: Data channel readyState:', this.dataChannel?.readyState);
    console.log('WebRTCService: Peer connection state:', this.peerConnection.connectionState);
    
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(message);
        console.log('WebRTCService: Message sent successfully');
        return true;
      } catch (error) {
        console.error('WebRTCService: Error sending message:', error);
        return false;
      }
    } else {
      console.warn('WebRTCService: Data channel not open; readyState =', this.dataChannel ? this.dataChannel.readyState : 'none');
      return false;
    }
  }

  initiatePeerConnection(userId, receiverId) {
    console.log('WebRTCService: Initiating peer connection from', userId, 'to', receiverId);
    
    if (this.peerConnection.signalingState === 'closed') {
      console.log('WebRTCService: Peer connection closed, reinitializing');
      this.initializePeerConnection();
    }

    this.remoteId = receiverId;
    
    // Create data channel to trigger negotiation if not already created
    if (!this.dataChannel || this.dataChannel.readyState === 'closed') {
      try {
        console.log('WebRTCService: Creating data channel for initiator');
        this.dataChannel = this.peerConnection.createDataChannel('chat', {
          ordered: true,
          maxRetransmits: 3
        });
        this.setupDataChannelHandlers();
      } catch (error) {
        console.error('WebRTCService: Error creating data channel:', error);
        // If data channel creation fails, reinitialize and try again
        this.initializePeerConnection();
        this.dataChannel = this.peerConnection.createDataChannel('chat', {
          ordered: true,
          maxRetransmits: 3
        });
        this.setupDataChannelHandlers();
      } finally {
        this.isInitializing = false;
      }
    }
  }

  reset() {
    console.log('WebRTCService: Resetting connection');
    this.initializePeerConnection();
    this.remoteId = null;
    this.pendingCandidates = [];
  }

  disconnect() {
    console.log('WebRTCService: Disconnecting');
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    if (this.socket) {
      this.socket.disconnect();
    }
    this.dataChannel = null;
    this.messageHandler = null;
    this.remoteId = null;
    this.pendingCandidates = [];
  }

  getConnectionStatus() {
    return {
      socketConnected: this.socket?.connected || false,
      peerConnectionState: this.peerConnection?.connectionState || 'closed',
      dataChannelState: this.dataChannel?.readyState || 'closed',
      signalingState: this.peerConnection?.signalingState || 'closed'
    };
  }
}

export default new WebRTCService();
