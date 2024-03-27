import * as THREE from "three";
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader';

export class MyScene {
  constructor(socket) {
    // create a scene in which all other objects will exist
    this.scene = new THREE.Scene();
    this.socket = socket;
    this.moveVector = new THREE.Vector3(0, 0, 0);
    this.avatars = {};
    
    this.isDragging = false;
    this.selectedObject = null;
    // create a camera and position it in space
    let aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 5, 6.65); // 将相机放置在模型前方
    this.camera.lookAt(0, 5, 0); // 让相机朝向场景中心

    // the renderer will actually show the camera view within our <canvas>
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    // add shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap

    this.setupEnvironment();

    this.frameCount = 0;


    this.loop();
    this.fontLoader = new FontLoader(); // 新增:创建FontLoader
    this.fontLoader.load('Expose-Regular.json', (font) => {
      this.font = font; // 新增:加载字体
    });
    this.fbxModels = [];
    this.loadFBXModels();

    // 添加键盘事件监听
    document.addEventListener('keydown', this.onDocumentKeyDown.bind(this), false);
    document.addEventListener('keyup', this.onDocumentKeyUp.bind(this), false);

    // 添加鼠标事件监听
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this), false);

    // 初始化移动速度
    this.moveSpeed = 0.1;
    this.moveVector = new THREE.Vector3(0, 0, 0);
    this.dragOffset = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();


  }
  if (socket) {
    this.socket = socket;
    this.socket.on('adjustFrameSize', (userSpeakCounts) => {
      console.log('Received userSpeakCounts:', userSpeakCounts);
      console.log('Current avatars:', this.avatars);
    
      const totalSpeakCount = Object.values(userSpeakCounts).reduce((sum, count) => sum + count, 0);
    
      for (let id in this.avatars) {
        const speakCount = userSpeakCounts[id] || 0;
        const scale = 1 + speakCount / totalSpeakCount * 0.5;
        console.log(`Updating scale for user ${id}: ${scale}`);
        
        if (this.avatars[id].model) {
          this.avatars[id].model.scale.set(scale, scale, scale);
        }
    
        if (scale > 1) {
          this.logMessage(`User ${id}'s FBX model has been enlarged.`);
        }
      }
    });
    

    this.socket.on('showWinner', (winnerId) => {
      // 显示 "xxx主导了话语权" 的弹窗
      alert(`${winnerId} 主导了话语权`);
    });
  }

  logMessage(message) {
    const logContainer = document.getElementById('log-container');
    const logElement = document.createElement('p');
    logElement.textContent = message;
    logContainer.appendChild(logElement);
  
    // 如果日志数量超过10条,则删除最早的日志
    if (logContainer.childElementCount > 10) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }
  loadFBXModels() {
    const fbxLoader = new FBXLoader();
    const modelNames = [
      'comic_fracturepart1',
      'comic_fracturepart2',
      'comic_fracturepart3',
      'comic_fracturepart4',
      'comic_fracturepart5',
      'comic_fracturepart6',
      'comic_fracturepart7',
      'comic_fracturepart8',
      'comic_fracturepart9',
      'comic_fracturepart10',
      'comic_fracturepart11',
      'comic_fracturepart12',
      'comic_fracturepart13',
      'comic_fracturepart14',
    ];

    modelNames.forEach((name, index) => {
      fbxLoader.load(`${name}.fbx`, (fbxModel) => {
        fbxModel.scale.set(0.05, 0.05, 0.05); // 根据需要调整模型的缩放
        this.fbxModels.push(fbxModel);
        this.scene.add(fbxModel);
      });
    });
  }
  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Lighting 💡

  setupEnvironment() {
    this.scene.background = new THREE.Color(0xff0000);

    this.scene.add(new THREE.GridHelper(100, 100));

    //add a light
    let myColor = new THREE.Color(0xffaabb);
    let ambientLight = new THREE.AmbientLight(myColor, 0.5);
    this.scene.add(ambientLight);

    // add a directional light
    let myDirectionalLight = new THREE.DirectionalLight(myColor, 0.85);
    myDirectionalLight.position.set(-5, 3, -5);
    myDirectionalLight.lookAt(0, 0, 0);
    myDirectionalLight.castShadow = true;
    this.scene.add(myDirectionalLight);

  }
  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Keyboard Controls 🎹
  onDocumentKeyDown(event) {
    switch (event.keyCode) {
      case 87: // W
        if (this.moveVector) this.moveVector.z = -this.moveSpeed;
        break;
      case 83: // S
        if (this.moveVector) this.moveVector.z = this.moveSpeed;
        break;
      case 65: // A
        if (this.moveVector) this.moveVector.x = -this.moveSpeed;
        break;
      case 68: // D
        if (this.moveVector) this.moveVector.x = this.moveSpeed;
        break;
    }
  }

  onDocumentKeyUp(event) {
    switch (event.keyCode) {
      case 87: // W
      case 83: // S
        if (this.moveVector) this.moveVector.z = 0;
        break;
      case 65: // A
      case 68: // D
        if (this.moveVector) this.moveVector.x = 0;
        break;
    }
  }
  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Peers 👫
  addPeerAvatar(id) {
    console.log("Adding peer avatar to 3D scene.");
    this.avatars[id] = {};
    let videoElement = document.getElementById(id + "_video");
    if (!videoElement) {
      console.warn("Video element not found for peer with id:", id);
      return;
    }
  
    let videoTexture = new THREE.VideoTexture(videoElement);
  
    let videoMaterial = new THREE.MeshBasicMaterial({
      map: videoTexture,
      overdraw: true,
      side: THREE.DoubleSide,
    });
  
    let avatarIndex = Object.keys(this.avatars).length - 1;
    if (avatarIndex < this.fbxModels.length) {
      let fbxModel = this.fbxModels[avatarIndex];
      fbxModel.traverse((child) => {
        if (child.isMesh) {
          child.material = videoMaterial;
        }
      });
  
      this.avatars[id].model = fbxModel;
      this.avatars[id].group = new THREE.Group();
      this.avatars[id].group.add(fbxModel);
      this.scene.add(this.avatars[id].group);
    }
  }
  onMouseDown(event) {
    event.preventDefault();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, this.camera);
    const intersects = raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      const object = intersects[0].object;

      // 确认选中的对象是用户的头像
      if (object.userData.id) {
        this.isDragging = true;
        this.selectedObject = object.parent; // 假设对象是Group的一部分

        // 计算拖动偏移量
        const intersectPoint = intersects[0].point;
        this.dragOffset.subVectors(this.selectedObject.position, intersectPoint);
      }
    }
  }

  onMouseMove(event) {
    if (!this.isDragging || !this.selectedObject) return;

    event.preventDefault();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, this.camera);

    const planeIntersect = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeIntersect, intersectPoint);

    // 更新目标位置
    this.targetPosition.addVectors(intersectPoint, this.dragOffset);
  }

  onMouseUp(event) {
    if (!this.isDragging) return;

    event.preventDefault();

    // 发送位置更新信息到服务器
    let position = this.selectedObject.position;
    this.socket.emit('updatePosition', this.socket.id, [position.x, position.y, position.z]);

    this.isDragging = false;
    this.selectedObject = null;
  }

  updatePeerPosition(id, position) {
    if (this.avatars[id]) {
      this.avatars[id].group.position.set(position[0], position[1], position[2]);
    }
  }
  removePeerAvatar(id) {
    console.log("Removing peer avatar from 3D scene.");

    if (this.avatars[id] && this.avatars[id].model) {
      this.scene.remove(this.avatars[id].model);
    }

    delete this.avatars[id];
  }

  updatePeerAvatars(peerInfoFromServer) {
    for (let id in peerInfoFromServer) {
      if (id !== this.socket.id && this.avatars[id] && this.avatars[id].model) {
        let rot = peerInfoFromServer[id].rotation;
        this.avatars[id].model.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
      }
    }
  }

  updateClientVolumes() {
    for (let id in this.avatars) {
      let audioEl = document.getElementById(id + "_audio");
      if (audioEl && this.avatars[id].group) {
        let distSquared = this.camera.position.distanceToSquared(
          this.avatars[id].group.position
        );

        if (distSquared > 500) {
          audioEl.volume = 0;
        } else {
          // https://discourse.threejs.org/t/positionalaudio-setmediastreamsource-with-webrtc-question-not-hearing-any-sound/14301/29
          let volume = Math.min(1, 10 / distSquared);
          audioEl.volume = volume;
        }
      }
    }
  }

  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Interaction 🤾‍♀️

  getPlayerPosition() {
    return [
      [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      [
        this.camera.quaternion._x,
        this.camera.quaternion._y,
        this.camera.quaternion._z,
        this.camera.quaternion._w,
      ],
    ];
  }

  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Rendering 🎥

  loop() {
    this.frameCount++;

    // 平滑更新拖动对象的位置
    if (this.isDragging && this.selectedObject) {
      this.selectedObject.position.lerp(this.targetPosition, 0.1);
    }
    // update client volumes every 25 frames
    if (this.frameCount % 25 === 0) {
      this.updateClientVolumes();
    }
    // 更新相机位置
    if (this.camera && this.camera.position) {
      this.camera.position.add(this.moveVector);
    }

    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(() => this.loop());

    //Avatars
    //console.log(JSON.stringify(this.avatars) +"Avatars:!!!!!!");
  }
}