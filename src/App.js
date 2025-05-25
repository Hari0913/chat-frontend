// Updated App.js with video chat and YouTube sync support

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';

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
  const [peer, setPeer] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [player, setPlayer] = useState(null);
  const messagesEndRef = useRef(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    socket.on('paired', async () => {
      setStatus('You are now chatting with a stranger.');
      setPaired(true);
      setMessages([]);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(stream);
      localVideoRef.current.srcObject = stream;

      const newPeer = new SimplePeer({ initiator: true, trickle: false, stream });

      newPeer.on('signal', data => socket.emit('webrtc-signal', data));
      newPeer.on('stream', remoteStream => {
        remoteVideoRef.current.srcObject = remoteStream;
      });

      setPeer(newPeer);
    });

    socket.on('webrtc-signal', signal => {
      if (peer) peer.signal(signal);
    });

    socket.on('partner left', () => {
      setStatus('Stranger disconnected. Click "Find New Partner" to connect again.');
      setPaired(false);
    });

    socket.on('chat message', (msg) => {
      setMessages((prev) => [...prev, msg]);
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
      socket.off('connect');
      socket.off('waiting');
      socket.off('paired');
      socket.off('partner left');
      socket.off('chat message');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('webrtc-signal');
      socket.off('youtube-url');
      socket.off('youtube-play');
      socket.off('youtube-pause');
    };
  }, [peer, player]);

  useEffect(() => {
    window.onYouTubeIframeAPIReady = () => {
      const newPlayer = new window.YT.Player('player', {
        height: '360', width: '640',
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

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && paired) {
      socket.emit('chat message', { sender: 'you', text: message });
      setMessages(prev => [...prev, { sender: 'you', text: message }]);
      setMessage('');
    }
  };

  const findNewPartner = () => {
    if (paired) {
      socket.disconnect();
      setTimeout(() => socket.connect(), 100);
      setStatus('Reconnecting and looking for a new partner...');
      setPaired(false);
      setMessages([]);
    } else {
      setStatus('Already waiting for a partner...');
    }
  };

  const extractVideoId = (url) => {
    const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[1].length === 11 ? match[1] : null;
  };

  return (
    <div style={{ maxWidth: '800px', margin: 'auto', padding: 20 }}>
      <h2>🌐 Random Chat + Video + YouTube</h2>
      <p><b>Status:</b> {status}</p>

      <div style={{ display: 'flex', gap: 10 }}>
        <video ref={localVideoRef} autoPlay muted width="200" />
        <video ref={remoteVideoRef} autoPlay width="200" />
      </div>

      <div style={{ border: '1px solid gray', height: 300, overflowY: 'auto', padding: 10, marginTop: 10, background: '#f9f9f9', whiteSpace: 'pre-wrap' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ textAlign: msg.sender === 'you' ? 'right' : 'left', marginBottom: 5 }}>
            <span style={{ display: 'inline-block', background: msg.sender === 'you' ? '#dcf8c6' : '#fff', padding: 8, borderRadius: 10, maxWidth: '70%', wordWrap: 'break-word', border: '1px solid #ccc' }}>{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 10 }}>
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

      <button onClick={findNewPartner} style={{ marginTop: 10, padding: '10px 20px', width: '100%' }}>Find New Partner</button>

      <div style={{ marginTop: 20 }}>
        <input
          placeholder="Paste YouTube URL"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          style={{ width: '100%', padding: 8 }}
        />
        <button onClick={() => {
          const videoId = extractVideoId(youtubeUrl);
          if (videoId && player) {
            player.loadVideoById(videoId);
            socket.emit('youtube-url', videoId);
          }
        }} style={{ marginTop: 10, width: '100%', padding: 10 }}>Watch Together</button>

        <div id="player" style={{ marginTop: 20 }}></div>
      </div>
    </div>
  );
}

export default App;

