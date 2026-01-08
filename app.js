// ===== Import fal client =====
import { fal } from "https://esm.sh/@fal-ai/client@1.2.1";

// ===== Configuration =====
const CONFIG = {
    FAL_MODEL_ID: 'fal-ai/qwen-image-edit-2511-multiple-angles',
    MAX_SEED: 2147483647
};

// ===== Camera Angle Labels (for UI display only) =====
// Based on fal.ai API documentation

// horizontal_angle: 0-360 (0=front, 90=right, 180=back, 270=left)
function getAzimuthLabel(deg) {
    deg = ((deg % 360) + 360) % 360;
    if (deg <= 22.5 || deg > 337.5) return 'Front';
    if (deg <= 67.5) return 'Front-Right';
    if (deg <= 112.5) return 'Right';
    if (deg <= 157.5) return 'Back-Right';
    if (deg <= 202.5) return 'Back';
    if (deg <= 247.5) return 'Back-Left';
    if (deg <= 292.5) return 'Left';
    return 'Front-Left';
}

// ===== State =====
let state = {
    azimuth: 0,       // horizontal_angle: 0-360 (0=front, 90=right, 180=back, 270=left)
    elevation: 0,     // vertical_angle: -30 to 90 (-30=low-angle, 0=eye-level, 30=elevated, 60=high-angle, 90=bird's-eye)
    distance: 5,      // zoom: 0-10 (0=far/wide, 5=medium, 10=close-up)
    uploadedImage: null,
    uploadedImageBase64: null,
    imageUrl: null,   // Direct URL (no upload needed)
    isGenerating: false
};

// ===== DOM Elements =====
const elements = {};

// ===== Utility Functions =====
function snapToNearest(value, options) {
    return options.reduce((prev, curr) => 
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
}


function updatePromptDisplay() {
    // Show the numeric parameters that will be sent to the API
    const azLabel = getAzimuthLabel(state.azimuth);
    const elLabel = getElevationLabelFromAngle(state.elevation);
    const zoomLabel = getZoomLabel(state.distance);
    
    elements.promptDisplay.innerHTML = `
        <div class="param-display">
            <span class="param-name">horizontal_angle:</span> <span class="param-value">${state.azimuth}°</span> <span class="param-label">(${azLabel})</span>
        </div>
        <div class="param-display">
            <span class="param-name">vertical_angle:</span> <span class="param-value">${state.elevation}°</span> <span class="param-label">(${elLabel})</span>
        </div>
        <div class="param-display">
            <span class="param-name">zoom:</span> <span class="param-value">${state.distance}</span> <span class="param-label">(${zoomLabel})</span>
        </div>
    `;
}

// Get elevation label from actual angle (-30 to 90)
function getElevationLabelFromAngle(deg) {
    if (deg <= -15) return 'Low-angle (looking up)';
    if (deg <= 15) return 'Eye-level';
    if (deg <= 45) return 'Elevated';
    if (deg <= 75) return 'High-angle';
    return 'Bird\'s-eye (looking down)';
}

// Get zoom label (0-10)
function getZoomLabel(val) {
    if (val <= 2) return 'Wide shot (far)';
    if (val <= 4) return 'Medium-wide';
    if (val <= 6) return 'Medium shot';
    if (val <= 8) return 'Medium close-up';
    return 'Close-up (very close)';
}

function updateSliderValues() {
    elements.azimuthValue.textContent = `${Math.round(state.azimuth)}°`;
    elements.elevationValue.textContent = `${Math.round(state.elevation)}°`;
    elements.distanceValue.textContent = state.distance.toFixed(1);
}

function updateGenerateButton() {
    const hasImage = state.uploadedImage !== null || state.imageUrl !== null;
    const hasApiKey = elements.apiKey.value.trim().length > 0;
    elements.generateBtn.disabled = !hasImage || !hasApiKey || state.isGenerating;
}

function showStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
    elements.statusMessage.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(() => {
            elements.statusMessage.classList.add('hidden');
        }, 5000);
    }
}

function hideStatus() {
    elements.statusMessage.classList.add('hidden');
}

// ===== Logging System =====
function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function addLog(message, type = 'info') {
    if (!elements.logsContainer) return;
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const timestamp = document.createElement('span');
    timestamp.className = 'log-timestamp';
    timestamp.textContent = `[${getTimestamp()}]`;
    
    entry.appendChild(timestamp);
    
    // Handle objects
    let messageText = message;
    if (typeof message === 'object') {
        try {
            messageText = JSON.stringify(message, null, 2);
        } catch (e) {
            messageText = String(message);
        }
    }
    
    entry.appendChild(document.createTextNode(messageText));
    elements.logsContainer.appendChild(entry);
    
    // Auto-scroll to bottom
    elements.logsContainer.scrollTop = elements.logsContainer.scrollHeight;
}

