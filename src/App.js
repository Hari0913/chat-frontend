import { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { io } from 'socket.io-client';

// Change this URL to your backend deployed URL
const socket = io('https://chat-backend-k6v0.onrender.com', {
  transports: ['websocket'],
  secure: true,
});

function App() {
  const [status, setStatus] = useState('Connecting...');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [paired, setPaired] = useState(false);
  const [stream, setStream] = useState(null);
  const [showVideoChat, setShowVideoChat] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [player, setPlayer] = useState(null);

  const peerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (!showVideoChat && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showVideoChat]);

  useEffect(() => {
    // Socket event handlers
    socket.on('connect', () => {
      setStatus('Connected. Waiting to be paired...');
    });

    socket.on('waiting', () => {
      setStatus('Waiting for a partner...');
      setPaired(false);
      setMessages([]);
      cleanupVideoChat();
    });

    socket.on('paired', () => {
      setStatus('You are now chatting with a stranger.');
      setPaired(true);
      setMessages([]);
      cleanupVideoChat();
    });

    socket.on('webrtc-signal', signal => {
      if (peerRef.current) {
        peerRef.current.signal(signal);
      }
    });

    socket.on('partner left', () => {
      setStatus('Stranger disconnected. Click "Find New Partner" to connect again.');
      setPaired(false);
      cleanupVideoChat();
    });

    socket.on('chat message', (msg) => {
      if (typeof msg === 'object' && msg.text && msg.sender) {
        setMessages(prev => [...prev, msg]);
      }
    });

    socket.on('disconnect', () => {
      setStatus('Disconnected from server.');
      setPaired(false);
      cleanupVideoChat();
    });

    socket.on('connect_error', () => {
      setStatus('Connection error. Check server.');
      setPaired(false);
      cleanupVideoChat();
    });

    socket.on('youtube-url', (videoId) => {
      if (player) player.loadVideoById(videoId);
    });

    socket.on('youtube-play', () => player?.playVideo());
    socket.on('youtube-pause', () => player?.pauseVideo());

    return () => {
      socket.off('connect');
      socket.off('waiting');
      socket.off('paired');
      socket.off('webrtc-signal');
      socket.off('partner left');
      socket.off('chat message');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('youtube-url');
      socket.off('youtube-play');
      socket.off('youtube-pause');
    };
  }, [player]);

  // Load YouTube Iframe API
  useEffect(() => {
    window.onYouTubeIframeAPIReady = () => {
      const ytPlayer = new window.YT.Player('player', {
        height: '360',
        width: '640',
        events: {
          onReady: (event) => setPlayer(event.target),
          onStateChange: (event) => {
            if (event.data === 1) socket.emit('youtube-play');  // playing
            if (event.data === 2) socket.emit('youtube-pause'); // paused
          }
        }
      });
    };
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }, []);

  // Cleanup video chat when user disconnects or partner leaves
  const cleanupVideoChat = () => {
    setShowVideoChat(false);
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  // Start video chat and create WebRTC peer connection
  const startVideoChat = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      const newPeer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: mediaStream
      });

      newPeer.on('signal', data => {
        socket.emit('webrtc-signal', data);
      });

      newPeer.on('stream', remoteStream => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      newPeer.on('close', () => {
        cleanupVideoChat();
      });

      peerRef.current = newPeer;
      setShowVideoChat(true);
    } catch (err) {
      alert("Unable to access camera/microphone.");
      console.error(err);
    }
  };

  // Send chat message
  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && paired) {
      const msg = { sender: 'you', text: message };
      socket.emit('chat message', msg);
      setMessages(prev => [...prev, msg]);
      setMessage('');
    }
  };

  // Request a new chat partner
  const findNewPartner = () => {
    socket.emit('find-new-partner');
    setStatus('Searching for a new partner...');
    setMessages([]);
    setPaired(false);
    cleanupVideoChat();
  };

  // Extract YouTube video ID from URL
  const extractVideoId = (url) => {
    const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[1].length === 11 ? match[1] : null;
  };

  // Handle YouTube "Watch Together" button
  const watchTogether = () => {
    const videoId = extractVideoId(youtubeUrl);
    if (videoId && player && socket.connected) {
      player.loadVideoById(videoId);
      socket.emit('youtube-url', videoId);
    } else {
      alert('Please enter a valid YouTube URL and ensure you are connected.');
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: 20 }}>
      <h2>🌐 Random Chat + Video + YouTube</h2>
      <p><b>Status:</b> {status}</p>

      {showVideoChat ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <video ref={localVideoRef} autoPlay muted playsInline width="200" />
          <video ref={remoteVideoRef} autoPlay playsInline width="200" />
        </div>
      ) : (
        <>
          <div
            style={{
              border: '1px solid gray',
              height: 300,
              overflowY: 'auto',
              padding: 10,
              marginTop: 10,
              background: '#f9f9f9'
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  textAlign: msg.sender === 'you' ? 'right' : 'left',
                  marginBottom: 5
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    background: msg.sender === 'you' ? '#dcf8c6' : '#fff',
                    padding: 8,
                    borderRadius: 10,
                    maxWidth: '70%',
                    wordWrap: 'break-word',
                    border: '1px solid #ccc'
                  }}
                >
                  {msg.text}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={sendMessage}
            style={{ display: 'flex', gap: 10, marginTop: 10 }}
          >
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={paired ? "Say something..." : "Waiting to be paired..."}
              disabled={!paired}
              style={{ flex: 1, padding: 10 }}
              autoComplete="off"
            />
            <button type="submit" disabled={!paired} style={{ padding: '10px 20px' }}>
              Send
            </button>
          </form>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button onClick={findNewPartner} style={{ flex: 1, padding: 10 }}>
          Find New Partner
        </button>
        {paired && !showVideoChat && (
          <button onClick={startVideoChat} style={{ flex: 1, padding: 10 }}>
            Start Video Chat
          </button>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <input
          placeholder="Paste YouTube URL"
          value={youtubeUrl}
          onChange={e => setYoutubeUrl(e.target.value)}
          style={{ width: '100%', padding: 8 }}
        />
        <button
          onClick={watchTogether}
          style={{ marginTop: 10, width: '100%', padding: 10 }}
        >
          Watch Together
        </button>

        <div id="player" style={{ marginTop: 20 }}></div>
      </div>
    </div>
  );
}

export default App;
