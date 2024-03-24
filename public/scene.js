import * as THREE from "three";
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader';

export class MyScene {
  constructor(socket) {
    this.avatars = {};
    this.socket = socket;
    this.isDragging = false;
    this.selectedObject = null;

    // create a scene in which all other objects will exist
    this.scene = new THREE.Scene();

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

    // add pointer lock controls
    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.scene.add(this.controls.getObject());

    this.setupEnvironment();

    this.frameCount = 0;

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

    // lock pointer lock controls
    this.controls.lock();

    this.loop();
    this.fontLoader = new FontLoader(); // 新增:创建FontLoader
    this.fontLoader.load('Expose-Regular.json', (font) => {
      this.font = font; // 新增:加载字体
    });
    this.fbxModels = [];
    this.loadFBXModels();
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

    // add a ground
    let groundGeo = new THREE.BoxGeometry(300, 0.1, 300);
    let groundMat = new THREE.MeshPhongMaterial({ color: "red" });
    let ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }
  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  // Keyboard Controls 🎹

  onDocumentKeyDown(event) {
    switch (event.keyCode) {
      case 87: // W
        this.moveVector.z = -this.moveSpeed;
        break;
      case 83: // S
        this.moveVector.z = this.moveSpeed;
        break;
      case 65: // A
        this.moveVector.x = -this.moveSpeed;
        break;
      case 68: // D
        this.moveVector.x = this.moveSpeed;
        break;
    }
  }

  onDocumentKeyUp(event) {
    switch (event.keyCode) {
      case 87: // W
      case 83: // S
        this.moveVector.z = 0;
        break;
      case 65: // A
      case 68: // D
        this.moveVector.x = 0;
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
      let fbxModel = this.fbxModels[avatarIndex].clone();
      fbxModel.traverse((child) => {
        if (child.isMesh) {
          child.material = videoMaterial;
        }
      });
  
      this.scene.add(fbxModel);
      this.avatars[id].model = fbxModel;
      
      // 创建一个组来包含模型和文本
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

  updateTranscript(socketId, transcript) {
    if (!this.avatars[socketId]) return;

    // 移除旧的transcript
    if (this.avatars[socketId].transcript) {
      this.scene.remove(this.avatars[socketId].transcript);
    }

    // 创建新的transcript
    const textGeometry = new TextGeometry(transcript, {
      font: this.font,
      size: 0.1,
      height: 0.01,
    });
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(0, 1.7, 0); // 调整文本位置
    this.avatars[socketId].group.add(textMesh);
    this.avatars[socketId].transcript = textMesh;
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
    this.camera.position.add(this.moveVector);

    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(() => this.loop());
  }
}