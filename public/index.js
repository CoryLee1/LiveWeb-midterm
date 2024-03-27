import { MyScene } from "./scene.js";
// socket.io
let mySocket;
// array of connected peers
let peers = {};
// Variable to store our three.js scene:
let myScene;
// Our local media stream (i.e. webcam and microphone stream)
let localMediaStream = null;
////////////////////////////////////////////////////////////////////////////////
// Start-Up Sequence:
////////////////////////////////////////////////////////////////////////////////
let recognition;

function setupSpeechRecognition() {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    sendTranscript(transcript);
  };

  recognition.start();
}

function sendTranscript(transcript) {
  mySocket.emit('transcript', transcript);
}

window.onload = async () => {
  console.log("Window loaded.");

  // first get user media
  try {
    localMediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
  } catch (err) {
    console.warn("Failed to get user media!");
    console.warn(err);
  }

  createLocalVideoElement();
  //  create the threejs scene
  console.log("Creating three.js scene...");
  myScene = new MyScene(mySocket);

  // finally create the websocket connection
  establishWebsocketConnection();
  setupSpeechRecognition();
  // 每隔10秒发送一次'adjustFrameSize'事件
  setInterval(() => {
    mySocket.emit('adjustFrameSize', userSpeakCounts);
    userSpeakCounts = {}; // 重置发言次数
  }, 10 * 1000);
};

////////////////////////////////////////////////////////////////////////////////
// Socket.io Connections
////////////////////////////////////////////////////////////////////////////////

// establishes socket connection
function establishWebsocketConnection() {
  mySocket = io();

  mySocket.on("connect", () => {
    console.log("My socket ID is", mySocket.id);
  });

  mySocket.on("introduction", (peerInfo) => {
    for (let theirId in peerInfo) {
      console.log("Adding client with id " + theirId);
      peers[theirId] = {};

      let pc = createPeerConnection(theirId, true);
      peers[theirId].peerConnection = pc;

      addPeerMediaElements(theirId);
      myScene.addPeerAvatar(theirId);
    }
  });

  // when a new user has entered the server
  mySocket.on("newPeerConnected", (theirId) => {
    if (theirId != mySocket.id && !(theirId in peers)) {
      console.log("A new user connected with the ID: " + theirId);

      console.log("Adding client with id " + theirId);
      peers[theirId] = {};
      addPeerMediaElements(theirId);
      myScene.addPeerAvatar(theirId);
    }
  });

  mySocket.on("peerDisconnected", (_id) => {
    // Update the data from the server

    if (_id != mySocket.id) {
      console.log("A user disconnected with the id: " + _id);
      myScene.removePeerAvatar(_id);
      removePeerMediaElements(_id);
      delete peers[_id];
    }
  });

  mySocket.on("signal", (to, from, data) => {
    // to should be us
    if (to != mySocket.id) {
      console.log("Socket IDs don't match");
    }

    // Look for the right peer connection
    let peer = peers[from];
    if (peer.peerConnection) {
      peer.peerConnection.signal(data);
    } else {
      // Let's create it then, we won't be the "initiator"
      let peerConnection = createPeerConnection(from, false);

      peers[from].peerConnection = peerConnection;

      // forward the new simplepeer that signal
      peerConnection.signal(data);
    }
  });

  // Update when one of the users moves in space
  mySocket.on("peers", (peerInfoFromServer) => {
    // remove my info from the incoming data
    delete peerInfoFromServer[mySocket.id];
    myScene.updatePeerAvatars(peerInfoFromServer);
  });
  // 监听位置更新事件
  mySocket.on('peerPositionUpdated', (id, position) => {
    myScene.updatePeerPosition(id, position);
  });

  mySocket.on('peerTranscript', (socketId, transcript) => {
    displayTranscript1(socketId, transcript);
  });

  // 新增: 处理初始 STT.txt 文件内容
  mySocket.on('initSttFile', (sttFileContent) => {
    displaySttFileContent(sttFileContent);
  });

  // 新增: 处理更新后的 STT.txt 文件内容
  mySocket.on('updateSttFile', (sttFileContent) => {
    displaySttFileContent(sttFileContent);
    displayTranscript1(socketId, existingTranscripts[socketId]);
  });
}