function clearLogs() {
    if (elements.logsContainer) {
        elements.logsContainer.innerHTML = '<div class="log-entry info">Logs cleared.</div>';
    }
}

function formatError(error) {
    if (!error) return 'Unknown error';
    
    if (typeof error === 'string') return error;
    
    // Handle Error instances
    if (error instanceof Error) {
        return error.message || error.toString();
    }
    
    if (typeof error === 'object') {
        // Try common API error properties (fal.ai specific)
        if (error.detail) {
            if (typeof error.detail === 'string') return error.detail;
            if (Array.isArray(error.detail)) {
                return error.detail.map(d => d.msg || d.message || JSON.stringify(d)).join(', ');
            }
            if (typeof error.detail === 'object') {
                return error.detail.message || error.detail.msg || JSON.stringify(error.detail);
            }
        }
        if (error.message) return error.message;
        if (error.msg) return error.msg;
        if (error.error) {
            if (typeof error.error === 'string') return error.error;
            if (error.error.message) return error.error.message;
            return JSON.stringify(error.error);
        }
        if (error.statusText) return error.statusText;
        
        // Fallback to JSON
        try {
            const jsonStr = JSON.stringify(error, null, 2);
            // Don't return [object Object]
            if (jsonStr === '{}') return 'Empty error response';
            return jsonStr;
        } catch (e) {
            return 'Error: Unable to parse error details';
        }
    }
    
    return String(error);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== Three.js Scene Setup =====
let threeScene = null;

function initThreeJS() {
    const container = elements.threejsContainer;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Scene with gradient-like background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    
    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(4, 3.5, 4);
    camera.lookAt(0, 0.3, 0);
    
    // Renderer with better settings
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    // Lighting - more dramatic
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 10, 5);
    scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0xE93D82, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
    
    // Stylish grid
    const gridHelper = new THREE.GridHelper(5, 20, 0x1a1a2e, 0x12121a);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);
    
    // Constants
    const CENTER = new THREE.Vector3(0, 0.5, 0);
    const AZIMUTH_RADIUS = 1.8;
    const ELEVATION_RADIUS = 1.4;
    
    // Live values
    let liveAzimuth = state.azimuth;
    let liveElevation = state.elevation;
    let liveDistance = state.distance;
    
    // ===== Subject (Image Plane) =====
    const planeGeo = new THREE.PlaneGeometry(0.9, 0.9);
    const planeMat = new THREE.MeshBasicMaterial({ 
        color: 0x1a1a2e,
        side: THREE.DoubleSide
    });
    const imagePlane = new THREE.Mesh(planeGeo, planeMat);
    imagePlane.position.copy(CENTER);
    scene.add(imagePlane);
    
    // Glow ring around subject
    const glowRingGeo = new THREE.RingGeometry(0.5, 0.52, 64);
    const glowRingMat = new THREE.MeshBasicMaterial({ 
        color: 0xE93D82, 
        transparent: true, 
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
    glowRing.position.copy(CENTER);
    glowRing.position.z += 0.01;
    scene.add(glowRing);
    
    // ===== Camera Indicator - Stylish pyramid =====
    const camGeo = new THREE.ConeGeometry(0.15, 0.4, 4);
    const camMat = new THREE.MeshStandardMaterial({ 
        color: 0xE93D82,
        emissive: 0xE93D82,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2
    });
    const cameraIndicator = new THREE.Mesh(camGeo, camMat);
    scene.add(cameraIndicator);
    
    // Camera glow sphere
    const camGlowGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const camGlowMat = new THREE.MeshBasicMaterial({ 
        color: 0xff6ba8,
        transparent: true,
        opacity: 0.8
    });
    const camGlow = new THREE.Mesh(camGlowGeo, camGlowMat);
    scene.add(camGlow);
    
    // ===== Azimuth Ring - Thick and bright =====
    const azRingGeo = new THREE.TorusGeometry(AZIMUTH_RADIUS, 0.04, 16, 100);
    const azRingMat = new THREE.MeshBasicMaterial({ 
        color: 0xE93D82,
        transparent: true,
        opacity: 0.7
    });
    const azimuthRing = new THREE.Mesh(azRingGeo, azRingMat);
    azimuthRing.rotation.x = Math.PI / 2;
    azimuthRing.position.y = 0.02;
    scene.add(azimuthRing);
    
    // Azimuth handle - Glowing orb
    const azHandleGeo = new THREE.SphereGeometry(0.16, 32, 32);
    const azHandleMat = new THREE.MeshStandardMaterial({ 
        color: 0xE93D82,
        emissive: 0xE93D82,
        emissiveIntensity: 0.6,
        metalness: 0.3,
        roughness: 0.4
    });
    const azimuthHandle = new THREE.Mesh(azHandleGeo, azHandleMat);
    scene.add(azimuthHandle);
    
    // Azimuth handle outer glow
    const azGlowGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const azGlowMat = new THREE.MeshBasicMaterial({ 
        color: 0xE93D82,
        transparent: true,
        opacity: 0.2
    });
    const azGlow = new THREE.Mesh(azGlowGeo, azGlowMat);
    scene.add(azGlow);
    
    // ===== Elevation Arc - Thick and bright =====
    const elArcGeo = new THREE.TorusGeometry(ELEVATION_RADIUS, 0.04, 16, 50, Math.PI / 2);
    const elArcMat = new THREE.MeshBasicMaterial({ 
        color: 0x00FFD0,
        transparent: true,
        opacity: 0.7
    });
    const elevationArc = new THREE.Mesh(elArcGeo, elArcMat);
    scene.add(elevationArc);
    
    // Elevation handle - Glowing orb
    const elHandleGeo = new THREE.SphereGeometry(0.16, 32, 32);
    const elHandleMat = new THREE.MeshStandardMaterial({ 
        color: 0x00FFD0,
        emissive: 0x00FFD0,
        emissiveIntensity: 0.6,
        metalness: 0.3,
        roughness: 0.4
    });
    const elevationHandle = new THREE.Mesh(elHandleGeo, elHandleMat);
    scene.add(elevationHandle);
    
    // Elevation handle outer glow
    const elGlowGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const elGlowMat = new THREE.MeshBasicMaterial({ 
        color: 0x00FFD0,
        transparent: true,
        opacity: 0.2
    });
    const elGlow = new THREE.Mesh(elGlowGeo, elGlowMat);
    scene.add(elGlow);
    
    // ===== Distance Handle - Golden orb =====
    const distHandleGeo = new THREE.SphereGeometry(0.13, 32, 32);
    const distHandleMat = new THREE.MeshStandardMaterial({ 
        color: 0xFFB800,
        emissive: 0xFFB800,
        emissiveIntensity: 0.5,
        metalness: 0.5,
        roughness: 0.3
    });
    const distanceHandle = new THREE.Mesh(distHandleGeo, distHandleMat);
    scene.add(distanceHandle);
    
    // Distance line - Thick glowing line (using tube)
    let distanceTube = null;
    function updateDistanceLine(start, end) {
        if (distanceTube) scene.remove(distanceTube);
        const path = new THREE.LineCurve3(start, end);
        const tubeGeo = new THREE.TubeGeometry(path, 1, 0.025, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({ 
            color: 0xFFB800,
            transparent: true,
            opacity: 0.8
        });
        distanceTube = new THREE.Mesh(tubeGeo, tubeMat);
        scene.add(distanceTube);
    }
    
    // ===== Update Visual Positions =====
    function updateVisuals() {
        const azRad = (liveAzimuth * Math.PI) / 180;
        const elRad = (liveElevation * Math.PI) / 180;
        // Zoom: 0=wide (far), 10=close-up (near) - invert for visual representation
        // Higher zoom = camera closer to subject visually
        const visualDist = 2.3 - (liveDistance / 10) * 1.5;
        
        // Camera indicator
        const camX = visualDist * Math.sin(azRad) * Math.cos(elRad);
        const camY = CENTER.y + visualDist * Math.sin(elRad);
        const camZ = visualDist * Math.cos(azRad) * Math.cos(elRad);
        
        cameraIndicator.position.set(camX, camY, camZ);
        cameraIndicator.lookAt(CENTER);
        cameraIndicator.rotateX(Math.PI / 2);
        
        camGlow.position.copy(cameraIndicator.position);
        
        // Azimuth handle
        const azX = AZIMUTH_RADIUS * Math.sin(azRad);
        const azZ = AZIMUTH_RADIUS * Math.cos(azRad);
        azimuthHandle.position.set(azX, 0.16, azZ);
        azGlow.position.copy(azimuthHandle.position);
        
        // Elevation arc - rotates with azimuth, starts from ground
        elevationArc.position.copy(CENTER);
        elevationArc.rotation.set(-Math.PI / 2, 0, -azRad + Math.PI / 2);
        
        // Elevation handle - on the arc
        const elX = CENTER.x + ELEVATION_RADIUS * Math.sin(azRad) * Math.cos(elRad);
        const elY = CENTER.y + ELEVATION_RADIUS * Math.sin(elRad);
        const elZ = CENTER.z + ELEVATION_RADIUS * Math.cos(azRad) * Math.cos(elRad);
        elevationHandle.position.set(elX, elY, elZ);
        elGlow.position.copy(elevationHandle.position);
        
        // Distance handle - between center and camera indicator
        // Higher zoom = handle farther out (toward camera), lower zoom = handle closer to center
        const distT = 0.3 + (liveDistance / 10) * 0.4;
        distanceHandle.position.lerpVectors(CENTER, cameraIndicator.position, distT);
        
        // Distance line
        updateDistanceLine(CENTER.clone(), cameraIndicator.position.clone());
        
        // Animate glow ring
        glowRing.rotation.z += 0.002;
    }
    
    updateVisuals();
    
    // ===== Raycaster for Interaction =====
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let dragTarget = null;
    let hoveredHandle = null;
    
    function getMousePos(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    function setHandleScale(handle, glow, scale) {
        handle.scale.setScalar(scale);
        if (glow) glow.scale.setScalar(scale);
    }
    
    function onPointerDown(event) {
        getMousePos(event);
        raycaster.setFromCamera(mouse, camera);
        
        const handles = [
            { mesh: azimuthHandle, glow: azGlow, name: 'azimuth' },
            { mesh: elevationHandle, glow: elGlow, name: 'elevation' },
            { mesh: distanceHandle, glow: null, name: 'distance' }
        ];
        
        for (const h of handles) {
            if (raycaster.intersectObject(h.mesh).length > 0) {
                isDragging = true;
                dragTarget = h.name;
                setHandleScale(h.mesh, h.glow, 1.3);
                renderer.domElement.style.cursor = 'grabbing';
                return;
            }
        }
    }
    
    function onPointerMove(event) {
        getMousePos(event);
        raycaster.setFromCamera(mouse, camera);
        
        if (!isDragging) {
            // Hover effects
            const handles = [
                { mesh: azimuthHandle, glow: azGlow, name: 'azimuth' },
                { mesh: elevationHandle, glow: elGlow, name: 'elevation' },
                { mesh: distanceHandle, glow: null, name: 'distance' }
            ];
            
            let foundHover = null;
            for (const h of handles) {
                if (raycaster.intersectObject(h.mesh).length > 0) {
                    foundHover = h;
                    break;
                }
            }
            
            // Reset previous hover
            if (hoveredHandle && hoveredHandle !== foundHover) {
                setHandleScale(hoveredHandle.mesh, hoveredHandle.glow, 1.0);
            }
            
            if (foundHover) {
                setHandleScale(foundHover.mesh, foundHover.glow, 1.15);
                renderer.domElement.style.cursor = 'grab';
                hoveredHandle = foundHover;
            } else {
                renderer.domElement.style.cursor = 'default';
                hoveredHandle = null;
            }
            return;
        }
        
        // Dragging logic
        const plane = new THREE.Plane();
        const intersect = new THREE.Vector3();
        
        if (dragTarget === 'azimuth') {
            plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));
            if (raycaster.ray.intersectPlane(plane, intersect)) {
                let angle = Math.atan2(intersect.x, intersect.z) * (180 / Math.PI);
                if (angle < 0) angle += 360;
                liveAzimuth = Math.max(0, Math.min(360, angle));
                state.azimuth = Math.round(liveAzimuth);
                elements.azimuthSlider.value = state.azimuth;
                updateSliderValues();
                updatePromptDisplay();
                updateVisuals();
            }
        } else if (dragTarget === 'elevation') {
            const azRad = (liveAzimuth * Math.PI) / 180;
            const normal = new THREE.Vector3(-Math.cos(azRad), 0, Math.sin(azRad));
            plane.setFromNormalAndCoplanarPoint(normal, CENTER);
            if (raycaster.ray.intersectPlane(plane, intersect)) {
                const dy = intersect.y - CENTER.y;
                const dxz = Math.sqrt((intersect.x - CENTER.x) ** 2 + (intersect.z - CENTER.z) ** 2);
                let angle = Math.atan2(dy, dxz) * (180 / Math.PI);
                // vertical_angle: -30 to 90 per fal.ai API
                angle = Math.max(-30, Math.min(90, angle));
                liveElevation = angle;
                state.elevation = Math.round(liveElevation);
                elements.elevationSlider.value = state.elevation;
                updateSliderValues();
                updatePromptDisplay();
                updateVisuals();
            }
        } else if (dragTarget === 'distance') {
            // Map mouse Y to zoom (0-10) per fal.ai API
            // Dragging outward/up = wider shot (lower zoom)
            // Dragging inward/down = closer shot (higher zoom)
            const newDist = 5 - mouse.y * 5;
            liveDistance = Math.max(0, Math.min(10, newDist));
            state.distance = Math.round(liveDistance * 10) / 10; // Round to 1 decimal
            elements.distanceSlider.value = state.distance;
            updateSliderValues();
            updatePromptDisplay();
            updateVisuals();
        }
    }
    
    function onPointerUp() {
        if (isDragging) {
            // Reset handle scale
            const handles = [
                { mesh: azimuthHandle, glow: azGlow },
                { mesh: elevationHandle, glow: elGlow },
                { mesh: distanceHandle, glow: null }
            ];
            handles.forEach(h => setHandleScale(h.mesh, h.glow, 1.0));
        }
        
        isDragging = false;
        dragTarget = null;
        renderer.domElement.style.cursor = 'default';
    }
    
    // Event listeners
    renderer.domElement.addEventListener('mousedown', onPointerDown);
    renderer.domElement.addEventListener('mousemove', onPointerMove);
    renderer.domElement.addEventListener('mouseup', onPointerUp);
    renderer.domElement.addEventListener('mouseleave', onPointerUp);
    
    renderer.domElement.addEventListener('touchstart', (e) => {
        e.preventDefault();
        onPointerDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: false });
    
    renderer.domElement.addEventListener('touchmove', (e) => {
        e.preventDefault();
        onPointerMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: false });
    
    renderer.domElement.addEventListener('touchend', onPointerUp);
    
    // Animation loop with subtle animations
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.01;
        
        // Subtle pulsing on handles
        const pulse = 1 + Math.sin(time * 2) * 0.03;
        camGlow.scale.setScalar(pulse);
        
        // Rotate glow ring
        glowRing.rotation.z += 0.003;
        
        renderer.render(scene, camera);
    }
    animate();
    
    // Resize
    function onResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);
    
    // Public API
    threeScene = {
        updatePositions: () => {
            liveAzimuth = state.azimuth;
            liveElevation = state.elevation;
            liveDistance = state.distance;
            updateVisuals();
        },
        syncFromSliders: () => {
            liveAzimuth = state.azimuth;
            liveElevation = state.elevation;
            liveDistance = state.distance;
            updateVisuals();
        },
        updateImage: (url) => {
            if (url) {
                // For base64 data URLs, load directly via Image element
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    const tex = new THREE.Texture(img);
                    tex.needsUpdate = true;
                    planeMat.map = tex;
                    planeMat.color.set(0xffffff);
                    planeMat.needsUpdate = true;
                    const ar = img.width / img.height;
                    imagePlane.scale.set(ar > 1 ? 0.9 : 0.9 * ar, ar > 1 ? 0.9 / ar : 0.9, 1);
                    console.log('3D scene: Image loaded successfully');
                };
                
                img.onerror = (err) => {
                    console.warn('3D scene: Could not load image, showing placeholder', err);
                    planeMat.map = null;
                    planeMat.color.set(0xE93D82);
                    planeMat.needsUpdate = true;
                };
                
                img.src = url;
            } else {
                planeMat.map = null;
                planeMat.color.set(0x1a1a2e);
                planeMat.needsUpdate = true;
                imagePlane.scale.set(1, 1, 1);
            }
        }
    };
}

