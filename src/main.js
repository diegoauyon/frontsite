import "./style.css";

import * as THREE from "three/webgpu";
import {
  color,
  screenUV,
  hue,
  reflector,
  time,
  Fn,
  vec2,
  length,
  atan2,
  float,
  sin,
  cos,
  vec3,
  sub,
  mul,
  pow,
  blendDodge,
  normalWorld,
} from "three/tsl";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

import { addAudioListenerToCamera } from "./audio.js";

var userMove = false;

export const lightSpeed = /*#__PURE__*/ Fn(([suv_immutable]) => {
  // forked from https://www.shadertoy.com/view/7ly3D1

  const suv = vec2(suv_immutable);
  const uv = vec2(length(suv), atan2(suv.y, suv.x));
  const offset = float(
    float(0.1)
      .mul(sin(uv.y.mul(10).sub(time.mul(0.6))))
      .mul(cos(uv.y.mul(48).add(time.mul(0.3))))
      .mul(cos(uv.y.mul(3.7).add(time)))
  );
  const rays = vec3(
    vec3(sin(uv.y.mul(150).add(time)).mul(0.5).add(0.5))
      .mul(
        vec3(
          sin(uv.y.mul(80).sub(time.mul(0.6)))
            .mul(0.5)
            .add(0.5)
        )
      )
      .mul(
        vec3(
          sin(uv.y.mul(45).add(time.mul(0.8)))
            .mul(0.5)
            .add(0.5)
        )
      )
      .mul(
        vec3(
          sub(
            1,
            cos(
              uv.y.add(mul(22, time).sub(pow(uv.x.add(offset), 0.3).mul(60)))
            )
          )
        )
      )
      .mul(vec3(uv.x.mul(2)))
  );

  return rays;
}).setLayout({
  name: "lightSpeed",
  type: "vec3",
  inputs: [{ name: "suv", type: "vec2" }],
});

