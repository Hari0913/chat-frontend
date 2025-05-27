import { useEffect, useRef, useState } from 'react';
import { FaMoon, FaSun, FaYoutube } from 'react-icons/fa6';
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

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    socket.on('me', id => setMe(id));
    socket.on('partner-found', ({ partnerId }) => setPartnerSocket(partnerId));
    socket.on('callUser', data => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerSignal(data.signal);
    });
    socket.on('message', ({ sender, text }) => {
      setMessages(prev => [...prev, { sender, text }]);
    });
    socket.on('shareYoutube', link => {
      setSharedYoutubeLink(link);
    });
  }, []);

  const callUser = () => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(localStream => {
      setStream(localStream);
      if (myVideo.current) myVideo.current.srcObject = localStream;

      const peer = new SimplePeer({ initiator: true, trickle: false, stream: localStream });
      peer.on('signal', data => {
        socket.emit('callUser', { userToCall: partnerSocket, signalData: data, from: me });
      });
      peer.on('stream', currentStream => {
        if (userVideo.current) userVideo.current.srcObject = currentStream;
      });
      socket.on('callAccepted', signal => {
        setCallAccepted(true);
        peer.signal(signal);
      });
      connectionRef.current = peer;
    });
  };

  const answerCall = () => {
    setCallAccepted(true);
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(localStream => {
      setStream(localStream);
      if (myVideo.current) myVideo.current.srcObject = localStream;

      const peer = new SimplePeer({ initiator: false, trickle: false, stream: localStream });
      peer.on('signal', data => {
        socket.emit('answerCall', { signal: data, to: caller });
      });
      peer.on('stream', currentStream => {
        if (userVideo.current) userVideo.current.srcObject = currentStream;
      });
      peer.signal(callerSignal);
      connectionRef.current = peer;
    });
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) connectionRef.current.destroy();
    window.location.reload();
  };

  const sendMessage = () => {
    if (message && partnerSocket) {
      socket.emit('message', { to: partnerSocket, sender: me, text: message });
      setMessages(prev => [...prev, { sender: 'Me', text: message }]);
      setMessage('');
    }
  };

  const toggleTheme = () => {
    setMode(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const shareYoutube = () => {
    if (youtubeLink && partnerSocket) {
      socket.emit('shareYoutube', { to: partnerSocket, link: youtubeLink });
      setSharedYoutubeLink(youtubeLink);
      setYoutubeLink('');
    }
  };

  const startVideoChat = () => {
    if (window.confirm('By clicking OK, you will reveal your face to a random stranger. Proceed?')) {
      callUser();
    }
  };

  return (
    <div className={`app ${mode}`}>
      <div className="header">
        <h1>🎲 Random Chat</h1>
        <div className="top-buttons">
          <button onClick={toggleTheme}>{mode === 'light' ? <FaMoon /> : <FaSun />}</button>
          <input
            type="text"
            placeholder="Paste YouTube link"
            value={youtubeLink}
            onChange={e => setYoutubeLink(e.target.value)}
          />
          <button onClick={shareYoutube}><FaYoutube /></button>
        </div>
      </div>

      <div className="main">
        <div className={`video-section ${callAccepted && !callEnded ? 'active' : ''}`}>
          {callAccepted && !callEnded && (
            <>
              <video playsInline muted ref={myVideo} autoPlay className="video" />
              <video playsInline ref={userVideo} autoPlay className="video" />
            </>
          )}
        </div>

        <div className="chat-section">
          {sharedYoutubeLink && (
            <div className="youtube">
              <iframe
                width="100%"
                height="250"
                src={`https://www.youtube.com/embed/${sharedYoutubeLink.split('v=')[1]}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube video"
              ></iframe>
            </div>
          )}

          <div className="chat-box">
            {messages.map((msg, index) => (
              <div key={index} className="chat-message">
                <strong>{msg.sender}:</strong> {msg.text}
              </div>
            ))}
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

          <div className="bottom-controls">
            <button onClick={() => window.location.reload()}>Find New Partner</button>
            <button onClick={startVideoChat}>Start Video Chat</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