// ===== Image Upload Handling =====
// ===== Image Validation =====
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function validateImageFile(file) {
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }
    
    // Check MIME type
    if (!file.type || !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
        return { valid: false, error: `Invalid file type: ${file.type || 'unknown'}. Allowed: JPG, PNG, WebP, GIF` };
    }
    
    // Check file extension as backup
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    if (!hasValidExtension) {
        return { valid: false, error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` };
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        return { valid: false, error: `File too large: ${sizeMB}MB. Maximum: 20MB` };
    }
    
    return { valid: true };
}

function validateImageUrl(url) {
    if (!url || !url.trim()) {
        return { valid: false, error: 'No URL provided' };
    }
    
    url = url.trim();
    
    // Check URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { valid: false, error: 'URL must start with http:// or https://' };
    }
    
    // Check for image extension (optional - some URLs don't have extensions)
    const urlLower = url.toLowerCase();
    const looksLikeImage = ALLOWED_EXTENSIONS.some(ext => urlLower.includes(ext)) || 
                          urlLower.includes('image') || 
                          urlLower.includes('img') ||
                          urlLower.includes('photo');
    
    // We'll allow it even without extension, as many image URLs don't have them
    return { valid: true, warning: !looksLikeImage ? 'URL may not be an image' : null };
}

function handleImageUpload(file) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
        showStatus(validation.error, 'error');
        addLog(`Error: ${validation.error}`, 'error');
        return;
    }
    
    addLog(`Uploading image: ${file.name} (${(file.size / 1024).toFixed(1)} KB, ${file.type})`, 'info');
    
    // Clear any URL when uploading a file
    state.imageUrl = null;
    if (elements.imageUrlInput) {
        elements.imageUrlInput.value = '';
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        state.uploadedImage = file;
        state.uploadedImageBase64 = e.target.result;
        
        elements.previewImage.src = e.target.result;
        elements.previewImage.classList.remove('hidden');
        elements.uploadPlaceholder.classList.add('hidden');
        elements.clearImage.classList.remove('hidden');
        elements.uploadZone.classList.add('has-image');
        
        // Update 3D scene
        if (threeScene) {
            threeScene.updateImage(e.target.result);
        }
        
        addLog(`Image loaded successfully. Base64 size: ${(e.target.result.length / 1024).toFixed(1)} KB`, 'info');
        
        updateGenerateButton();
        hideStatus();
    };
    reader.readAsDataURL(file);
}

function clearImage() {
    state.uploadedImage = null;
    state.uploadedImageBase64 = null;
    state.imageUrl = null;
    
    elements.previewImage.src = '';
    elements.previewImage.classList.add('hidden');
    elements.uploadPlaceholder.classList.remove('hidden');
    elements.clearImage.classList.add('hidden');
    elements.uploadZone.classList.remove('has-image');
    elements.imageUrlInput.value = '';
    
    // Reset upload placeholder content
    elements.uploadPlaceholder.innerHTML = `
        <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>Drop image here or click to upload</p>
    `;
    
    if (threeScene) {
        threeScene.updateImage(null);
    }
    
    updateGenerateButton();
}

function loadImageFromUrl(url) {
    const validation = validateImageUrl(url);
    if (!validation.valid) {
        showStatus(validation.error, 'error');
        addLog(`Error: ${validation.error}`, 'error');
        return;
    }
    
    url = url.trim();
    
    if (validation.warning) {
        addLog(`Warning: ${validation.warning}`, 'warn');
    }
    
    addLog(`Loading image from URL: ${url}`, 'info');
    showStatus('Loading image...', 'info');
    
    // Clear any previously uploaded file
    state.uploadedImage = null;
    state.uploadedImageBase64 = null;
    
    // Set the URL
    state.imageUrl = url;
    
    // Show URL indicator immediately
    elements.uploadPlaceholder.innerHTML = `
        <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <p style="font-size: 11px; word-break: break-all; color: var(--accent);">URL loaded</p>
        <p style="font-size: 10px; word-break: break-all; opacity: 0.6;">${url.length > 40 ? url.substring(0, 40) + '...' : url}</p>
    `;
    elements.clearImage.classList.remove('hidden');
    elements.uploadZone.classList.add('has-image');
    updateGenerateButton();
    
    // Try to load the image for preview (without crossOrigin first for better compatibility)
    const img = new Image();
    
    img.onload = () => {
        // Successfully loaded - show preview
        elements.previewImage.src = url;
        elements.previewImage.classList.remove('hidden');
        elements.uploadPlaceholder.classList.add('hidden');
        
        addLog(`Image preview loaded successfully`, 'info');
        hideStatus();
    };
    
    img.onerror = () => {
        // Preview failed but URL is still set - show indicator
        addLog(`Could not preview image (CORS/network), but URL is set for generation`, 'warn');
        elements.previewImage.classList.add('hidden');
        elements.uploadPlaceholder.classList.remove('hidden');
        hideStatus();
    };
    
    img.src = url;
    
    // Update 3D scene separately (it handles its own CORS)
    if (threeScene) {
        threeScene.updateImage(url);
    }
}

// ===== API Call =====
async function generateImage() {
    const apiKey = elements.apiKey.value.trim();
    if (!apiKey) {
        showStatus('Please enter your fal.ai API key', 'error');
        addLog('Error: No API key provided', 'error');
        return;
    }
    
    if (!state.uploadedImage && !state.imageUrl) {
        showStatus('Please upload an image or provide a URL', 'error');
        addLog('Error: No image provided', 'error');
        return;
    }
    
    state.isGenerating = true;
    updateGenerateButton();
    
    // Add loading UI states
    elements.generateBtn.classList.add('generating');
    elements.generateBtn.querySelector('.btn-text').textContent = 'Generating...';
    elements.generateBtn.querySelector('.btn-loader').classList.remove('hidden');
    elements.outputContainer.classList.add('loading');
    elements.outputPlaceholder.classList.add('loading');
    
    // Dynamic loading messages
    const loadingMessages = [
        'Processing image...',
        'Analyzing camera angle...',
        'Rendering new view...',
        'Almost there...'
    ];
    let messageIndex = 0;
    const loadingInterval = setInterval(() => {
        if (state.isGenerating) {
            showStatus(loadingMessages[messageIndex % loadingMessages.length], 'info');
            messageIndex++;
        } else {
            clearInterval(loadingInterval);
        }
    }, 3000);
    
    hideStatus();
    
    // Configure fal client with API key
    fal.config({
        credentials: apiKey
    });
    
    addLog(`Configuring fal client...`, 'info');
    addLog(`Model: ${CONFIG.FAL_MODEL_ID}`, 'info');
    addLog(`Camera: horizontal_angle=${state.azimuth}°, vertical_angle=${state.elevation}°, zoom=${state.distance}`, 'info');
    
    try {
        let imageUrl;
        
        // Use direct URL if provided, otherwise upload the file
        if (state.imageUrl) {
            imageUrl = state.imageUrl;
            addLog(`Using provided URL: ${imageUrl}`, 'info');
        } else {
            // Upload the image to fal storage
            showStatus('Uploading image...', 'info');
            addLog(`Uploading image to fal storage...`, 'request');
            
            imageUrl = await fal.storage.upload(state.uploadedImage);
            addLog(`Image uploaded: ${imageUrl}`, 'response');
        }
        
        // Now run the model
        showStatus('Generating... This may take a moment.', 'info');
        addLog(`Starting model inference...`, 'request');
        
        // fal.ai API uses numeric parameters for camera control (NOT text prompt!)
        // horizontal_angle: 0-360 (0=front, 90=right, 180=back, 270=left)
        // vertical_angle: -30 to 90 (-30=low-angle, 0=eye-level, 30=elevated, 60=high-angle, 90=bird's-eye)
        // zoom: 0-10 (0=wide/far, 5=medium, 10=close-up)
        const input = {
            image_urls: [imageUrl],
            horizontal_angle: state.azimuth,
            vertical_angle: state.elevation,
            zoom: state.distance
        };
        
        addLog(`Input: ${JSON.stringify(input, null, 2)}`, 'request');
        
        const result = await fal.run(CONFIG.FAL_MODEL_ID, {
            input: input
        });
        
        addLog(`Result received!`, 'response');
        
        // Log the result structure
        try {
            addLog(`Result: ${JSON.stringify(result, null, 2)}`, 'response');
        } catch (e) {
            addLog(`Could not stringify result: ${e.message}`, 'error');
        }
        
        // fal.run returns { data, requestId } - extract data
        const data = result.data || result;
        addLog(`Data keys: ${Object.keys(data || {}).join(', ')}`, 'response');
        
        // Handle result - the response should have images[0].url
        let outputImageUrl = null;
        
        // Try data.images (most likely for fal.run)
        if (data?.images?.[0]?.url) {
            outputImageUrl = data.images[0].url;
            addLog(`Found: data.images[0].url = ${outputImageUrl}`, 'response');
        }
        // Try direct result.images
        else if (result?.images?.[0]?.url) {
            outputImageUrl = result.images[0].url;
            addLog(`Found: result.images[0].url = ${outputImageUrl}`, 'response');
        }
        
        if (outputImageUrl) {
            elements.outputImage.src = outputImageUrl;
            elements.outputImage.classList.remove('hidden');
            elements.outputPlaceholder.classList.add('hidden');
            elements.downloadBtn.classList.remove('hidden');
            
            // Trigger success animation
            elements.outputContainer.classList.add('success');
            setTimeout(() => {
                elements.outputContainer.classList.remove('success');
            }, 600);
            
            addLog(`Success! Image URL: ${outputImageUrl.substring(0, 80)}...`, 'info');
            showStatus('Image generated successfully!', 'success');
        }
        
        // Fallback: try to find any fal.media URL in the result
        if (!outputImageUrl) {
            addLog('Trying regex fallback...', 'warn');
            const resultStr = JSON.stringify(result);
            const urlMatch = resultStr.match(/https:\/\/[^"]*fal\.media[^"]*/);
            if (urlMatch) {
                outputImageUrl = urlMatch[0];
                addLog(`Found URL via regex: ${outputImageUrl}`, 'warn');
            }
        }
        
        if (!outputImageUrl) {
            addLog('Error: Could not extract image URL from response', 'error');
            throw new Error('No image in response. Check logs for details.');
        }
        
    } catch (error) {
        console.error('Generation error:', error);
        let errorMsg;
        
        // Handle specific error types
        if (error.message && error.message.includes('fetch')) {
            errorMsg = 'Network error - check your internet connection';
        } else if (error.status === 401 || error.message?.includes('401')) {
            errorMsg = 'Invalid API key. Please check your fal.ai API key.';
        } else if (error.status === 422 || error.message?.includes('422')) {
            errorMsg = 'Invalid request format. Check the logs for details.';
        } else if (error.body) {
            errorMsg = formatError(error.body);
        } else {
            errorMsg = formatError(error);
        }
        
        addLog(`Error: ${errorMsg}`, 'error');
        if (error.body) {
            addLog(`Error body: ${JSON.stringify(error.body, null, 2)}`, 'error');
        }
        showStatus(`Error: ${errorMsg}`, 'error');
    } finally {
        state.isGenerating = false;
        updateGenerateButton();
        
        // Remove loading UI states
        elements.generateBtn.classList.remove('generating');
        elements.generateBtn.querySelector('.btn-text').textContent = 'Generate';
        elements.generateBtn.querySelector('.btn-loader').classList.add('hidden');
        elements.outputContainer.classList.remove('loading');
        elements.outputPlaceholder.classList.remove('loading');
    }
}

// ===== Download =====
async function downloadImage() {
    const imageUrl = elements.outputImage.src;
    if (!imageUrl) return;
    
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `qwen-multiangle-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        // Fallback: open in new tab
        window.open(imageUrl, '_blank');
    }
}

