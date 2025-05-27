import React, { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import io from 'socket.io-client';
import YouTube from 'react-youtube';
import './App.css';

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
  const [videoStarted, setVideoStarted] = useState(false);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const chatBoxRef = useRef();
  const ytRef = useRef();

  useEffect(() => {
    if (videoStarted) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(localStream => {
        setStream(localStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      });
    }
  }, [videoStarted]);

  useEffect(() => {
    socket.on('paired', () => {
      setStatus('Connected!');
      if (stream) {
        const newPeer = new SimplePeer({ initiator: true, trickle: false, stream });
        setupPeer(newPeer);
      }
    });

    socket.on('waiting', () => setStatus('Waiting for partner...'));

    socket.on('chat message', data => setMessages(prev => [...prev, data]));

    socket.on('partner left', () => {
      setStatus('Partner disconnected');
      setPeer(null);
      setRemoteStream(null);
    });

    socket.on('webrtc-signal', data => {
      if (!peer && stream) {
        const newPeer = new SimplePeer({ initiator: false, trickle: false, stream });
        setupPeer(newPeer);
        newPeer.signal(data);
      } else if (peer) {
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

  const startVideoChat = () => {
    const confirm = window.confirm('By clicking on video chat, you will reveal your face. Proceed?');
    if (confirm) setVideoStarted(true);
  };

  const findNewPartner = () => {
    socket.disconnect();
    window.location.reload();
  };

  return (
    <div className={`app ${mode}`}>
      <header>
        <h1>🎥 Random Chat</h1>
        <div>
          <button onClick={toggleTheme} title="Toggle Theme">{mode === 'dark' ? '🌙' : '☀️'}</button>
          <button onClick={handleYoutubeShare}>📺 Share YouTube</button>
        </div>
      </header>

      <main>
        <div className="video-section">
          {videoStarted && <video ref={localVideoRef} autoPlay muted />}
          {videoStarted && <video ref={remoteVideoRef} autoPlay />}
        </div>

        <div className="chat-section">
          {videoId && (
            <YouTube
              videoId={videoId}
              opts={{ width: '100%', height: '200' }}
              onReady={e => (ytRef.current = e)}
            />
          )}

          <div className="chat-box" ref={chatBoxRef}>
            {messages.map((msg, i) => (
              <div key={i} className={msg.sender === 'you' ? 'msg you' : 'msg other'}>
                {msg.text}
              </div>
            ))}
          </div>

          <div className="chat-input">
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type here..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>

          <div className="bottom-buttons">
            <button onClick={findNewPartner}>🔄 Find New Partner</button>
            <button onClick={startVideoChat}>🎥 Video Chat</button>
          </div>

          <p className="status">{status}</p>
        </div>
      </main>
    </div>
  );
}
