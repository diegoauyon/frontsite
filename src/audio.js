import * as THREE from "three";


import songUrl from "/bonita.mp3";

const audioLoader = new THREE.AudioLoader();

export const addAudioListenerToCamera = (camera) => {
  camera.add(createAudioListener());
};

export const createAudioListener = () => {
  const listener = new THREE.AudioListener();

  const sound = new THREE.Audio(listener);

  audioLoader.load(songUrl, (buffer) => {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.5);
    sound.play();
  });

  return listener;
};