// ===== Event Listeners Setup =====
function setupEventListeners() {
    // API Key toggle visibility
    elements.toggleKey.addEventListener('click', () => {
        const input = elements.apiKey;
        input.type = input.type === 'password' ? 'text' : 'password';
    });
    
    // API Key change
    elements.apiKey.addEventListener('input', updateGenerateButton);
    
    // Image upload - click
    elements.uploadZone.addEventListener('click', () => {
        elements.imageInput.click();
    });
    
    elements.imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
        }
    });
    
    // Image upload - drag and drop
    elements.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.add('drag-over');
    });
    
    elements.uploadZone.addEventListener('dragleave', () => {
        elements.uploadZone.classList.remove('drag-over');
    });
    
    elements.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageUpload(e.dataTransfer.files[0]);
        }
    });
    
    // Clear image
    elements.clearImage.addEventListener('click', (e) => {
        e.stopPropagation();
        clearImage();
    });
    
    // URL input - load button
    elements.loadUrlBtn.addEventListener('click', () => {
        loadImageFromUrl(elements.imageUrlInput.value);
    });
    
    // URL input - enter key
    elements.imageUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadImageFromUrl(elements.imageUrlInput.value);
        }
    });
    
    // Sliders - continuous values matching fal.ai ranges
    // horizontal_angle: 0-360, vertical_angle: -30 to 90, zoom: 0-10
    elements.azimuthSlider.addEventListener('input', (e) => {
        state.azimuth = parseFloat(e.target.value);
        updateSliderValues();
        updatePromptDisplay();
        if (threeScene) threeScene.syncFromSliders();
    });
    
    elements.elevationSlider.addEventListener('input', (e) => {
        state.elevation = parseFloat(e.target.value);
        updateSliderValues();
        updatePromptDisplay();
        if (threeScene) threeScene.syncFromSliders();
    });
    
    elements.distanceSlider.addEventListener('input', (e) => {
        state.distance = parseFloat(e.target.value);
        updateSliderValues();
        updatePromptDisplay();
        if (threeScene) threeScene.syncFromSliders();
    });
    
    // Generate button
    elements.generateBtn.addEventListener('click', generateImage);
    
    // Download button
    elements.downloadBtn.addEventListener('click', downloadImage);
    
    // Clear logs button
    if (elements.clearLogs) {
        elements.clearLogs.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearLogs();
        });
    }
}

