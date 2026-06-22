'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  OrbitParams,
  buildConstellationPositions,
  latLonToVector3,
  getOrbitCircle3D,
  altitudeToOrbitRadius,
  DEFAULT_ALTITUDE_KM,
} from '@/lib/leo/walkerOrbit';
import { CanvasDisplayOptions } from './ConstellationCanvas';

const SCENE_EARTH_R = 5;
const ORBIT_R = altitudeToOrbitRadius(DEFAULT_ALTITUDE_KM, SCENE_EARTH_R);

interface Props {
  params: OrbitParams;
  isPlaying: boolean;
  speed: number;
  timeOffsetRef: React.MutableRefObject<number>;
  displayOpts: CanvasDisplayOptions;
}

export default function ThreeGlobeInner({
  params,
  isPlaying,
  speed,
  timeOffsetRef,
  displayOpts,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 2000);
    camera.position.set(0, 10, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 7;
    controls.maxDistance = 50;

    // ── Lighting ──────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const sunDir = new THREE.Vector3(-50, 20, -50).normalize();
    const pointLight = new THREE.PointLight(0xffffff, 1.5);
    pointLight.position.copy(sunDir).multiplyScalar(800);
    scene.add(pointLight);

    // Sun glow
    [{ r: 20, o: 1.0 }, { r: 25, o: 0.6 }, { r: 35, o: 0.3 }, { r: 50, o: 0.15 }].forEach(({ r, o }) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: o, blending: THREE.AdditiveBlending }),
      );
      m.position.copy(pointLight.position);
      scene.add(m);
    });

    // ── Textures ──────────────────────────────────────────────────────────
    const loader = new THREE.TextureLoader();

    // Starfield
    const starTex = loader.load('/static/textures/8k_stars_milky_way.jpg');
    const starMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 64, 64),
      new THREE.MeshBasicMaterial({ map: starTex, side: THREE.BackSide }),
    );
    scene.add(starMesh);

    // Earth — day/night shader
    const dayTex = loader.load('/static/textures/8k_earth_daymap.jpg');
    const nightTex = loader.load('/static/textures/8k_earth_nightmap.jpg');

    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTex },
        nightTexture: { value: nightTex },
        sunDirection: { value: sunDir },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalWorld;
        void main() {
          vUv = uv;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec3 sunDirection;
        varying vec2 vUv;
        varying vec3 vNormalWorld;
        void main() {
          float intensity = dot(vNormalWorld, sunDirection);
          float mixVal = smoothstep(-0.2, 0.2, intensity);
          vec3 dayColor = texture2D(dayTexture, vUv).rgb;
          vec3 nightColor = texture2D(nightTexture, vUv).rgb;
          gl_FragColor = vec4(mix(nightColor, dayColor, mixVal), 1.0);
        }
      `,
    });

    const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(SCENE_EARTH_R, 64, 64), earthMat);
    scene.add(earthMesh);

    // ── Satellites particle system ─────────────────────────────────────────
    const satGeo = new THREE.BufferGeometry();
    const maxSats = 5000;
    const posArr = new Float32Array(maxSats * 3);
    satGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = 16; dotCanvas.height = 16;
    const dCtx = dotCanvas.getContext('2d')!;
    dCtx.fillStyle = '#ffffff';
    dCtx.beginPath();
    dCtx.arc(8, 8, 4, 0, Math.PI * 2);
    dCtx.fill();

    const satPoints = new THREE.Points(satGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.15,
      map: new THREE.CanvasTexture(dotCanvas),
      transparent: true, depthWrite: false,
    }));
    scene.add(satPoints);

    // ── Orbit lines group ─────────────────────────────────────────────────
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    const rebuildOrbits = () => {
      while (orbitGroup.children.length) orbitGroup.remove(orbitGroup.children[0]);
      if (!displayOpts.showOrbits) return;
      const { orbital_planes, inclination } = params;
      for (let p = 0; p < orbital_planes; p++) {
        const hue = (p / orbital_planes) * 60 + 170;
        const color = new THREE.Color(`hsl(${hue}, 70%, 50%)`);
        const pts = getOrbitCircle3D(p, orbital_planes, inclination, ORBIT_R);
        const geom = new THREE.BufferGeometry().setFromPoints(
          pts.map(({ x, y, z }) => new THREE.Vector3(x, y, z)),
        );
        orbitGroup.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color, opacity: 0.4, transparent: true })));
      }
    };
    rebuildOrbits();

    // ── Beam cones (InstancedMesh) ────────────────────────────────────────
    const alignGeo = new THREE.ConeGeometry(1, 1, 32, 1, true);
    alignGeo.rotateX(-Math.PI / 2);
    alignGeo.translate(0, 0, 0.5);
    const beamMesh = new THREE.InstancedMesh(
      alignGeo,
      new THREE.MeshBasicMaterial({ color: 0x00ffff, opacity: 0.12, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      maxSats,
    );
    beamMesh.count = params.satellites;
    scene.add(beamMesh);

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Animation loop ────────────────────────────────────────────────────
    const dummy = new THREE.Object3D();
    const earthCenter = new THREE.Vector3(0, 0, 0);
    let animId: number;

    const loop = () => {
      animId = requestAnimationFrame(loop);
      controls.update();

      const positions = buildConstellationPositions(params, timeOffsetRef.current);
      const total = positions.length;

      // Update satellite positions
      const posData = satGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < Math.min(total, maxSats); i++) {
        const { x, y, z } = latLonToVector3(positions[i].lat, positions[i].lon, ORBIT_R);
        posData.setXYZ(i, x, y, z);
      }
      satGeo.setDrawRange(0, Math.min(total, maxSats));
      posData.needsUpdate = true;

      // Update beam cones
      beamMesh.visible = displayOpts.showBeams;
      if (displayOpts.showBeams) {
        beamMesh.count = total;
        const angle = params.beam_size * 0.5;
        const dist = ORBIT_R - SCENE_EARTH_R;
        const radius = dist * Math.tan(angle);
        for (let i = 0; i < Math.min(total, maxSats); i++) {
          const { x, y, z } = latLonToVector3(positions[i].lat, positions[i].lon, ORBIT_R);
          dummy.position.set(x, y, z);
          dummy.lookAt(earthCenter);
          dummy.scale.set(radius, radius, dist);
          dummy.updateMatrix();
          beamMesh.setMatrixAt(i, dummy.matrix);
        }
        beamMesh.instanceMatrix.needsUpdate = true;
      }

      orbitGroup.visible = displayOpts.showOrbits;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, displayOpts]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}
