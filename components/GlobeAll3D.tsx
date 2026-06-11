'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import * as satellite from 'satellite.js';
import { GLOBE_RADIUS_THREE, latLngAltToVector3, EARTH_RADIUS_KM } from '@/utils/orbit';
import { Eye, EyeOff, Radio, Search, Play, Pause, ChevronRight } from 'lucide-react';

interface SatelliteRaw {
  n: string; // name
  i: string; // id
  1: string; // TLE line 1
  2: string; // TLE line 2
}

interface SatrecEntry {
  id: string;
  name: string;
  satrec: satellite.SatRec;
  raw: SatelliteRaw;
}

interface SatTelemetry {
  name: string;
  id: string;
  lat: number;
  lng: number;
  alt: number;
  vel: number;
  timeString: string;
}

interface GlobeAll3DProps {
  satellites: SatelliteRaw[];
}

export default function GlobeAll3D({ satellites }: GlobeAll3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [satrecs, setSatrecs] = useState<(SatrecEntry | null)[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSat, setSelectedSat] = useState<SatelliteRaw | null>(null);
  const [satTelemetry, setSatTelemetry] = useState<SatTelemetry | null>(null);
  
  // HUD toggles
  const [showOrbit, setShowOrbit] = useState<boolean>(true);
  const [showClouds, setShowClouds] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Sync refs for the animation loop
  const stateRef = useRef({
    satellites,
    satrecs,
    searchQuery,
    selectedSat,
    showOrbit,
    showClouds,
    speedMultiplier,
    isPaused,
  });

  useEffect(() => {
    stateRef.current = {
      satellites,
      satrecs,
      searchQuery,
      selectedSat,
      showOrbit,
      showClouds,
      speedMultiplier,
      isPaused,
    };
  }, [satellites, satrecs, searchQuery, selectedSat, showOrbit, showClouds, speedMultiplier, isPaused]);

  // Keep references to update scene nodes dynamically from loop
  const pointsRef = useRef<THREE.Points | null>(null);
  const selectedOrbitLineRef = useRef<THREE.Object3D | null>(null);
  const selectionMarkerRef = useRef<THREE.Mesh | null>(null);
  const cloudMeshRef = useRef<THREE.Mesh | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);



  // Parse satellites incrementally in background chunks to prevent blocking the UI thread
  useEffect(() => {
    if (satellites.length === 0) return;

    let index = 0;
    const chunkSize = 800; // Parse 800 satellites per frame
    const tempSatrecs: (SatrecEntry | null)[] = [];
    let animationFrameId: number;

    const parseChunk = () => {
      const end = Math.min(index + chunkSize, satellites.length);
      for (let i = index; i < end; i++) {
        const s = satellites[i];
        try {
          tempSatrecs.push({
            id: s.i,
            name: s.n,
            satrec: satellite.twoline2satrec(s['1'], s['2']),
            raw: s,
          });
        } catch {
          tempSatrecs.push(null);
        }
      }

      setSatrecs([...tempSatrecs]);
      index = end;

      if (index < satellites.length) {
        animationFrameId = requestAnimationFrame(parseChunk);
      }
    };

    animationFrameId = requestAnimationFrame(parseChunk);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [satellites]);

  // Handle cloud layer toggle
  useEffect(() => {
    if (cloudMeshRef.current) {
      cloudMeshRef.current.visible = showClouds;
    }
  }, [showClouds]);

  // Handle selected orbit and selection marker toggle
  useEffect(() => {
    if (selectedOrbitLineRef.current) {
      selectedOrbitLineRef.current.visible = showOrbit && !!selectedSat;
    }
    if (selectionMarkerRef.current) {
      selectionMarkerRef.current.visible = !!selectedSat;
    }
  }, [showOrbit, selectedSat]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || satellites.length === 0) return;

    // --- 1. Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03030f, 0.0015);

    // --- 2. Camera Setup ---
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 10, 18);

    // --- 3. Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    // --- 4. Controls Setup ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 50;
    controls.minDistance = 6.5;

    // --- 5. Starfield Background ---
    const starCount = 1200;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 150 + Math.random() * 150;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = radius * Math.cos(phi);

      starColors[i] = 0.8 + Math.random() * 0.2;
      starColors[i + 1] = 0.85 + Math.random() * 0.15;
      starColors[i + 2] = 0.9 + Math.random() * 0.1;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const starfield = new THREE.Points(starGeometry, starMaterial);
    scene.add(starfield);

    // --- 6. Earth Mesh Setup ---
    const textureLoader = new THREE.TextureLoader();
    const earthDayTex = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
    const earthBumpTex = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');
    const earthSpecularTex = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-water.png');

    const earthGeometry = new THREE.SphereGeometry(GLOBE_RADIUS_THREE, 32, 32);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthDayTex,
      bumpMap: earthBumpTex,
      bumpScale: 0.15,
      specularMap: earthSpecularTex,
      specular: new THREE.Color(0x333344),
      shininess: 25,
    });

    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earthMesh);

    // --- 7. Cloud Layer ---
    const cloudGeometry = new THREE.SphereGeometry(GLOBE_RADIUS_THREE + 0.05, 32, 32);
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.NormalBlending,
    });

    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.visible = stateRef.current.showClouds;
    scene.add(cloudMesh);
    cloudMeshRef.current = cloudMesh;

    // --- 8. Atmosphere Glow ---
    const vertexShader = `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.5);
        gl_FragColor = vec4(0.3, 0.65, 1.0, 1.0) * intensity;
      }
    `;

    const atmosphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS_THREE + 0.12, 32, 32);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });

    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // --- 9. Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.35);
    sunLight.position.set(12, 5, 15);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x3a5fcd, 0.5);
    fillLight.position.set(-12, -2, -15);
    scene.add(fillLight);

    // --- 10. Satellite Point Cloud Setup ---
    const satCount = satellites.length;
    const pointsGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(satCount * 3);
    const colors = new Float32Array(satCount * 3);
    const sizes = new Float32Array(satCount);

    // Initially position at 0,0,0
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom shader material for points to draw circular glowing dots and allow dynamic sizing per-point
    const pointVertexShader = `
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const pointFragmentShader = `
      varying vec3 vColor;
      void main() {
        // Draw circular anti-aliased dot
        float r = 0.0, delta = 0.0, dist = 0.5;
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        r = dot(cxy, cxy);
        if (r > 1.0) {
          discard;
        }
        float alpha = 1.0 - smoothstep(0.7, 1.0, r);
        gl_FragColor = vec4(vColor, alpha * 0.95);
      }
    `;

    const pointsMaterial = new THREE.ShaderMaterial({
      vertexShader: pointVertexShader,
      fragmentShader: pointFragmentShader,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    pointsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const pointCloud = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(pointCloud);
    pointsRef.current = pointCloud;

    // --- 11. Orbit Path for Selected Satellite (Line2 for bold rendering) ---
    const orbitLineGeometry = new LineGeometry();
    const orbitLineMaterial = new LineMaterial({
      color: 0x00ff66,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
      worldUnits: false,
    });
    orbitLineMaterial.resolution.set(container.clientWidth, container.clientHeight);
    const selectedOrbitLine = new Line2(orbitLineGeometry, orbitLineMaterial);
    selectedOrbitLine.visible = false;
    scene.add(selectedOrbitLine);
    selectedOrbitLineRef.current = selectedOrbitLine;

    // Pulse ring marker for selection
    const markerGeom = new THREE.RingGeometry(0.18, 0.25, 16);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const selectionMarker = new THREE.Mesh(markerGeom, markerMat);
    selectionMarker.visible = false;
    scene.add(selectionMarker);
    selectionMarkerRef.current = selectionMarker;

    // --- 12. Clock & Dynamic Propagation Loop ---
    let animationFrameId: number;
    let lastPropagationTime = 0;
    let lastSelectedSatId: string | null = null;
    let lastSearchQuery = '';
    let lastOrbitCalcTime = 0;
    let sliceOffset = 0;
    
    // In-memory simulation date tracking
    let simTimeMs = Date.now();
    let realTimeLast = performance.now();

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      // Cloud rotation
      if (cloudMesh) {
        cloudMesh.rotation.y += 0.00028;
      }

      const state = stateRef.current;
      const selectedSatId = state.selectedSat ? state.selectedSat.i : null;
      const selectionChanged = selectedSatId !== lastSelectedSatId;
      lastSelectedSatId = selectedSatId;

      if (selectionMarker && !state.selectedSat) {
        selectionMarker.visible = false;
      }

      const nowReal = performance.now();
      const dt = nowReal - realTimeLast;
      realTimeLast = nowReal;

      // Update simulation time clock
      if (!state.isPaused) {
        if (state.speedMultiplier === 1) {
          simTimeMs = Date.now();
        } else {
          simTimeMs += dt * state.speedMultiplier;
        }
      }
      const simDate = new Date(simTimeMs);

      // Throttled propagation loop: update coordinates in slices to maintain 60 FPS
      const positionAttr = pointsGeometry.getAttribute('position') as THREE.BufferAttribute;
      const colorAttr = pointsGeometry.getAttribute('color') as THREE.BufferAttribute;
      const sizeAttr = pointsGeometry.getAttribute('size') as THREE.BufferAttribute;
      const posArray = positionAttr.array as Float32Array;
      const colArray = colorAttr.array as Float32Array;
      const sizeArray = sizeAttr.array as Float32Array;

      const numSats = state.satellites.length;
      if (numSats > 0) {
        const queryUpper = state.searchQuery.toUpperCase();
        const queryChanged = state.searchQuery !== lastSearchQuery;
        lastSearchQuery = state.searchQuery;

        const currentSatrecs = state.satrecs;
        let needsAttributeUpdate = false;

        // A. If search query or selection changed, instantly re-evaluate colors/sizes for responsiveness (no SGP4 propagation math)
        if (queryChanged || selectionChanged) {
          for (let idx = 0; idx < numSats; idx++) {
            const entry = currentSatrecs[idx];
            if (!entry) continue;

            const i3 = idx * 3;
            const isSelected = state.selectedSat && state.selectedSat.i === entry.id;
            const matchesSearch = queryUpper ? entry.name.toUpperCase().includes(queryUpper) || entry.id.includes(queryUpper) : true;

            if (isSelected) {
              colArray[i3] = 1.0;
              colArray[i3 + 1] = 0.0;
              colArray[i3 + 2] = 0.5;
              sizeArray[idx] = 0.2;
            } else if (queryUpper) {
              if (matchesSearch) {
                colArray[i3] = 0.0;
                colArray[i3 + 1] = 0.95;
                colArray[i3 + 2] = 1.0;
                sizeArray[idx] = 0.2;
              } else {
                colArray[i3] = 0.12;
                colArray[i3 + 1] = 0.12;
                colArray[i3 + 2] = 0.2;
                sizeArray[idx] = 0.1;
              }
            } else {
              // Restore altitude-based colors
              const x = posArray[i3];
              const y = posArray[i3 + 1];
              const z = posArray[i3 + 2];
              const dist = Math.sqrt(x * x + y * y + z * z);
              const alt = ((dist / GLOBE_RADIUS_THREE) - 1) * EARTH_RADIUS_KM;

              if (alt < 2000) {
                colArray[i3] = 0.0;
                colArray[i3 + 1] = 0.9;
                colArray[i3 + 2] = 1.0;
              } else if (alt < 20000) {
                colArray[i3] = 0.2;
                colArray[i3 + 1] = 0.5;
                colArray[i3 + 2] = 1.0;
              } else {
                colArray[i3] = 1.0;
                colArray[i3 + 1] = 0.6;
                colArray[i3 + 2] = 0.1;
              }
              sizeArray[idx] = 0.2;
            }
          }
          needsAttributeUpdate = true;
        }

        // B. Run propagation for the current slice of satellites (slice size: ~1/15th of satellites per frame)
        // This spreads the heavy SGP4 CPU computation over 15 frames (~250ms), keeping rendering at 60 FPS
        const sliceSize = Math.ceil(numSats / 15);
        const sliceEnd = Math.min(sliceOffset + sliceSize, numSats);

        for (let idx = sliceOffset; idx < sliceEnd; idx++) {
          const entry = currentSatrecs[idx];
          const i3 = idx * 3;

          if (!entry) {
            if (posArray[i3] !== 0 || sizeArray[idx] !== 0) {
              posArray[i3] = 0;
              posArray[i3 + 1] = 0;
              posArray[i3 + 2] = 0;
              sizeArray[idx] = 0;
              needsAttributeUpdate = true;
            }
            continue;
          }

          const satrec = entry.satrec;
          const posVel = satellite.propagate(satrec, simDate);

          let vec = { x: 0, y: 0, z: 0 };
          let lat = 0, lng = 0, alt = 0;

          if (posVel && posVel.position && typeof posVel.position === 'object') {
            const positionEci = posVel.position;
            const gmst = satellite.gstime(simDate);
            const positionGc = satellite.eciToGeodetic(
              positionEci as satellite.EciVec3<number>,
              gmst
            );
            lat = satellite.degreesLat(positionGc.latitude);
            lng = satellite.degreesLong(positionGc.longitude);
            alt = positionGc.height;

            vec = latLngAltToVector3(lat, lng, alt);
          }

          posArray[i3] = vec.x;
          posArray[i3 + 1] = vec.y;
          posArray[i3 + 2] = vec.z;

          const isSelected = state.selectedSat && state.selectedSat.i === entry.id;
          const matchesSearch = queryUpper ? entry.name.toUpperCase().includes(queryUpper) || entry.id.includes(queryUpper) : true;

          if (isSelected) {
            colArray[i3] = 1.0;
            colArray[i3 + 1] = 0.0;
            colArray[i3 + 2] = 0.5;
            sizeArray[idx] = 0.2;
          } else if (queryUpper) {
            if (matchesSearch) {
              colArray[i3] = 0.0;
              colArray[i3 + 1] = 0.95;
              colArray[i3 + 2] = 1.0;
              sizeArray[idx] = 0.2;
            } else {
              colArray[i3] = 0.12;
              colArray[i3 + 1] = 0.12;
              colArray[i3 + 2] = 0.2;
              sizeArray[idx] = 0.1;
            }
          } else {
            if (alt < 2000) {
              colArray[i3] = 0.0;
              colArray[i3 + 1] = 0.9;
              colArray[i3 + 2] = 1.0;
            } else if (alt < 20000) {
              colArray[i3] = 0.2;
              colArray[i3 + 1] = 0.5;
              colArray[i3 + 2] = 1.0;
            } else {
              colArray[i3] = 1.0;
              colArray[i3 + 1] = 0.6;
              colArray[i3 + 2] = 0.1;
            }
            sizeArray[idx] = 0.2;
          }

          needsAttributeUpdate = true;
        }

        // Increment slice offset
        sliceOffset += sliceSize;
        if (sliceOffset >= numSats) {
          sliceOffset = 0;
        }

        // C. Always update the selected satellite's position, telemetry and marker *every frame* to ensure UI is perfectly real-time
        if (state.selectedSat) {
          const selectedIdx = state.satellites.findIndex(s => s.i === state.selectedSat?.i);
          if (selectedIdx !== -1) {
            const entry = currentSatrecs[selectedIdx];
            if (entry) {
              const i3 = selectedIdx * 3;
              const satrec = entry.satrec;
              const posVel = satellite.propagate(satrec, simDate);

              let vec = { x: 0, y: 0, z: 0 };
              let lat = 0, lng = 0, alt = 0;

              if (posVel && posVel.position && typeof posVel.position === 'object') {
                const positionEci = posVel.position;
                const gmst = satellite.gstime(simDate);
                const positionGc = satellite.eciToGeodetic(
                  positionEci as satellite.EciVec3<number>,
                  gmst
                );
                lat = satellite.degreesLat(positionGc.latitude);
                lng = satellite.degreesLong(positionGc.longitude);
                alt = positionGc.height;

                vec = latLngAltToVector3(lat, lng, alt);
              }

              posArray[i3] = vec.x;
              posArray[i3 + 1] = vec.y;
              posArray[i3 + 2] = vec.z;

              colArray[i3] = 1.0;
              colArray[i3 + 1] = 0.0;
              colArray[i3 + 2] = 0.5;
              sizeArray[selectedIdx] = 0.2;

              if (selectionMarker) {
                selectionMarker.position.set(vec.x, vec.y, vec.z);
                selectionMarker.lookAt(new THREE.Vector3(0, 0, 0));
                selectionMarker.visible = true;
              }

              if (posVel && posVel.velocity && typeof posVel.velocity === 'object') {
                const vx = (posVel.velocity as satellite.EciVec3<number>).x;
                const vy = (posVel.velocity as satellite.EciVec3<number>).y;
                const vz = (posVel.velocity as satellite.EciVec3<number>).z;
                const vel = Math.sqrt(vx * vx + vy * vy + vz * vz);

                // Throttle telemetry UI updates to avoid state bottleneck (once every 300ms)
                if (time - lastPropagationTime > 300 || lastPropagationTime === 0) {
                  setSatTelemetry({
                    name: entry.name,
                    id: entry.id,
                    lat,
                    lng,
                    alt,
                    vel,
                    timeString: simDate.toLocaleTimeString(),
                  });
                  lastPropagationTime = time;
                }
              }
              needsAttributeUpdate = true;
            }
          }
        }

        if (needsAttributeUpdate) {
          positionAttr.needsUpdate = true;
          colorAttr.needsUpdate = true;
          sizeAttr.needsUpdate = true;
          pointsGeometry.computeBoundingSphere();
        }

        // D. Render selected orbit path (throttled/cached to prevent continuous calculation)
        if (state.selectedSat && state.showOrbit) {
          const selectedSatEntry = state.satrecs.find(s => s?.id === state.selectedSat?.i);
          if (selectedSatEntry) {
            // Recalculate only if selection changed, or 10 seconds of sim time have passed, or user runs fast simulation (>100x)
            if (selectionChanged || Math.abs(simTimeMs - lastOrbitCalcTime) > 10000 || state.speedMultiplier > 100) {
              lastOrbitCalcTime = simTimeMs;

              const orbitalPeriodMin = (2 * Math.PI) / selectedSatEntry.satrec.no;
              const steps = 200;
              const stepMs = (orbitalPeriodMin * 60 * 1000) / steps;
              const positions: number[] = [];

              for (let k = 0; k <= steps; k++) {
                const oTime = new Date(simTimeMs + k * stepMs);
                const oPosVel = satellite.propagate(selectedSatEntry.satrec, oTime);
                if (oPosVel && oPosVel.position && typeof oPosVel.position === 'object') {
                  const oGmst = satellite.gstime(oTime);
                  const oGeodetic = satellite.eciToGeodetic(oPosVel.position as satellite.EciVec3<number>, oGmst);
                  const oLat = satellite.degreesLat(oGeodetic.latitude);
                  const oLng = satellite.degreesLong(oGeodetic.longitude);
                  const oAlt = oGeodetic.height;
                  const oVec = latLngAltToVector3(oLat, oLng, oAlt);
                  positions.push(oVec.x, oVec.y, oVec.z);
                }
              }

              if (positions.length >= 6) {
                orbitLineGeometry.setPositions(positions);
                selectedOrbitLine.computeLineDistances();
                selectedOrbitLine.visible = true;
              }
            }
          }
        } else {
          selectedOrbitLine.visible = false;
        }
      }

      // Marker animation (rotation + pulse size)
      if (selectionMarker.visible) {
        selectionMarker.rotateZ(0.015);
        const scaleVal = 1 + 0.15 * Math.sin(time / 180);
        selectionMarker.scale.set(scaleVal, scaleVal, 1);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate(0);

    // --- 13. Raycasting Interaction ---
    const raycaster = new THREE.Raycaster();
    // Allow checking a small radius around ray for easy mobile/desktop clicking
    raycaster.params.Points = { threshold: 0.12 };

    const mouse = new THREE.Vector2();

    const getMouseCoords = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleMouseMove = (e: MouseEvent) => {
      getMouseCoords(e);
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(pointCloud);

      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      if (intersects.length > 0) {
        const idx = intersects[0].index;
        const currentSatrecs = stateRef.current.satrecs;
        if (idx !== undefined && currentSatrecs[idx]) {
          const entry = currentSatrecs[idx];
          if (entry) {
            tooltip.style.display = 'block';
            tooltip.style.left = `${e.clientX + 15}px`;
            tooltip.style.top = `${e.clientY + 15}px`;
            tooltip.innerText = `${entry.name} [ID: ${entry.id}]`;
            document.body.style.cursor = 'pointer';
            return;
          }
        }
      }
      
      tooltip.style.display = 'none';
      document.body.style.cursor = 'default';
    };

    const handleMouseClick = (e: MouseEvent) => {
      getMouseCoords(e);
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(pointCloud);

      if (intersects.length > 0) {
        const idx = intersects[0].index;
        const currentSatrecs = stateRef.current.satrecs;
        if (idx !== undefined && currentSatrecs[idx]) {
          const entry = currentSatrecs[idx];
          if (entry) {
            setSelectedSat(entry.raw);
            return;
          }
        }
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleMouseClick);

    // --- 14. Resize Handler ---
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      orbitLineMaterial.resolution.set(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleMouseClick);

      starGeometry.dispose();
      starMaterial.dispose();
      earthGeometry.dispose();
      earthMaterial.dispose();
      cloudGeometry.dispose();
      cloudMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      orbitLineMaterial.dispose();
      orbitLineGeometry.dispose();
      markerGeom.dispose();
      markerMat.dispose();

      earthDayTex.dispose();
      earthBumpTex.dispose();
      earthSpecularTex.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [satellites]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
      {/* Dynamic Propagation Progress Bar */}
      {satrecs.length < satellites.length && (
        <div style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(2, 6, 23, 0.85)',
          border: '1px solid rgba(0, 242, 254, 0.3)',
          color: '#00f2fe',
          padding: '6px 16px',
          borderRadius: '20px',
          fontSize: '10px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 20px rgba(0, 242, 254, 0.15)',
        }} className="tech-font">
          <span className="animate-pulse" style={{ color: '#00f2fe' }}>●</span>
          PROPAGATING CONSTELLATION: {Math.round((satrecs.length / satellites.length) * 100)}% ({satrecs.length}/{satellites.length})
        </div>
      )}

      {/* 3D Container Canvas */}
      <div ref={containerRef} className="canvas-container" style={{ width: '100%', height: '100%', minHeight: '500px' }} />

      {/* Floating Hover Tooltip */}
      <div
        ref={tooltipRef}
        className="tech-font"
        style={{
          position: 'fixed',
          display: 'none',
          background: 'rgba(2, 6, 23, 0.9)',
          border: '1px solid #00f2fe',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: '11px',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 0 15px rgba(0, 242, 254, 0.3)',
        }}
      />

      {/* Floating Selection Telemetry Overlay Drawer */}
      {selectedSat && satTelemetry && (
        <div
          className="glass-panel interactive-ui"
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            width: '320px',
            zIndex: 100,
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 0, 127, 0.4)',
            boxShadow: '0 0 30px rgba(255, 0, 127, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="tech-font text-pink-500 font-bold tracking-wider text-xs uppercase">
              SELECTED TARGET
            </h3>
            <button
              onClick={() => { setSelectedSat(null); setSatTelemetry(null); }}
              className="btn-tech text-[9px] px-2 py-0.5"
              style={{ borderColor: 'rgba(255, 0, 127, 0.3)' }}
            >
              CLEAR
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <span className="text-[10px] text-secondary uppercase block">NAME</span>
              <span className="mono-font text-white text-sm font-semibold">{satTelemetry.name}</span>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <span className="text-[10px] text-secondary uppercase block">NORAD ID</span>
                <span className="mono-font text-cyan-400 text-xs font-semibold">{satTelemetry.id}</span>
              </div>
              <div style={{ flex: 1 }}>
                <span className="text-[10px] text-secondary uppercase block">VELOCITY</span>
                <span className="mono-font text-cyan-400 text-xs font-semibold">{(satTelemetry.vel).toFixed(2)} km/s</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <span className="text-[10px] text-secondary uppercase block">LATITUDE</span>
                <span className="mono-font text-white text-xs">{(satTelemetry.lat).toFixed(4)}°</span>
              </div>
              <div style={{ flex: 1 }}>
                <span className="text-[10px] text-secondary uppercase block">LONGITUDE</span>
                <span className="mono-font text-white text-xs">{(satTelemetry.lng).toFixed(4)}°</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-secondary uppercase block">ALTITUDE</span>
              <span className="mono-font text-white text-xs">{(satTelemetry.alt).toFixed(1)} km</span>
            </div>
            <a
              href={`/track?norad-id=${satTelemetry.id}`}
              className="btn-tech text-center text-[10px] py-1.5 flex items-center justify-center gap-1 font-bold mt-2"
              style={{ width: '100%', borderColor: '#ff007f', color: '#ff007f' }}
            >
              ZOOM DETAILED TRACKER <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Local Controls Overlay Panel */}
      <div
        className="map-controls-panel interactive-ui"
        style={{
          position: 'absolute',
          right: '24px',
          bottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 100,
        }}
      >
        {/* Toggle Orbit Track */}
        {selectedSat && (
          <button
            onClick={() => setShowOrbit(!showOrbit)}
            className={`btn-tech ${showOrbit ? 'btn-tech-active' : ''}`}
            title="Toggles orbital line visibility"
          >
            <Radio className="w-4 h-4" />
            ORBIT {showOrbit ? 'ON' : 'OFF'}
          </button>
        )}

        {/* Toggle Clouds */}
        <button
          onClick={() => setShowClouds(!showClouds)}
          className={`btn-tech ${showClouds ? 'btn-tech-active' : ''}`}
          title="Toggles atmosphere/cloud layer"
        >
          {showClouds ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          CLOUDS {showClouds ? 'ON' : 'OFF'}
        </button>

        {/* Play/Pause */}
        <div style={{ display: 'flex', background: 'rgba(2, 6, 23, 0.85)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', gap: '4px' }}>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="btn-tech px-2 py-1"
            style={{ minWidth: '32px' }}
          >
            {isPaused ? <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" /> : <Pause className="w-3 h-3 text-cyan-400 fill-cyan-400" />}
          </button>
          <button
            onClick={() => setSpeedMultiplier(1)}
            className={`btn-tech text-[10px] px-2 ${speedMultiplier === 1 ? 'btn-tech-active' : ''}`}
          >
            1x
          </button>
          <button
            onClick={() => setSpeedMultiplier(100)}
            className={`btn-tech text-[10px] px-2 ${speedMultiplier === 100 ? 'btn-tech-active' : ''}`}
          >
            100x
          </button>
          <button
            onClick={() => setSpeedMultiplier(500)}
            className={`btn-tech text-[10px] px-2 ${speedMultiplier === 500 ? 'btn-tech-active' : ''}`}
          >
            500x
          </button>
        </div>
      </div>

      {/* Floating Top Search Filter */}
      <div
        className="interactive-ui"
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          width: '320px',
          zIndex: 100,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(2, 6, 23, 0.85)',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            borderRadius: '8px',
            padding: '2px 8px 2px 36px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <Search
            className="w-4 h-4 text-cyan-400"
            style={{ position: 'absolute', left: '12px', opacity: 0.8 }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 6,000+ satellites by name/ID..."
            className="mono-font text-white"
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              outline: 'none',
              padding: '6px 0',
              fontSize: '11px',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[9px] uppercase tech-font text-secondary hover:text-cyan-400"
              style={{ cursor: 'pointer' }}
            >
              CLEAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
