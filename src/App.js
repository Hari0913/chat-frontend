import { useEffect, useRef, useState } from 'react';
import { FaMoon, FaSun, FaYoutube } from 'react-icons/fa';
import SimplePeer from 'simple-peer';
import io from 'socket.io-client';
import './App.css';

const socket = io('https://chat-backend-k6v0.onrender.com');

function App() {
  const [me, setMe] = useState('');
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState('');
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [partnerSocket, setPartnerSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [sharedYoutubeLink, setSharedYoutubeLink] = useState('');
  const [mode, setMode] = useState('light');
  const [connected, setConnected] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    socket.on('me', id => setMe(id));
    socket.on('paired', () => setConnected(true));
    socket.on('waiting', () => setConnected(false));

    socket.on('callUser', data => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerSignal(data.signal);
    });

    socket.on('chat message', ({ sender, text }) => {
      setMessages(prev => [...prev, { sender: sender === 'stranger' ? 'Stranger' : 'Me', text }]);
    });

    socket.on('youtube-url', id => {
      setSharedYoutubeLink(id);
    });

    socket.on('partner left', () => {
      setConnected(false);
      leaveCall();
    });
  }, []);

  const callUser = () => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(localStream => {
      setStream(localStream);
      if (myVideo.current) myVideo.current.srcObject = localStream;

      const peer = new SimplePeer({ initiator: true, trickle: false, stream: localStream });
      peer.on('signal', data => {
        socket.emit('webrtc-signal', data);
      });
      peer.on('stream', currentStream => {
        if (userVideo.current) userVideo.current.srcObject = currentStream;
      });
      socket.on('webrtc-signal', signal => {
        setCallAccepted(true);
        peer.signal(signal);
      });
      connectionRef.current = peer;
    });
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) connectionRef.current.destroy();
    setStream(null);
    setCallAccepted(false);
  };

  const sendMessage = () => {
    if (message && connected) {
      socket.emit('chat message', message);
      setMessages(prev => [...prev, { sender: 'Me', text: message }]);
      setMessage('');
    }
  };

  const toggleTheme = () => {
    setMode(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const shareYoutube = () => {
    if (youtubeLink && connected) {
      const videoId = youtubeLink.split('v=')[1]?.split('&')[0];
      if (videoId) {
        socket.emit('youtube-url', videoId);
        setSharedYoutubeLink(videoId);
        setYoutubeLink('');
      }
    }
  };

  const startVideoChat = () => {
    if (window.confirm('By clicking OK, you will reveal your face to a random stranger. Proceed?')) {
      callUser();
    }
  };

  const findNewPartner = () => {
    socket.emit('find-new-partner');
    setMessages([]);
    setSharedYoutubeLink('');
    leaveCall();
  };

  return (
    <div className={`app ${mode}`}>
      <div className="header">
        <div className="top-line">
          <h1>🎲 Random Chat</h1>
          <button onClick={toggleTheme}>{mode === 'light' ? <FaMoon /> : <FaSun />}</button>
        </div>
        <div className="top-buttons">
          <input
            type="text"
            placeholder="Paste YouTube link"
            value={youtubeLink}
            onChange={e => setYoutubeLink(e.target.value)}
          />
          <button onClick={shareYoutube}><FaYoutube /></button>
          {!callAccepted && <button onClick={startVideoChat}>Start Video Chat</button>}
          {callAccepted && <button onClick={leaveCall}>End Video Chat</button>}
          <button onClick={findNewPartner}>Find New Partner</button>
        </div>
      </div>

      <div className="main">
        {callAccepted && !callEnded && (
          <div className="video-section">
            <video playsInline muted ref={myVideo} autoPlay className="video" />
            <video playsInline ref={userVideo} autoPlay className="video" />
          </div>
        )}

        <div className="chat-section">
          {sharedYoutubeLink && (
            <div className="youtube">
              <iframe
                width="100%"
                height="250"
                src={`https://www.youtube.com/embed/${sharedYoutubeLink}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube video"
              ></iframe>
            </div>
          )}

          <div className="chat-box">
            {connected ? messages.map((msg, index) => (
              <div key={index} className="chat-message">
                <strong>{msg.sender}:</strong> {msg.text}
              </div>
            )) : <div className="chat-message">Waiting for a partner...</div>}
          </div>

          <div className="input-row">
            <input
              type="text"
              placeholder="Type your message"
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