const mainLogic = async () => {

  const loadingManager = new THREE.LoadingManager( () => {
	
		const loadingScreen = document.getElementById( 'loading-screen' );
		loadingScreen.classList.add( 'fade-out' );
		
		// optional: remove loader from DOM via event listener
		loadingScreen.addEventListener( 'transitionend', onTransitionEnd );
		
	} );

  const [sourceModel, me, gaby] = await Promise.all([
    new Promise((resolve, reject) => {
      new GLTFLoader(loadingManager).load(
        "./models/Michelle.glb",
        resolve,
        undefined,
        reject
      );
    }),

    new Promise((resolve, reject) => {
      new GLTFLoader().load("./models/me.glb", resolve, undefined, reject);
    }),

    new Promise((resolve, reject) => {
      new GLTFLoader().load("./models/gaby5.glb", resolve, undefined, reject);
    }),
  ]);

  //

  const clock = new THREE.Clock();

    // scene

  const scene = new THREE.Scene();

  // background

  const coloredVignette = screenUV
    .distance(0.5)
    .mix(
      hue(color(0x0175ad), time.mul(0.1)),
      hue(color(0x02274f), time.mul(0.5))
    );
  const lightSpeedEffect = lightSpeed(normalWorld).clamp();
  const lightSpeedSky = normalWorld.y
    .remapClamp(-0.1, 1)
    .mix(0, lightSpeedEffect);
  const composedBackground = blendDodge(coloredVignette, lightSpeedSky);

  scene.backgroundNode = composedBackground;

  //

  const helpers = new THREE.Group();
  helpers.visible = false;
  scene.add(helpers);

  const light = new THREE.HemisphereLight(0xe9c0a5, 0x0175ad, 5);
  scene.add(light);

  const dirLight = new THREE.DirectionalLight(0xfff9ea, 4);
  dirLight.position.set(2, 5, 2);
  scene.add(dirLight);

  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.25,
    50
  );
  camera.position.set(0, 1, 4);

  // add models to scene
  //scene.add(sourceModel.scene);
  scene.add(gaby.scene);
  scene.add(me.scene);

  // reposition models
  //sourceModel.scene.position.x -= 0.8;
  gaby.scene.position.x -= 0.8;
  me.scene.position.x += 0.7;

  me.scene.position.z -= 0.1;

  gaby.scene.position.y = 0.8;
  me.scene.position.y = 0.9;

  // reajust model
  me.scene.scale.setScalar(1);
  gaby.scene.scale.setScalar(0.9);

  // flip model
  //sourceModel.scene.rotation.y = Math.PI / 2;
  gaby.scene.rotation.y = Math.PI / 2;
  me.scene.rotation.y = -Math.PI / 2;

  // retarget
  const source = getSource(sourceModel);
  const mixerMe = retargetModel(source, me);
  const mixerGaby = retargetModel(source, gaby);

  // floor
  const reflection = reflector();
  reflection.target.rotateX(-Math.PI / 2);
  scene.add(reflection.target);

  const floorMaterial = new THREE.NodeMaterial();
  floorMaterial.colorNode = reflection;
  floorMaterial.opacity = 0.2;
  floorMaterial.transparent = true;

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(50, 0.001, 50),
    floorMaterial
  );
  floor.receiveShadow = true;

  floor.position.set(0, 0, 0);
  scene.add(floor);

  // renderer
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setAnimationLoop(animate);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const target = { x: 2, y: 2, z: 0 };
  const camera_offset = { x: 2, y: 1, z: 10 };
  const camera_speed = 0.4;

  function getSource(sourceModel) {
    const clip = sourceModel.animations[0];

    const helper = new THREE.SkeletonHelper(sourceModel.scene);
    helpers.add(helper);

    const skeleton = new THREE.Skeleton(helper.bones);

    const mixer = new THREE.AnimationMixer(sourceModel.scene);
    mixer.clipAction(sourceModel.animations[0]).play();

    return { clip, skeleton, mixer };
  }

  function retargetModel(sourceModel, targetModel) {
    const targetSkin = targetModel.scene.children[0].children[1];

    const retargetOptions = {

      // specify the name of the source's hip bone.
      hip: "mixamorigHips",

      // preserve the scale of the target model
      scale: 0.01,

      // use ( 0, 1, 0 ) to ignore xz hip movement.
      //hipInfluence: new THREE.Vector3( 0, 1, 0 ),

      // Map of target's bone names to source's bone names -> { targetBoneName: sourceBoneName }
      getBoneName: function (bone) {
        return "mixamorig" + bone.name;
      },
    };

    const retargetedClip = SkeletonUtils.retargetClip(
      targetSkin,
      sourceModel.skeleton,
      sourceModel.clip,
      retargetOptions
    );

    // Apply the mixer directly to the SkinnedMesh, not any
    // ancestor node, because that's what
    // SkeletonUtils.retargetClip outputs the clip to be
    // compatible with.
    const mixer = new THREE.AnimationMixer(targetSkin);
    mixer.clipAction(retargetedClip).play();

    return mixer;
  }

  window.onresize = function () {
    //stats.update();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener("mousemove", (e) => {
    console.log("mouse move");
    if (userMove === false) {
      userMove = true;
      addAudioListenerToCamera(camera);
    }
  });

  window.addEventListener("touchstart", (e) => {
    if (userMove === false) {
      userMove = true;
      addAudioListenerToCamera(camera);
    }
  });

  function animate() {
    const delta = clock.getDelta();

    const times = clock.elapsedTime.toFixed(2);

    //source.mixer.update(delta);
    mixerMe.update(delta);
    mixerGaby.update(delta);

    //controls.update();

    //sphere.position.x=5+(2*(Math.cos(time*2)));
    //sphere.position.y=2+(5*Math.abs(Math.sin(time*2)));
    target.x = (me.scene.position.x + gaby.scene.position.x) / 2;
    target.y = (me.scene.position.y + gaby.scene.position.y) / 2;
    //target.y=sphere.position.y
    //target.z=sphere.position.z;
    camera.position.x =
      target.x + camera_offset.x * Math.sin(times * camera_speed);
    camera.position.z =
      target.z + camera_offset.z * Math.cos(times * camera_speed);
    camera.position.y = target.y + camera_offset.y;
    camera.lookAt(target.x, target.y, target.z);

    renderer.render(scene, camera);
  }
};


mainLogic();