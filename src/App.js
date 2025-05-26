import { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { io } from 'socket.io-client';

const socket = io('https://chat-backend-k6v0.onrender.com', {
  transports: ['websocket'],
  timeout: 10000,
  reconnectionAttempts: 5
});

function App() {
  const [status, setStatus] = useState('Connecting...');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [paired, setPaired] = useState(false);
  const [showVideoChat, setShowVideoChat] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [player, setPlayer] = useState(null);

  const peerRef = useRef(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const messagesEndRef = useRef();

  const cleanupPeer = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    const tracks = localVideoRef.current?.srcObject?.getTracks();
    tracks?.forEach(track => track.stop());
    localVideoRef.current.srcObject = null;
    remoteVideoRef.current.srcObject = null;
  };

  const createPeer = async (initiator) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;

      const peer = new SimplePeer({
        initiator,
        trickle: false,
        stream
      });

      peer.on('signal', signal => {
        socket.emit('webrtc-signal', signal);
      });

      peer.on('stream', remoteStream => {
        remoteVideoRef.current.srcObject = remoteStream;
      });

      peer.on('error', err => console.error('Peer error:', err));

      peerRef.current = peer;
      setShowVideoChat(true);
    } catch (err) {
      alert("Could not access camera/mic.");
    }
  };

  useEffect(() => {
    socket.on('connect', () => {
      setStatus('Connected. Waiting to be paired...');
    });

    socket.on('waiting', () => {
      setStatus('Waiting for a partner...');
      setPaired(false);
      setMessages([]);
    });

    socket.on('paired', ({ initiator }) => {
      setStatus('You are now chatting with a stranger.');
      setPaired(true);
      setMessages([]);
      if (initiator) createPeer(true);
    });

    socket.on('webrtc-signal', signal => {
      if (!peerRef.current) createPeer(false);
      peerRef.current?.signal(signal);
    });

    socket.on('partner left', () => {
      setStatus('Stranger disconnected. Click "Find New Partner" to connect again.');
      setPaired(false);
      setShowVideoChat(false);
      cleanupPeer();
    });

    socket.on('chat message', msg => {
      if (msg?.text && msg?.sender) {
        setMessages(prev => [...prev, msg]);
      }
    });

    socket.on('youtube-url', (videoId) => {
      if (player) player.loadVideoById(videoId);
    });

    socket.on('youtube-play', () => player?.playVideo());
    socket.on('youtube-pause', () => player?.pauseVideo());

    socket.on('disconnect', () => {
      setStatus('Disconnected from server.');
      cleanupPeer();
    });

    socket.on('connect_error', () => {
      setStatus('Connection error. Trying again...');
    });

    return () => {
      socket.disconnect();
    };
  }, [player]);

  useEffect(() => {
    window.onYouTubeIframeAPIReady = () => {
      const ytPlayer = new window.YT.Player('player', {
        height: '360',
        width: '640',
        events: {
          onReady: event => setPlayer(event.target),
          onStateChange: event => {
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
    cleanupPeer();
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

      {showVideoChat ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <video ref={localVideoRef} autoPlay muted width="200" />
          <video ref={remoteVideoRef} autoPlay width="200" />
        </div>
      ) : (
        <>
          <div style={{ border: '1px solid gray', height: 300, overflowY: 'auto', padding: 10, marginTop: 10, background: '#f9f9f9' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ textAlign: msg.sender === 'you' ? 'right' : 'left', marginBottom: 5 }}>
                <span style={{
                  display: 'inline-block',
                  background: msg.sender === 'you' ? '#dcf8c6' : '#fff',
                  padding: 8,
                  borderRadius: 10,
                  maxWidth: '70%',
                  wordWrap: 'break-word',
                  border: '1px solid #ccc'
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
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button onClick={findNewPartner} style={{ flex: 1, padding: 10 }}>Find New Partner</button>
        {paired && !showVideoChat && (
          <button onClick={() => createPeer(true)} style={{ flex: 1, padding: 10 }}>Start Video Chat</button>
        )}
      </div>

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

        <div id="player" style={{ marginTop: 20 }}></div>
      </div>
    </div>
  );
}

export default App;