// 新增: 显示 STT.txt 文件内容
function displaySttFileContent(sttFileContent) {
  const sttContainer = document.getElementById('stt-container');
  sttContainer.innerHTML = '';

  const lines = sttFileContent.trim().split('\n');
  for (const line of lines) {
    const [socketId, transcript] = line.split(']:');
    const userTranscript = document.createElement('div');
    userTranscript.classList.add('user-transcript');
    userTranscript.innerHTML = `<strong>${socketId.slice(1, -1)}:</strong> ${transcript}`;
    sttContainer.appendChild(userTranscript);
  }
}
function displayTranscript1(socketId, transcript) {
  let bubbleElement = document.getElementById(`bubble-${socketId}`);
  if (!bubbleElement) {
    bubbleElement = document.createElement('div');
    bubbleElement.id = `bubble-${socketId}`;
    bubbleElement.classList.add('bubble');
    document.getElementById('transcript-container').appendChild(bubbleElement);
  }
  // 随机生成字体大小(60px到300px之间)nio
  const fontSize = Math.floor(Math.random() * 40) + 60;
  bubbleElement.innerHTML = `<p style="font-size: ${fontSize}px">${transcript}</p>`;
  bubbleElement.classList.toggle('active', transcript !== '');

  // 将 bubble 元素置于相应的 avatar 上方
  const avatarGroup = myScene.avatars[socketId] && myScene.avatars[socketId].group ? myScene.avatars[socketId].group : null;
  if (avatarGroup) {
    const avatarPosition = new THREE.Vector3();
    avatarGroup.getWorldPosition(avatarPosition);

    const avatarHeight = 1.7; // 根据需要调整高度
    bubbleElement.style.position = 'absolute';
    bubbleElement.style.left = `${window.innerWidth * (avatarPosition.x / window.innerWidth) + window.innerWidth / 2}px`;
    bubbleElement.style.top = `${window.innerHeight * (1 - (avatarPosition.y + avatarHeight) / window.innerHeight)}px`;
    bubbleElement.style.zIndex = '1000';
  }
}

////////////////////////////////////////////////////////////////////////////////
// SimplePeer WebRTC Connections
////////////////////////////////////////////////////////////////////////////////

// this function sets up a peer connection and corresponding DOM elements for a specific client
function createPeerConnection(theirSocketId, isInitiator = false) {
  console.log("Connecting to peer with ID", theirSocketId);
  console.log("initiating?", isInitiator);

  let peerConnection = new SimplePeer({ initiator: isInitiator });
  // simplepeer generates signals which need to be sent across socket
  peerConnection.on("signal", (data) => {
    mySocket.emit("signal", theirSocketId, mySocket.id, data);
  });

  // When we have a connection, send our stream
  peerConnection.on("connect", () => {
    peerConnection.addStream(localMediaStream);
  });

  // Stream coming in to us
  peerConnection.on("stream", (stream) => {
    updatePeerMediaElements(theirSocketId, stream);
  });

  peerConnection.on("close", () => {
    console.log("Got close event");
  });

  peerConnection.on("error", (err) => {
    console.log(err);
  });

  return peerConnection;
}

//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
// Media DOM Elements

function createLocalVideoElement() {
  const videoElement = document.createElement("video");
  videoElement.id = "local_video";
  videoElement.autoplay = true;
  videoElement.width = 100;

  if (localMediaStream) {
    let videoStream = new MediaStream([localMediaStream.getVideoTracks()[0]]);
    localMediaStream.getAudioTracks()[0].enabled = false;

    videoElement.srcObject = videoStream;
    videoElement.muted = true;
    videoElement.setAttribute('playsinline', '');
    videoElement.play().catch((error) => {
      console.log('Error autoplay video:', error);
    });
  }
  document.body.appendChild(videoElement);
}

function addPeerMediaElements(_id) {
  console.log("Adding media element for peer with id: " + _id);

  const videoElement = document.createElement("video");
  videoElement.id = _id + "_video";
  videoElement.autoplay = true;
  // videoElement.style = "visibility: hidden;";

  document.body.appendChild(videoElement);

  // create audio element for peer
  let audioEl = document.createElement("audio");
  audioEl.setAttribute("id", _id + "_audio");
  audioEl.controls = "controls";
  audioEl.volume = 1;
  document.body.appendChild(audioEl);

  audioEl.addEventListener("loadeddata", () => {
    audioEl.play();
  });
}

function updatePeerMediaElements(_id, stream) {
  console.log("Updatings media element for peer with id: " + _id);

  let videoStream = new MediaStream([stream.getVideoTracks()[0]]);
  let audioStream = new MediaStream([stream.getAudioTracks()[0]]);

  const videoElement = document.getElementById(_id + "_video");
  videoElement.srcObject = videoStream;

  let audioEl = document.getElementById(_id + "_audio");
  audioEl.srcObject = audioStream;

}

function removePeerMediaElements(_id) {
  console.log("Removing media element for peer with id: " + _id);

  let videoEl = document.getElementById(_id + "_video");
  if (videoEl != null) {
    videoEl.remove();
  }
}
