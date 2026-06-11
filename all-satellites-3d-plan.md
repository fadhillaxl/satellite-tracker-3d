# All Satellites 3D Feature

## Goal
Implement a performant 3D Globe page at `/all` visualizing all active satellites (6,000+ objects) in real-time using Three.js Point Cloud (THREE.Points) and server-side cached TLE data.

## Tasks
- [ ] Task 1: Create API route `/api/satellites/route.ts` to fetch `active.txt` from Celestrak, cache it for 4 hours on the server, parse it, and return a lightweight JSON list. → Verify: `curl http://localhost:3000/api/satellites` returns 200 and a JSON list of satellites with TLEs.
- [ ] Task 2: Create a page at `app/all/page.tsx` for the multi-satellite visualizer dashboard. → Verify: Accessing `/all` in the browser renders the page layout.
- [ ] Task 3: Build a custom 3D point cloud component `components/GlobeAll3D.tsx` using `THREE.Points` to render thousands of satellites in a single draw call. → Verify: Component mounts and shows the Earth surrounded by a point cloud of thousands of dots.
- [ ] Task 4: Implement SGP4 propagation for all satellites inside a Web Worker or an optimized chunked animation loop to keep CPU usage low. → Verify: Satellites move on their orbital trajectories at 60 FPS.
- [ ] Task 5: Add a Three.js Raycaster to detect when the user clicks or hovers on a satellite point, highlighting it and showing its telemetry in a floating card. → Verify: Clicking a satellite dot opens an info panel with live speed, altitude, and name.
- [ ] Task 6: Add a search bar to filter/highlight matching satellites in the point cloud. → Verify: Typing "ISS" highlights the space station in the 3D view.

## Done When
- [ ] Users can navigate to `/all` and interact with a interactive 3D globe showing 6,000+ active satellites.
- [ ] Frame rate remains stable at 60 FPS during orbit propagation and interaction.
- [ ] Clicking any satellite displays its live name and telemetry.

## Notes
- We use `THREE.Points` to ensure a single WebGL draw call, avoiding CPU/GPU rendering bottleneck.
- Web Worker will offload the SGP4 propagation math from the React main thread to keep UI interaction responsive.
