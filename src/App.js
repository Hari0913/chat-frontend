import { useEffect, useRef, useState } from 'react';
import { FaMoon, FaSun } from 'react-icons/fa';
import { Rnd } from 'react-rnd'; // Draggable component
import SimplePeer from 'simple-peer';
import io from 'socket.io-client';
import './App.css';

const socket = io('https://chat-backend-k6v0.onrender.com');

function App() {
  const [me, setMe] = useState('');
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('Stranger');
  const [nameInput, setNameInput] = useState('');
  const [stream, setStream] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [sharedYoutubeLink, setSharedYoutubeLink] = useState('');
  const [mode, setMode] = useState('light');
  const [connected, setConnected] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  // ✅ FIX: Define leaveCall to prevent 'not defined' error
  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
    setCallAccepted(false);
    connectionRef.current = null;
  };

  useEffect(() => {
    socket.on('me', id => setMe(id));
    socket.on('paired', ({ partnerId, partnerName }) => {
      setConnected(true);
      setPartnerName(partnerName || 'Stranger');
    });
    socket.on('waiting', () => setConnected(false));
    socket.on('chat message', ({ senderId, senderName, text }) => {
      setMessages(prev => [...prev, { senderId, senderName, text }]);
    });
    socket.on('youtube-url', id => setSharedYoutubeLink(id));
    socket.on('partner left', () => {
      setConnected(false);
      setPartnerName('Stranger');
      leaveCall(); // Now defined properly
    });
    socket.on('webrtc-signal', signal => {
      if (!connectionRef.current) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(localStream => {
          setStream(localStream);
          if (myVideo.current) myVideo.current.srcObject = localStream;
          const peer = new SimplePeer({ initiator: false, trickle: false, stream: localStream });
          peer.on('signal', data => socket.emit('webrtc-signal', data));
          peer.on('stream', currentStream => {
            if (userVideo.current) userVideo.current.srcObject = currentStream;
          });
          peer.signal(signal);
          connectionRef.current = peer;
          setCallAccepted(true);
        });
      } else {
        connectionRef.current.signal(signal);
      }
    });
  }, []);

  const sendMessage = () => {
    if (message.trim() && connected) {
      socket.emit('chat message', message);
      setMessage('');
    }
  };

  const toggleTheme = () => setMode(prev => (prev === 'light' ? 'dark' : 'light'));

  const extractYouTubeId = url => {
    const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[1].length === 11 ? match[1] : null;
  };

  const shareYoutubeVideo = () => {
    const id = extractYouTubeId(youtubeLink);
    if (id && connected) {
      socket.emit('youtube-url', id);
      setSharedYoutubeLink(id);
      setYoutubeLink('');
    }
  };

  return (
    <div className={`app ${mode}`}>
      <div className="header">
        <h1>Random Chat</h1>
        <button onClick={toggleTheme}>{mode === 'light' ? <FaMoon /> : <FaSun />}</button>
      </div>

      <div className="main">
        <div className="chat-section">
          {sharedYoutubeLink && (
            <Rnd default={{ x: 50, y: 50, width: 300, height: 200 }}>
              <iframe
                width="300"
                height="200"
                src={`https://www.youtube.com/embed/${sharedYoutubeLink}`}
                frameBorder="0"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="YouTube Video"
              />
            </Rnd>
          )}
          <div className="chat-box">
            {connected ? messages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.senderId === me ? 'me' : 'stranger'}`}>
                <div className="bubble">
                  <div className="sender">{msg.senderName}</div>
                  <div className="text">{msg.text}</div>
                </div>
              </div>
            )) : (
              <div className="system-message">Waiting for a partner...</div>
            )}
          </div>
          <div className="input-row">
            <input
              type="text"
              placeholder="Type message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
