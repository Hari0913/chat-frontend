import { useEffect, useRef, useState } from 'react';
import YouTube from 'react-youtube';
import SimplePeer from 'simple-peer';
import io from 'socket.io-client';

const socket = io('https://chat-backend-5d2r.onrender.com');

export default function ChatApp() {
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

    socket.on('chat message', data => {
      setMessages(prev => [...prev, data]);
    });

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

  const ytRef = useRef();

  return (
    <div className={`min-h-screen flex flex-col transition bg-${mode === 'dark' ? 'gray-900' : 'gray-100'} text-${mode === 'dark' ? 'white' : 'black'}`}>
      <div className="flex justify-between items-center p-4 border-b">
        <h1 className="text-xl font-bold">Random Chat</h1>
        <div className="flex gap-2">
          <button className="px-2 py-1 rounded bg-blue-500 text-white" onClick={toggleTheme}>Toggle {mode} mode</button>
          <button className="px-2 py-1 rounded bg-green-500 text-white" onClick={handleYoutubeShare}>Share YouTube</button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 flex flex-col border-r p-2 space-y-2">
          <video ref={localVideoRef} autoPlay muted className="rounded shadow-md w-full h-1/2 object-cover" />
          <video ref={remoteVideoRef} autoPlay className="rounded shadow-md w-full h-1/2 object-cover" />
        </div>
        <div className="w-1/2 flex flex-col p-2 space-y-2">
          {videoId && (
            <YouTube
              videoId={videoId}
              opts={{ width: '100%', height: '250' }}
              onReady={e => (ytRef.current = e)}
              className="rounded shadow-md"
            />
          )}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 p-2 rounded shadow-inner" ref={chatBoxRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`mb-1 ${msg.sender === 'you' ? 'text-right' : 'text-left'}`}>
                <span className="inline-block px-3 py-1 rounded bg-gray-300 dark:bg-gray-700">{msg.text}</span>
              </div>
            ))}
          </div>
          <div className="flex">
            <input
              className="flex-1 p-2 border rounded-l dark:bg-gray-700 dark:text-white"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage} className="px-4 bg-blue-600 text-white rounded-r">Send</button>
          </div>
          <p className="text-sm text-center text-gray-400 mt-1">{status}</p>
        </div>
      </div>
    </div>
  );
}