// ===== Initialize =====
function init() {
    // Cache DOM elements
    elements.apiKey = document.getElementById('api-key');
    elements.toggleKey = document.getElementById('toggle-key');
    elements.uploadZone = document.getElementById('upload-zone');
    elements.imageInput = document.getElementById('image-input');
    elements.uploadPlaceholder = document.getElementById('upload-placeholder');
    elements.previewImage = document.getElementById('preview-image');
    elements.clearImage = document.getElementById('clear-image');
    elements.imageUrlInput = document.getElementById('image-url-input');
    elements.loadUrlBtn = document.getElementById('load-url-btn');
    elements.threejsContainer = document.getElementById('threejs-container');
    elements.azimuthSlider = document.getElementById('azimuth-slider');
    elements.elevationSlider = document.getElementById('elevation-slider');
    elements.distanceSlider = document.getElementById('distance-slider');
    elements.azimuthValue = document.getElementById('azimuth-value');
    elements.elevationValue = document.getElementById('elevation-value');
    elements.distanceValue = document.getElementById('distance-value');
    elements.promptDisplay = document.getElementById('prompt-display');
    elements.generateBtn = document.getElementById('generate-btn');
    elements.outputContainer = document.getElementById('output-container');
    elements.outputPlaceholder = document.getElementById('output-placeholder');
    elements.outputImage = document.getElementById('output-image');
    elements.downloadBtn = document.getElementById('download-btn');
    elements.statusMessage = document.getElementById('status-message');
    elements.logsContainer = document.getElementById('logs-container');
    elements.clearLogs = document.getElementById('clear-logs');
    
    // Initialize
    setupEventListeners();
    initThreeJS();
    updateSliderValues();
    updatePromptDisplay();
    updateGenerateButton();
    
    // Try to load API key from localStorage
    const savedKey = localStorage.getItem('fal_api_key');
    if (savedKey) {
        elements.apiKey.value = savedKey;
        updateGenerateButton();
    }
    
    // Save API key on change
    elements.apiKey.addEventListener('change', () => {
        localStorage.setItem('fal_api_key', elements.apiKey.value);
    });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

