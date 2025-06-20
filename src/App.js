import { useEffect, useRef, useState } from 'react';
import { FaMoon, FaSun, FaYoutube } from 'react-icons/fa';
import SimplePeer from 'simple-peer';
import io from 'socket.io-client';
import './App.css';

const socket = io('https://chat-backend-k6v0.onrender.com');

function App() {
  const [me, setMe] = useState('');
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('Stranger');
  const [stream, setStream] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [sharedYoutubeLink, setSharedYoutubeLink] = useState('');
  const [mode, setMode] = useState('light');
  const [connected, setConnected] = useState(false);
  const [nameSet, setNameSet] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    socket.on('me', id => {
      setMe(id);
    });

    socket.on('paired', ({ partnerId, partnerName }) => {
      setConnected(true);
      setPartnerName(partnerName || 'Stranger');
    });

    socket.on('waiting', () => setConnected(false));

    socket.on('chat message', ({ sender, text }) => {
      setMessages(prev => [...prev, { sender, text }]);
    });

    socket.on('youtube-url', id => {
      setSharedYoutubeLink(id);
    });

    socket.on('partner left', () => {
      setConnected(false);
      leaveCall();
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

  const setName = () => {
    if (myName.trim()) {
      socket.emit('set-name', myName);
      setNameSet(true);
    }
  };

  const callUser = () => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(localStream => {
      setStream(localStream);
      if (myVideo.current) myVideo.current.srcObject = localStream;

      const peer = new SimplePeer({ initiator: true, trickle: false, stream: localStream });
      peer.on('signal', data => socket.emit('webrtc-signal', data));
      peer.on('stream', currentStream => {
        if (userVideo.current) userVideo.current.srcObject = currentStream;
      });
      connectionRef.current = peer;
    });
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
    setCallAccepted(false);
    connectionRef.current = null;
  };

  const sendMessage = () => {
    if (message.trim() && connected) {
      setMessages(prev => [...prev, { sender: 'You', text: message }]);
      socket.emit('chat message', message);
      setMessage('');
    }
  };

  const toggleTheme = () => setMode(prev => (prev === 'light' ? 'dark' : 'light'));

  const extractYouTubeId = url => {
    try {
      const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return match && match[1].length === 11 ? match[1] : null;
    } catch {
      return null;
    }
  };

  const shareYoutubeVideo = () => {
    const id = extractYouTubeId(youtubeLink);
    if (id && connected) {
      socket.emit('youtube-url', id);
      setSharedYoutubeLink(id);
      setYoutubeLink('');
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

  if (!nameSet) {
    return (
      <div className="name-input">
        <h2>Enter Your Name</h2>
        <input
          type="text"
          placeholder="Your name"
          value={myName}
          onChange={e => setMyName(e.target.value)}
        />
        <button onClick={setName}>Join Chat</button>
      </div>
    );
  }

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
          <button onClick={shareYoutubeVideo}><FaYoutube /></button>
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
            {connected ? (
              messages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.sender === 'You' ? 'me' : 'stranger'}`}>
                  <div className="bubble">
                    <div className="sender">{msg.sender === 'You' ? 'Me' : partnerName}</div>
                    <div className="text">{msg.text}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="chat-message system-message">Waiting for a partner...</div>
            )}
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
