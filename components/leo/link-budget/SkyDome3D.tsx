'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimulationPass } from '@/lib/leo/linkBudget';

interface SkyDome3DProps {
  passes: {
    shortest: SimulationPass | null;
    median: SimulationPass | null;
    longest: SimulationPass | null;
  } | null;
}

export default function SkyDome3D({ passes }: SkyDome3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const animPointsRef = useRef<THREE.Vector3[]>([]);
  const satMeshRef = useRef<THREE.Mesh | null>(null);
  const animIndexRef = useRef<number>(0);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ── Scene Setup ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = null;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(1.5, 1.8, 1.5);
    camera.up.set(0, 0, 1); // Z-up coordinates

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 5;

    // ── Lighting ──────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 5, 10);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-5, -5, 5);
    scene.add(dirLight2);

    // ── Grid & Guides ──────────────────────────────────────────────────────
    // Flat grid on X-Y plane (Z-up)
    const gridHelper = new THREE.GridHelper(2.4, 24, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2; // align to X-Y
    scene.add(gridHelper);

    // Compass ring
    const ringGeo = new THREE.RingGeometry(1.2, 1.21, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    scene.add(ring);

    // ── Zenith / Colormap Sky Dome ──────────────────────────────────────────
    const vertexShader = `
      varying vec3 vPosition;
      varying vec3 vNormal;
      void main() {
        vPosition = position;
        vNormal = normalize(normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec3 vPosition;
      varying vec3 vNormal;
      
      vec3 colormap(float t) {
        t = clamp(t, 0.0, 1.0);
        // Cyberpunk colors: Deep Blue (Zenith) -> Pink/Purple -> Dark Orange/Red (Horizon)
        vec3 red = vec3(0.9, 0.15, 0.15);      // Horizon
        vec3 purple = vec3(0.5, 0.1, 0.6);     // Mid
        vec3 cyan = vec3(0.0, 0.8, 0.9);       // Zenith
        
        if (t < 0.5) {
          return mix(red, purple, t * 2.0);
        } else {
          return mix(purple, cyan, (t - 0.5) * 2.0);
        }
      }
      
      void main() {
        // Sphere is centered at 0,0,0, radius 1. Z ranges from 0 to 1 for dome
        float zVal = clamp(vPosition.z, 0.0, 1.0);
        vec3 baseColor = colormap(zVal);
        
        // Rim glow/fresnel
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);
        float alpha = 0.18 + fresnel * 0.35;
        
        gl_FragColor = vec4(baseColor, alpha);
      }
    `;

    const domeGeo = new THREE.SphereGeometry(1.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    // Rotate sphere so that +Y becomes +Z (Z-up coordinate conversion)
    domeGeo.rotateX(Math.PI / 2);

    const domeMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    scene.add(dome);

    // ── Directional Labels ──────────────────────────────────────────────────
    const addLabel = (text: string, x: number, y: number, z: number, color = '#ffffff') => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(x, y, z);
      sprite.scale.set(0.25, 0.125, 1);
      scene.add(sprite);
    };

    addLabel('N', 0, 1.35, 0, '#34d399');
    addLabel('S', 0, -1.35, 0, '#ef4444');
    addLabel('E', 1.35, 0, 0, '#22d3ee');
    addLabel('W', -1.35, 0, 0, '#f59e0b');
    addLabel('ZENITH', 0, 0, 1.3, '#22d3ee');

    // ── Procedural Starlink Dish Model ──────────────────────────────────────
    const dishGroup = new THREE.Group();
    scene.add(dishGroup);

    // Base stand (small plate)
    const standGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.015, 16);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.8 });
    const stand = new THREE.Mesh(standGeo, metalMat);
    stand.rotation.x = Math.PI / 2; // Flat on grid
    dishGroup.add(stand);

    // Vertical mounting pole
    const poleGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.08, 12);
    const pole = new THREE.Mesh(poleGeo, metalMat);
    pole.position.set(0, 0, 0.04);
    pole.rotation.x = Math.PI / 2; // Pointing upwards along Z
    dishGroup.add(pole);

    // Tilt head/joint
    const jointGeo = new THREE.SphereGeometry(0.012, 12, 12);
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const joint = new THREE.Mesh(jointGeo, jointMat);
    joint.position.set(0, 0, 0.08);
    dishGroup.add(joint);

    // Dish group (allows rotation as a unit)
    const actualDishGroup = new THREE.Group();
    actualDishGroup.position.set(0, 0, 0.08);
    // Tilted toward target azimuth/elevation (default: 65deg elevation, 135deg azimuth)
    actualDishGroup.rotation.y = 0.3; // tilt
    actualDishGroup.rotation.z = 1.0;
    dishGroup.add(actualDishGroup);

    // Dish support tube
    const supportGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.04, 12);
    const support = new THREE.Mesh(supportGeo, metalMat);
    support.position.set(0, 0, 0.02);
    support.rotation.x = Math.PI / 2;
    actualDishGroup.add(support);

    // Main paraboloid dish (white reflector)
    const dishReflectorGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.012, 32);
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xefefef, roughness: 0.4 });
    const dishReflector = new THREE.Mesh(dishReflectorGeo, whiteMat);
    dishReflector.position.set(0, 0, 0.04);
    dishReflector.rotation.x = Math.PI / 2;
    actualDishGroup.add(dishReflector);

    // Center feed horn support arm
    const feedArmGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.08, 8);
    const feedArm = new THREE.Mesh(feedArmGeo, metalMat);
    feedArm.position.set(0, 0, 0.08);
    feedArm.rotation.x = Math.PI / 2;
    actualDishGroup.add(feedArm);

    // Feed horn cone
    const hornGeo = new THREE.ConeGeometry(0.012, 0.02, 12);
    const horn = new THREE.Mesh(hornGeo, jointMat);
    horn.position.set(0, 0, 0.12);
    horn.rotation.x = -Math.PI / 2; // point back at the dish
    actualDishGroup.add(horn);

    // Scale whole terminal dish
    dishGroup.scale.set(1.5, 1.5, 1.5);

    // ── Resize Handler ──────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ── Animation Loop ──────────────────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const loop = () => {
      animId = requestAnimationFrame(loop);
      controls.update();

      // Rotate joint and dish slightly over time for a lively feel
      const elapsed = clock.getElapsedTime();
      actualDishGroup.rotation.z = 1.0 + Math.sin(elapsed * 0.5) * 0.15;

      // Animate satellite path
      if (satMeshRef.current && animPointsRef.current.length > 1) {
        const pathPoints = animPointsRef.current;
        const speed = 0.15; // path step speed
        animIndexRef.current += clock.getDelta() * speed * pathPoints.length;

        if (animIndexRef.current >= pathPoints.length - 1) {
          animIndexRef.current = 0; // loop
        }

        const idx = Math.floor(animIndexRef.current);
        const t = animIndexRef.current - idx;
        const p1 = pathPoints[idx];
        const p2 = pathPoints[idx + 1] || pathPoints[0];

        satMeshRef.current.position.lerpVectors(p1, p2, t);
      }

      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── Render Passes (when passes change) ───────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear old pass lines and markers
    const oldGroup = scene.getObjectByName('passes');
    if (oldGroup) scene.remove(oldGroup);

    const oldSat = scene.getObjectByName('demo-sat');
    if (oldSat) scene.remove(oldSat);

    satMeshRef.current = null;
    animPointsRef.current = [];
    animIndexRef.current = 0;

    if (!passes) return;

    const group = new THREE.Group();
    group.name = 'passes';

    const renderTrackLine = (pass: SimulationPass, color: number, name: string) => {
      const points: THREE.Vector3[] = [];
      const domeR = 1.21; // align slightly above dome

      const createMarker = (x: number, y: number, z: number, colorVal: number, shape: 'cone' | 'box') => {
        let geo;
        if (shape === 'cone') {
          geo = new THREE.ConeGeometry(0.015, 0.04, 8);
          geo.rotateX(Math.PI / 2);
        } else {
          geo = new THREE.BoxGeometry(0.025, 0.025, 0.025);
        }
        const mat = new THREE.MeshBasicMaterial({ color: colorVal });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);
        return mesh;
      };

      pass.track.forEach((pt, i) => {
        const azRad = (pt.az * Math.PI) / 180;
        const elRad = (pt.el * Math.PI) / 180;

        // Azimuth 0 is North (+Y), 90 is East (+X)
        const x = domeR * Math.cos(elRad) * Math.sin(azRad);
        const y = domeR * Math.cos(elRad) * Math.cos(azRad);
        const z = domeR * Math.sin(elRad);

        const ptVec = new THREE.Vector3(x, y, z);
        points.push(ptVec);

        // Add markers at rise & set
        if (i === 0) {
          group.add(createMarker(x, y, z, color, 'cone'));
        }
        if (i === pass.track.length - 1) {
          group.add(createMarker(x, y, z, color, 'box'));
        }
      });

      if (points.length > 1) {
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(
          geom,
          new THREE.LineBasicMaterial({ color, linewidth: 2, transparent: true, opacity: name === 'Median' ? 0.4 : 0.85 })
        );
        group.add(line);
      }

      return points;
    };

    let longestPoints: THREE.Vector3[] = [];

    if (passes.shortest) {
      renderTrackLine(passes.shortest, 0xef4444, 'Short'); // Red
    }
    if (passes.median) {
      renderTrackLine(passes.median, 0x888888, 'Median');  // Grey
    }
    if (passes.longest) {
      longestPoints = renderTrackLine(passes.longest, 0x22d3ee, 'Long') || []; // Cyan
    }

    scene.add(group);

    // Initialize satellite visualizer on longest pass
    if (longestPoints.length > 1) {
      const satGeo = new THREE.SphereGeometry(0.02, 16, 16);
      const satMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const sat = new THREE.Mesh(satGeo, satMat);
      sat.name = 'demo-sat';
      scene.add(sat);

      satMeshRef.current = sat;
      animPointsRef.current = longestPoints;
      animIndexRef.current = 0;
    }
  }, [passes]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', background: '#02040a' }} />
    </div>
  );
}
