import { useEffect, useRef, useState } from 'react';
import YouTube from 'react-youtube';
import SimplePeer from 'simple-peer';
import io from 'socket.io-client';

const socket = io('https://chat-backend-5d2r.onrender.com');

export default function App() {
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const [videoId, setVideoId] = useState('');
  const [mode, setMode] = useState('dark');

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const chatBoxRef = useRef();
  const ytRef = useRef();

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(localStream => {
      setStream(localStream);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
    });

    socket.on('paired', () => {
      setStatus('Connected!');
      const newPeer = new SimplePeer({ initiator: true, trickle: false, stream });
      setupPeer(newPeer);
    });

    socket.on('waiting', () => setStatus('Waiting for partner...'));

    socket.on('chat message', data => setMessages(prev => [...prev, data]));

    socket.on('partner left', () => {
      setStatus('Partner disconnected');
      setPeer(null);
      setRemoteStream(null);
    });

    socket.on('webrtc-signal', data => {
      if (!peer) {
        const newPeer = new SimplePeer({ initiator: false, trickle: false, stream });
        setupPeer(newPeer);
        newPeer.signal(data);
      } else {
        peer.signal(data);
      }
    });

    socket.on('youtube-url', id => setVideoId(id));
    socket.on('youtube-play', () => ytRef.current?.internalPlayer.playVideo());
    socket.on('youtube-pause', () => ytRef.current?.internalPlayer.pauseVideo());

    return () => socket.disconnect();
  }, [stream]);

  const setupPeer = p => {
    p.on('signal', data => socket.emit('webrtc-signal', data));
    p.on('stream', remote => {
      setRemoteStream(remote);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
    });
    setPeer(p);
  };

  const sendMessage = () => {
    if (message.trim()) {
      const msg = { sender: 'you', text: message };
      setMessages(prev => [...prev, msg]);
      socket.emit('chat message', msg);
      setMessage('');
    }
  };

  const handleYoutubeShare = () => {
    const id = prompt('Enter YouTube video ID (not full URL)');
    if (id) {
      setVideoId(id);
      socket.emit('youtube-url', id);
    }
  };

  const toggleTheme = () => setMode(prev => (prev === 'dark' ? 'light' : 'dark'));

  const colors = {
    dark: {
      background: '#1e1e2f',
      text: '#f0f0f0',
      chatBg: '#2e2e3e',
      bubble: '#444',
      inputBg: '#333',
      border: '#555',
      buttonBg: '#4a90e2',
      buttonText: '#fff'
    },
    light: {
      background: '#f0f0f0',
      text: '#222',
      chatBg: '#fff',
      bubble: '#ddd',
      inputBg: '#fff',
      border: '#ccc',
      buttonBg: '#007bff',
      buttonText: '#fff'
    }
  };

  const theme = colors[mode];

  return (
    <div style={{ backgroundColor: theme.background, color: theme.text, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '10px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Random Chat</h1>
        <div>
          <button onClick={toggleTheme} style={{ marginRight: '10px', backgroundColor: theme.buttonBg, color: theme.buttonText, border: 'none', padding: '8px 12px', borderRadius: '5px' }}>Toggle {mode} mode</button>
          <button onClick={handleYoutubeShare} style={{ backgroundColor: theme.buttonBg, color: theme.buttonText, border: 'none', padding: '8px 12px', borderRadius: '5px' }}>Share YouTube</button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex' }}>
        <div style={{ width: '50%', padding: '10px', borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <video ref={localVideoRef} autoPlay muted style={{ width: '100%', height: '50%', borderRadius: '10px', backgroundColor: '#000' }} />
          <video ref={remoteVideoRef} autoPlay style={{ width: '100%', height: '50%', borderRadius: '10px', backgroundColor: '#000' }} />
        </div>

        <div style={{ width: '50%', padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {videoId && (
            <YouTube
              videoId={videoId}
              opts={{ width: '100%', height: '250' }}
              onReady={e => (ytRef.current = e)}
            />
          )}

          <div ref={chatBoxRef} style={{ flex: 1, overflowY: 'auto', backgroundColor: theme.chatBg, padding: '10px', borderRadius: '8px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ textAlign: msg.sender === 'you' ? 'right' : 'left', marginBottom: '5px' }}>
                <span style={{ display: 'inline-block', padding: '5px 10px', backgroundColor: theme.bubble, borderRadius: '15px' }}>{msg.text}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex' }}>
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              style={{ flex: 1, padding: '10px', backgroundColor: theme.inputBg, color: theme.text, border: `1px solid ${theme.border}`, borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px' }}
            />
            <button onClick={sendMessage} style={{ padding: '10px 15px', border: `1px solid ${theme.border}`, borderLeft: 'none', borderTopRightRadius: '5px', borderBottomRightRadius: '5px', backgroundColor: theme.buttonBg, color: theme.buttonText }}>Send</button>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.9em', color: theme.border }}>{status}</p>
        </div>
      </main>
    </div>
  );
}




