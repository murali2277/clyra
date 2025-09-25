import io from 'socket.io-client';

const SIGNALING_SERVER_URL = 'http://localhost:3001';

class WebRTCService {
  constructor() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      sdpSemantics: 'unified-plan'
    });
    this.dataChannel = null;
    this.socket = null;
  }

  connect(userId) {
    if (this.socket && this.socket.connected) {
      return; // Already connected
    }

    this.socket = io(SIGNALING_SERVER_URL, {
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log(`WebRTCService: Socket.IO connected for user: ${userId}`);
      this.socket.emit('register-user', userId); // Register user with their ID
    });

    // onnegotiationneeded will be handled by initiatePeerConnection
    this.peerConnection.onnegotiationneeded = null; // Clear previous handler

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('WebRTCService: ICE connection state changed:', this.peerConnection.iceConnectionState);
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('WebRTCService: Peer connection state changed:', this.peerConnection.connectionState);
    };

    this.socket.on('user-joined', (from) => {
      // This event is now less relevant for explicit invites, but keep for potential future use
      console.log(`WebRTCService: User ${from} joined the room.`);
    });

    this.socket.on('signal', async (data) => {
      if (data.signal.type === 'offer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
        this.createAnswer(data.from);
      } else if (data.signal.type === 'answer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
      } else if (data.signal.candidate) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.signal));
      }
    });

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.dataChannel.onmessage = (event) => {
        console.log("Received message:", event.data);
      };
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('signal', { to: this.remoteId, signal: event.candidate });
      }
    };
  }

  async createOffer(to) {
    try {
      this.remoteId = to;
      if (!this.dataChannel) { // Only create data channel if it doesn't exist
        this.dataChannel = this.peerConnection.createDataChannel('chat');
      }
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.socket.emit('signal', { to, signal: this.peerConnection.localDescription });
    } catch (error) {
      console.error('WebRTCService: Error creating offer:', error);
    }
  }

  async createAnswer(to) {
    try {
      this.remoteId = to;
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.socket.emit('signal', { to, signal: this.peerConnection.localDescription });
    } catch (error) {
      console.error('WebRTCService: Error creating answer:', error);
    }
  }

  sendMessage(message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
    } else {
      console.warn('WebRTCService: Data channel not open; readyState =', this.dataChannel ? this.dataChannel.readyState : 'none');
    }
  }
  initiatePeerConnection(userId, receiverId) {
    this.remoteId = receiverId; // Set the remote ID for signaling
    this.peerConnection.onnegotiationneeded = async () => {
      try {
        console.log('WebRTCService: onnegotiationneeded triggered.');
        await this.createOffer(receiverId);
      } catch (error) {
        console.error('WebRTCService: Error on negotiationneeded during initiation:', error);
      }
    };
    // If we are the initiator, create the data channel immediately
    if (userId < receiverId) { // Simple way to decide who initiates
      if (!this.dataChannel) {
        this.dataChannel = this.peerConnection.createDataChannel('chat');
      }
    }
  }
}

export default new WebRTCService();
