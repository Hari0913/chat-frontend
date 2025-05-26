import { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { io } from 'socket.io-client';

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
  const [darkMode, setDarkMode] = useState(false);

  const peerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    socket.on('connect', () => {
      setStatus('Connected. Waiting to be paired...');
    });

    socket.on('waiting', () => {
      setStatus('Waiting for a partner...');
      setPaired(false);
      setMessages([]);
    });

    socket.on('paired', () => {
      setStatus('You are now chatting with a stranger.');
      setPaired(true);
      setMessages([]);
    });

    socket.on('webrtc-signal', signal => {
      if (peerRef.current) {
        peerRef.current.signal(signal);
      }
    });

    socket.on('partner left', () => {
      setStatus('Stranger disconnected. Click "Find New Partner" to connect again.');
      setPaired(false);
      peerRef.current?.destroy();
      peerRef.current = null;
      setShowVideoChat(false);
    });

    socket.on('chat message', (msg) => {
      if (typeof msg === 'object' && msg.text && msg.sender) {
        setMessages(prev => [...prev, msg]);
      }
    });

    socket.on('disconnect', () => {
      setStatus('Disconnected from server.');
      setPaired(false);
    });

    socket.on('connect_error', () => {
      setStatus('Connection error. Check server.');
    });

    socket.on('youtube-url', (videoId) => {
      if (player) player.loadVideoById(videoId);
    });

    socket.on('youtube-play', () => player?.playVideo());
    socket.on('youtube-pause', () => player?.pauseVideo());

    return () => {
      socket.disconnect();
    };
  }, [player]);

  useEffect(() => {
    window.onYouTubeIframeAPIReady = () => {
      const ytPlayer = new window.YT.Player('player', {
        height: '200',
        width: '100%',
        events: {
          onReady: (event) => setPlayer(event.target),
          onStateChange: (event) => {
            if (event.data === 1) socket.emit('youtube-play');
            if (event.data === 2) socket.emit('youtube-pause');
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

  const startVideoChat = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      const newPeer = new SimplePeer({ initiator: true, trickle: false, stream: mediaStream });

      newPeer.on('signal', data => socket.emit('webrtc-signal', data));

      newPeer.on('stream', remoteStream => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      peerRef.current = newPeer;
      setShowVideoChat(true);
    } catch (err) {
      alert("Unable to access camera/microphone");
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && paired) {
      const msg = { sender: 'you', text: message };
      socket.emit('chat message', msg);
      setMessages(prev => [...prev, msg]);
      setMessage('');
    }
  };

  const findNewPartner = () => {
    socket.emit('find-new-partner');
    setStatus('Searching for a new partner...');
    setMessages([]);
    setPaired(false);
    setShowVideoChat(false);
    peerRef.current?.destroy();
    peerRef.current = null;
  };

  const extractVideoId = (url) => {
    const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[1].length === 11 ? match[1] : null;
  };

  const theme = darkMode ? '#121212' : '#ffffff';
  const textColor = darkMode ? '#ffffff' : '#000000';
  const bubbleColor = darkMode ? '#333' : '#f1f0f0';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme, color: textColor, padding: 20 }}>
      <h2>🌐 Random Chat + Video + YouTube</h2>
      <p><b>Status:</b> {status}</p>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {showVideoChat && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <video ref={localVideoRef} autoPlay muted width="200" />
            <video ref={remoteVideoRef} autoPlay width="200" />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{
            border: '1px solid gray',
            height: 300,
            overflowY: 'auto',
            padding: 10,
            background: bubbleColor,
            borderRadius: 10
          }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ textAlign: msg.sender === 'you' ? 'right' : 'left', marginBottom: 5 }}>
                <span style={{
                  display: 'inline-block',
                  background: msg.sender === 'you' ? '#4caf50' : '#2196f3',
                  color: '#fff',
                  padding: 8,
                  borderRadius: 10,
                  maxWidth: '70%',
                  wordWrap: 'break-word'
                }}>{msg.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={paired ? "Say something..." : "Waiting to be paired..."}
              disabled={!paired}
              style={{ flex: 1, padding: 10 }}
              autoComplete="off"
            />
            <button type="submit" disabled={!paired} style={{ padding: '10px 20px' }}>Send</button>
          </form>

          <div style={{ marginTop: 20 }}>
            <input
              placeholder="Paste YouTube URL"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              style={{ width: '100%', padding: 8 }}
            />
            <button onClick={() => {
              const videoId = extractVideoId(youtubeUrl);
              if (videoId && player && socket.connected) {
                player.loadVideoById(videoId);
                socket.emit('youtube-url', videoId);
              }
            }} style={{ marginTop: 10, width: '100%', padding: 10 }}>Watch Together</button>
            <div id="player" style={{ marginTop: 20, width: '100%' }}></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={findNewPartner} style={{ flex: 1, padding: 10 }}>Find New Partner</button>
        {paired && !showVideoChat && (
          <button onClick={startVideoChat} style={{ flex: 1, padding: 10 }}>Start Video Chat</button>
        )}
        <button onClick={() => setDarkMode(prev => !prev)} style={{ flex: 1, padding: 10 }}>
          {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>
    </div>
  );
}

export default App;
