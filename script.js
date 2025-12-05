// --- Configuration ---
// GLOBAL SCALE FACTOR: This fixes the "too big" issue (e.g., converting mm to meters)
const SCALE_FACTOR = 0.005;

// 💡 GAP CONTROL: Increase this value (e.g., from 5.0 to 6.0) to MINIMIZE the gap in the ASSEMBLED stack.
const COMPRESSION_RATIO = 15.0;

// 💡 EXPLOSION CONTROL: Decrease this value (e.g., from 1.0 to 0.5) to make the EXPLODED view smaller.
const EXPLOSION_SCALE = 0.3;

const ANIMATION_DURATION = 1.2;

// --- Manual Hotfix for Bipolar Plate Position ---
const BIPOLAR_X_SHIFT = 0.0; // Positive moves Right, Negative moves Left
const BIPOLAR_Z_SHIFT = 0.4; // Positive moves Backward, Negative moves Forward
// ------------------------------------------------

// --- Manual Hotfix for GDL_Top Position ---
const GDL_TOP_X_SHIFT = 1.2; // Positive moves Right, Negative moves Left
const GDL_TOP_Z_SHIFT = 0.0; // Positive moves Backward, Negative moves Forward
// ------------------------------------------

// --- Manual Y-Shift Constants for all parts ---
const STACK_HOLDER_Y_SHIFT = 0.3;
const COLLECTOR_BOTTOM_Y_SHIFT = 0.3;
const BIPOLAR_LAYER_Y_SHIFT = 0.26;
const GDL_BOTTOM_Y_SHIFT = .26;
const CCM_LAYER_Y_SHIFT = 0.23;
const GDL_TOP_Y_SHIFT = .2;
const COLLECTOR_TOP_Y_SHIFT = .21;
const UPMOST_SUP_REVISIONED_Y_SHIFT = 0.22;
// ----------------------------------------------


// Layer order: 1 (Bottom) to 8 (Top). Offsets scaled to match SCALE_FACTOR.
const COMPONENT_FILES = [
    { name: 'stack_holder', path: 'stack_holder_prt.glb', offset: -4.0, manualYShift: STACK_HOLDER_Y_SHIFT },
    { name: 'current_collector', path: 'collector_layer_prt.glb', offset: -3.0, manualYShift: COLLECTOR_BOTTOM_Y_SHIFT },
    { name: 'bipolar_layer', path: 'bipolar_layer_prt.glb', offset: -2.0, manualYShift: BIPOLAR_LAYER_Y_SHIFT },
    { name: 'gas_diffusion_layer', path: 'layer_bot_gdl_prt.glb', offset: -1.0, manualYShift: GDL_BOTTOM_Y_SHIFT },
    { name: 'catalyst_coated_membrane', path: 'ccm_layer_prt.glb', offset: 0.0, manualYShift: CCM_LAYER_Y_SHIFT },
    { name: 'gas_diffusion_layer', path: 'layer_testing_prt.glb', offset: 1.0, manualYShift: GDL_TOP_Y_SHIFT },
    { name: 'current_collector', path: 'collector_top.glb', offset: 2.0, manualYShift: COLLECTOR_TOP_Y_SHIFT },
    { name: 'upmost_support', path: 'upmost_sup_revisioned_prt.glb', offset: 3.0, manualYShift: UPMOST_SUP_REVISIONED_Y_SHIFT },
];

// --- Core Three.js Setup ---
const container = document.getElementById('viewer-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.01,
    100
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 0.5;
controls.maxDistance = 5;

// Lighting setup
const sceneBackground = new THREE.Color(0xeeeeee);
scene.background = sceneBackground;

const pmremGenerator = new THREE.PMREMGenerator(renderer);
const cubeRenderTarget = pmremGenerator.fromScene(scene);
scene.environment = cubeRenderTarget.texture;
pmremGenerator.dispose();


const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
directionalLight.position.set(10, 10, 5);
scene.add(directionalLight);

camera.position.set(0.5, 2.5, 2.5);

// --- Model Loading Logic ---
const loader = new THREE.GLTFLoader();
const componentMeshes = [];
const originalPositions = new Map();
const clock = new THREE.Clock();


/**
 * Applies a white MeshStandardMaterial (PBR) and ensures geometry has vertex normals.
 * @param {THREE.Mesh | THREE.Group} mesh The component mesh.
 */
function applyShadingAndColor(mesh) {
    const WHITE_COLOR = 0xFFFFFF;
    const newMaterial = new THREE.MeshStandardMaterial({
        color: WHITE_COLOR,
        metalness: 0.1,
        roughness: 0.5,
    });

    mesh.traverse(child => {
        if (child.isMesh) {
            child.material = newMaterial;
            child.geometry.computeVertexNormals();
        }
    });
}

/**
 * Creates an outline using EdgesGeometry, which is better for complex meshes and holes.
 * This technique only draws lines where face angles are sharp, resulting in a cleaner look.
 * @param {THREE.Mesh} mesh The component mesh to outline.
 */
function createEdgeOutline(mesh) {
    const outlineMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 2, // Note: linewidth is often ignored by WebGL renderers
    });

    mesh.traverse(child => {
        if (child.isMesh) {
            // Create EdgesGeometry from the mesh's geometry.
            // Angle (in degrees) determines which edges are drawn. Default is 1 degree.
            const edges = new THREE.EdgesGeometry(child.geometry, 30); // 30 degrees is a good value for sharp edges

            const line = new THREE.LineSegments(edges, outlineMaterial);

            // Set the scale of the line to match the original mesh's scale relative to its parent (the group)
            line.scale.copy(child.scale);
            line.position.copy(child.position);
            line.rotation.copy(child.rotation);

            // Add the line object to the same parent as the original mesh
            child.parent.add(line);
        }
    });
}


function createLabelSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; 
    canvas.height = 256; 

    const ctx = canvas.getContext('2d');

    ctx.font = "70px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";

    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
    });

    const sprite = new THREE.Sprite(material);

    // BIG labels so they're visible relative to 0.005 scale model
    sprite.scale.set(1.5, 0.4, 1);

    return sprite;
}


function humanizeFileName(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, "")    // remove extension
    .replace(/_/g, " ")          // replace underscores
    .replace(/\b\w/g, c => c.toUpperCase()); // capitalize words
}


function loadComponent(index) {
    if (index >= COMPONENT_FILES.length) {
        onAllComponentsLoaded();
        return;
    }

    const component = COMPONENT_FILES[index];
    const manualYShift = component.manualYShift || 0.0;

    loader.load(
        component.path,
        function (gltf) {
            const mesh = gltf.scene;

            let componentMesh = null;
            mesh.traverse(child => {
                if (child.isMesh || child.isGroup) {
                    child.name = component.name;
                    componentMesh = child;
                }
            });

            if (componentMesh) {

                // Wrap the mesh in a Group for animation
                const componentGroup = new THREE.Group();
                componentGroup.add(componentMesh);

                componentMesh.position.set(0, 0, 0);

                applyShadingAndColor(componentMesh);

                // --- Rotation & X/Z Hotfix Logic (on the mesh, inside the group) ---
                if (component.name === 'bipolar_layer') {
                    componentMesh.rotation.set(0, 0, 0);

                    componentMesh.position.x = BIPOLAR_X_SHIFT;
                    componentMesh.position.z = BIPOLAR_Z_SHIFT;

                } else {
                    componentMesh.rotation.x = -Math.PI / 2;

                    if (component.name === 'gdl_top') {
                        componentMesh.rotation.y = Math.PI;

                        componentMesh.position.x = GDL_TOP_X_SHIFT;
                        componentMesh.position.z = GDL_TOP_Z_SHIFT;
                    }
                }

                // Apply scale to the mesh
                componentMesh.scale.set(SCALE_FACTOR, SCALE_FACTOR, SCALE_FACTOR);

                // --- NEW Outline using EdgesGeometry for a clean look ---
                createEdgeOutline(componentMesh);


                // Apply assembled Y position using compression ratio
                const scaledOffset = component.offset;
                const initialAssembledY = scaledOffset / COMPRESSION_RATIO;

                // Set position on the Group (componentGroup)
                componentGroup.position.y = initialAssembledY + manualYShift;


                componentGroup.userData.explosionOffset = scaledOffset;
                componentGroup.userData.manualYShift = manualYShift;

                // --- Create and attach label ---
                const cleanName = humanizeFileName(component.name);
                const label = createLabelSprite(cleanName);

                label.position.set(-0.5, 0.1, 0); 
                label.visible = false; // hidden until exploded

                componentGroup.add(label);
                componentGroup.userData.label = label;

                scene.add(componentGroup);
                componentMeshes.push(componentGroup);

                // Save assembled position (includes the manual shift)
                originalPositions.set(componentGroup, componentGroup.position.clone());

            } else {
                console.error(`Could not find mesh object in ${component.path}`);
            }

            loadComponent(index + 1);
        },
        () => { },
        error => {
            console.error(`Error loading ${component.path}:`, error);
            loadComponent(index + 1);
        }
    );
}

function onAllComponentsLoaded() {
    console.log(`All ${componentMeshes.length} components loaded.`);
}

loadComponent(0);

// --- Component Animation Logic ---
const partsToAnimate = [];

function animateExplosion(explode) {
    if (componentMeshes.length === 0) return;
    partsToAnimate.length = 0;

    componentMeshes.forEach(mesh => {
        const assembledPos = originalPositions.get(mesh);
        const offset = mesh.userData.explosionOffset || 0;
        const manualYShift = mesh.userData.manualYShift || 0;

        const targetPos = new THREE.Vector3();
        targetPos.x = assembledPos.x;
        targetPos.z = assembledPos.z;

        if (explode) {
            targetPos.y = (offset * EXPLOSION_SCALE) + manualYShift;

            if (mesh.userData.label) {
                mesh.userData.label.visible = true;
            }

        } else {
            targetPos.y = assembledPos.y;

            if (mesh.userData.label) {
                mesh.userData.label.visible = false;
            }
        }

        partsToAnimate.push({
            part: mesh,
            start: mesh.position.clone(),
            target: targetPos,
            elapsed: 0
        });
    });
}

document.getElementById('explode-button').addEventListener('click', () => {
    animateExplosion(true);
});

document.getElementById('assemble-button').addEventListener('click', () => {
    animateExplosion(false);
});

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const duration = ANIMATION_DURATION;

    partsToAnimate.forEach(anim => {
        anim.elapsed += delta;
        const progress = Math.min(1, anim.elapsed / duration);

        anim.part.position.lerpVectors(anim.start, anim.target, progress);
    });

    controls.update();
    
    componentMeshes.forEach(mesh => {
        const label = mesh.userData.label;
        if (label && label.visible) {
            label.lookAt(camera.position);
        }
    });

    renderer.render(scene, camera);

}

animate();