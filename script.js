// ============================================================================
// FUEL CELL STACK VISUALIZER - 3D Interactive Model
// ============================================================================
// This script creates an interactive 3D visualization of a fuel cell stack
// using Three.js. It allows users to explode/assemble the stack and click
// on components to view detailed information.
// ============================================================================


// ============================================================================
// SECTION 1: CONFIGURATION & CONSTANTS
// ============================================================================

// SCALING: Converts model units (mm) to a reasonable display size
const SCALE_FACTOR = 0.005;

// ASSEMBLY: Controls spacing between layers in the assembled view
// Increase (e.g., 15→20) to reduce gaps; decrease to increase gaps
const COMPRESSION_RATIO = 15.0;

// EXPLOSION: Controls spread of layers in exploded view
// Decrease (e.g., 0.3→0.2) to make explosion tighter; increase for more spread
const EXPLOSION_SCALE = 0.3;

// ANIMATION: Duration in seconds for explosion/assembly transitions
const ANIMATION_DURATION = 1.2;

// BIPOLAR PLATE POSITIONING: Fine-tune adjustments for flow field channel plate
const BIPOLAR_X_SHIFT = 0.0;  // Positive = Right, Negative = Left
const BIPOLAR_Z_SHIFT = 0.4;  // Positive = Back, Negative = Forward

// Y-AXIS SHIFTS: Vertical fine-tuning for each component to fix alignment
const STACK_HOLDER_Y_SHIFT = 0.16;
const COLLECTOR_BOTTOM_Y_SHIFT = 0.12;
const BIPOLAR_BOTTOM_LAYER_Y_SHIFT = 0.055;
const GDL_BOTTOM_Y_SHIFT = 0.04;
const CCM_LAYER_Y_SHIFT = 0;
const GDL_TOP_Y_SHIFT = -0.04;
const BIPOLAR_TOP_LAYER_Y_SHIFT = -0.080;
const COLLECTOR_TOP_Y_SHIFT = -0.12;
const UPMOST_SUP_REVISIONED_Y_SHIFT = -0.185;


// ============================================================================
// SECTION 2: THREE.JS CORE SETUP
// ============================================================================

const container = document.getElementById('viewer-container');

// Scene and camera configuration
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.01,
    100
);

// Renderer with tone mapping for realistic lighting
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

// Orbit controls for user interaction
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


// ============================================================================
// SECTION 3: COMPONENT DATA
// ============================================================================

// Layer order: 1 (Bottom) to 9 (Top)
// Each component references a 3D model file and its position in the stack
const COMPONENT_FILES = [
    { name: 'end_plate', path: 'stack_holder_prt.glb', offset: -5.0, manualYShift: STACK_HOLDER_Y_SHIFT },
    { name: 'current_collector', path: 'collector_layer_prt.glb', offset: -4.0, manualYShift: COLLECTOR_BOTTOM_Y_SHIFT },
    { name: 'flow_field_channel_plate', path: 'bipolar_layer_prt.glb', offset: -3.0, manualYShift: BIPOLAR_BOTTOM_LAYER_Y_SHIFT },
    { name: 'gas_diffusion_layer', path: 'layer_bot_gdl_prt.glb', offset: -2.0, manualYShift: GDL_BOTTOM_Y_SHIFT },
    { name: 'catalyst_coated_membrane', path: 'ccm_layer_prt.glb', offset: -1.0, manualYShift: CCM_LAYER_Y_SHIFT },
    { name: 'gas_diffusion_layer', path: 'layer_bot_gdl_prt.glb', offset: 0.0, manualYShift: GDL_TOP_Y_SHIFT },
    { name: 'flow_field_channel_plate', path: 'bipolar_layer_prt.glb', offset: 1.0, manualYShift: BIPOLAR_TOP_LAYER_Y_SHIFT },
    { name: 'current_collector', path: 'collector_top.glb', offset: 2.0, manualYShift: COLLECTOR_TOP_Y_SHIFT },
    { name: 'end_plate', path: 'upmost_sup_revisioned_prt.glb', offset: 3.0, manualYShift: UPMOST_SUP_REVISIONED_Y_SHIFT },
];


// ============================================================================
// SECTION 4: MATERIALS & COLORS
// ============================================================================

// Component-specific colors (in hexadecimal)
const COMPONENT_COLORS = {
    end_plate: 0x676767,                    // Dark gray
    current_collector: 0xf59e0b,            // Amber
    gas_diffusion_layer: 0x232323,          // Black
    catalyst_coated_membrane: 0x3b82f6,     // Blue
};

/**
 * Applies PBR material and color to a component and computes normals.
 * Stores original color for later restoration.
 * @param {THREE.Mesh | THREE.Group} mesh - The component mesh to shade
 * @param {string} componentName - Name of the component (used to look up color)
 */
function applyShadingAndColor(mesh, componentName) {
    const color = COMPONENT_COLORS[componentName] || 0xffffff;

    const material = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.15,
        roughness: 0.45,
    });

    mesh.traverse(child => {
        if (child.isMesh) {
            child.material = material.clone();
            child.geometry.computeVertexNormals();
            child.userData.originalColor = material.color.clone();
        }
    });
}

/**
 * Highlights a component by changing its color to dark gray.
 * Used when a component is clicked/selected.
 * @param {THREE.Group} group - The component group to highlight
 */
function highlightComponent(group) {
    group.traverse(child => {
        if (child.isMesh) {
            child.material.color.set(0x676767); // Dark gray highlight
        }
    });
}

/**
 * Restores a component to its original color.
 * @param {THREE.Group} group - The component group to reset
 */
function resetComponentColor(group) {
    group.traverse(child => {
        if (child.isMesh && child.userData.originalColor) {
            child.material.color.copy(child.userData.originalColor);
        }
    });
}

//e


// ============================================================================
// SECTION 5: VISUALIZATION & EFFECTS
// ============================================================================

/**
 * Creates an edge outline for a component using EdgesGeometry.
 * Draws lines where face angles are sharp (≥30°), giving a clean technical look.
 * @param {THREE.Mesh} mesh - The component mesh to outline
 */
function createEdgeOutline(mesh) {
    const outlineMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 2,
    });

    mesh.traverse(child => {
        if (child.isMesh) {
            const edges = new THREE.EdgesGeometry(child.geometry, 30); // 30° threshold
            const line = new THREE.LineSegments(edges, outlineMaterial);

            line.scale.copy(child.scale);
            line.position.copy(child.position);
            line.rotation.copy(child.rotation);

            child.parent.add(line);
        }
    });
}

/**
 * Creates a sprite-based label for a component.
 * Labels appear above components in exploded view.
 * @param {string} text - The label text to display
 * @returns {THREE.Sprite} A sprite object ready to be added to the scene
 */
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
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);

    // Scale labels to be visible relative to the small model
    sprite.scale.set(1.5, 0.4, 1);

    return sprite;
}

/**
 * Converts a file name to human-readable format.
 * Example: "bipolar_layer_prt" → "Bipolar Layer Prt"
 * @param {string} fileName - The file or component name to humanize
 * @returns {string} Formatted, human-readable name
 */
function humanizeFileName(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, "")    // Remove file extension
    .replace(/_/g, " ")          // Replace underscores with spaces
    .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize first letter of each word
}




// ============================================================================
// SECTION 6: MODEL LOADING
// ============================================================================

const loader = new THREE.GLTFLoader();
const componentMeshes = [];
const originalPositions = new Map();
const clock = new THREE.Clock();

/**
 * Recursively loads all components from COMPONENT_FILES.
 * Each component is positioned according to assembly layout and orientation.
 * @param {number} index - Current component index being loaded
 */
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
                // Wrap mesh in a Group for cleaner animation
                const componentGroup = new THREE.Group();
                componentGroup.add(componentMesh);

                componentMesh.position.set(0, 0, 0);

                // Apply material and color
                applyShadingAndColor(componentMesh, component.name);

                // --- Rotation & Position Adjustments ---

                // Default orientation (flip 90° for most parts)
                if (component.name !== 'flow_field_channel_plate') {
                    componentMesh.rotation.x = -Math.PI / 2;
                }

                // Bipolar plate specific positioning
                if (component.name === 'flow_field_channel_plate') {
                    componentMesh.position.x = BIPOLAR_X_SHIFT;
                    componentMesh.position.z = BIPOLAR_Z_SHIFT;
                }

                // Flip the TOP bipolar plate (offset === 1)
                if (component.name === 'flow_field_channel_plate' && component.offset === 1.0) {
                    componentGroup.rotation.x = Math.PI;
                    componentMesh.position.z = 0.0;
                }

                // Flip the TOP end plate (offset === 3)
                if (component.name === 'end_plate' && component.offset === 3.0) {
                    componentGroup.rotation.x = Math.PI;
                    componentMesh.position.z = -0.4;
                }

                // Apply scaling
                componentMesh.scale.set(SCALE_FACTOR, SCALE_FACTOR, SCALE_FACTOR);

                // Add edge outlines for visual clarity
                createEdgeOutline(componentMesh);

                // Calculate assembled position
                const scaledOffset = component.offset;
                const initialAssembledY = scaledOffset / COMPRESSION_RATIO;

                componentGroup.position.y = initialAssembledY + manualYShift;

                // Store explosion data
                componentGroup.userData.explosionOffset = scaledOffset;
                componentGroup.userData.manualYShift = manualYShift;

                // Create and attach label
                const cleanName = humanizeFileName(component.name);
                const label = createLabelSprite(cleanName);

                label.position.set(-0.5, 0.05, 0); 
                label.visible = false; // Hidden in assembled view

                componentGroup.add(label);
                componentGroup.userData.label = label;

                // Adjust label for flipped components
                if (componentGroup.rotation.x === Math.PI) {
                    label.rotation.x = Math.PI;
                    label.position.y *= -1;
                }

                scene.add(componentGroup);
                componentMeshes.push(componentGroup);

                // Save original position for animation
                originalPositions.set(componentGroup, componentGroup.position.clone());

            } else {
                console.error(`Could not find mesh object in ${component.path}`);
            }

            loadComponent(index + 1);
        },
        undefined,
        error => {
            console.error(`Error loading ${component.path}:`, error);
            loadComponent(index + 1);
        }
    );
}

/**
 * Callback invoked when all components finish loading.
 * Initializes raycaster for component interaction.
 */
function onAllComponentsLoaded() {
    console.log(`All ${componentMeshes.length} components loaded successfully.`);
    setupRaycaster();
}


// ============================================================================
// SECTION 7: UI & INTERACTION
// ============================================================================

let isPopupOpen = false;

/**
 * Opens the component information popup with description and extras.
 * @param {string} name - Component name
 * @param {string} descriptionHTML - HTML content for the description section
 * @param {string} extraHTML - HTML content for videos, images, etc.
 */
function openPopup(name, descriptionHTML = "", extraHTML = "") {
    const popup = document.getElementById('component-popup');
    const title = document.getElementById('popup-title');
    const desc = document.getElementById('popup-description');
    const extra = document.getElementById('popup-extra');

    title.textContent = humanizeFileName(name);
    desc.innerHTML = descriptionHTML;
    extra.innerHTML = extraHTML;

    popup.style.display = 'flex';
    isPopupOpen = true;
}

// Close button event listener
document.getElementById('popup-close').addEventListener('click', () => {
    document.getElementById('component-popup').style.display = 'none';
    document.getElementById('popup-description').innerHTML = "";
    document.getElementById('popup-extra').innerHTML = "";
    isPopupOpen = false;
});

// Prevent popup click from triggering raycaster
document.getElementById('popup-overlay').addEventListener('pointerdown', e => {
    e.stopPropagation();
});

/**
 * Sets up raycaster for detecting component clicks.
 * Displays popup with component information when clicked.
 * Called after all models are loaded.
 */
function setupRaycaster() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('pointerdown', (event) => {
        // Ignore clicks while popup is open
        if (isPopupOpen) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(componentMeshes, true);

        if (intersects.length === 0) return;

        const clickedObject = intersects.find(obj => obj.object.isMesh)?.object;
        if (!clickedObject) return;

        console.log("Component clicked:", clickedObject.name);

            let description = "";
            let extra = "";

            // Component-specific information displayed in popup
            switch(clickedObject.name) {
                case "end_plate":
                    description = `
                        <h2 style="font-size: 1.25rem;">What it is</h2>
                        <p>
                        The end plate sits at the very top and bottom of the fuel cell stack.
                        It provides structural support and keeps all internal layers compressed.
                        </p>

                        <h2 style="font-size: 1.25rem;">Functionality</h2>
                        <p>
                        End plates distribute clamping pressure evenly across the stack,
                        prevent leaks, and protect the internal layers from bending or misalignment.
                        </p>

                        <h2 style="font-size: 1.25rem;">How it helps</h2>
                        <p>
                        Without end plates, the stack would lose compression, electrical contact,
                        and sealing, leading to poor performance or failure.
                        </p>
                    `;
                    break;
                case "current_collector":
                    description = 
                    `
                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        What it is
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        The current collector is a thin plate or mesh inside a fuel cell stack that helps move electricity out of the cell.
                        It sits on the outside of the other layers and touches the part that produces the electrical energy.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        Functionality
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        Its job is to pick up the electrons created during the fuel cell reaction and guide them to the outside circuit.
                        It also spreads the electrical flow evenly so the cell works smoothly.
                        In some designs, it also helps press the inner layers together so everything stays in good contact.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it helps in the fuel cell stack
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        Without the current collector, the fuel cell cannot deliver power to anything outside the stack.
                        It acts like a bridge between the chemical reaction inside and the electrical output outside.
                        It also reduces energy loss by making sure the electricity travels through a low resistance path,
                        improving the overall performance of the stack.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it is made
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 10px; color: #333;">
                        Current collectors are usually made from metals that conduct electricity very well.
                        Common choices are thin stainless steel plates, nickel plates, or copper plates.
                        Some designs use metal meshes or metal foams.
                        </p>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 0; color: #333;">
                        They may also be given a coating to prevent rust, improve contact, or reduce resistance.
                        These coatings can be carbon based or special thin metal layers.
                        The plates are shaped by stamping, cutting, or pressing so they fit perfectly into the stack.
                        </p>
                    `;
                    break;
                case "flow_field_channel_plate":
                    description = `
                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        What it is
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        The bipolar plate is a solid plate that sits between two fuel cells inside the stack.
                        One side of the plate faces one cell, and the other side faces the next cell.
                        It separates the cells while also helping them work together.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        Functionality
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        The plate has small channels carved into it.
                        These channels guide the fuel and air across the cell surface.
                        The plate also carries electricity from one cell to the next, helping them connect in a series to build higher voltage.
                        It also helps remove heat and water from the cell, keeping everything balanced.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it helps in the fuel cell stack
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        Without the bipolar plate, the stack would not be able to move gases properly or link the cells together electrically.
                        The plate makes sure the fuel and air spread evenly so the reaction happens smoothly.
                        It also joins each cell to the next one, so the total power of the whole stack can be delivered safely.
                        It supports temperature control and water control, which keeps the stack stable over long use.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it is made
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 10px; color: #333;">
                        Bipolar plates are usually made from graphite, coated metal, or special polymers mixed with carbon.
                        The channels are made by machining, stamping, molding, or pressing.
                        </p>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 0; color: #333;">
                        When metal is used, a thin protective coating is added to stop rust and reduce electrical resistance.
                        The final shape must be precise so the gases flow correctly and the plate fits tightly in the stack.
                        </p>
                    `;
                    break;
                case "gas_distribution_layer":
                    description = `
                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        What it is
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        The gas distribution layer is a porous sheet that sits between the bipolar plate and the inner layers of the fuel cell.
                        It looks a bit like a stiff sponge or felt made from carbon.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        Functionality
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        Its job is to spread the fuel and air evenly across the entire reaction area.
                        Because it is porous, gases can move through it in many directions.
                        It also helps move heat and water out of the reaction zone.
                        Another small but important role is helping the electrical current travel smoothly from the inner layers to the plates.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it helps in the fuel cell stack
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        Without the gas distribution layer, gases would only travel through the main channels of the bipolar plate and would not reach all parts of the cell.
                        This would create uneven reactions and lower performance.
                        The layer makes sure every part of the cell gets the right amount of fuel and air.
                        It also supports water control by letting extra water escape, and it helps keep the temperature steady.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it is made
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 10px; color: #333;">
                        The layer is usually made from carbon paper or carbon cloth.
                        Carbon paper is made by pressing carbon fibers into a thin sheet.
                        Carbon cloth is woven from carbon yarns.
                        </p>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 0; color: #333;">
                        Both types are treated with a water resistant coating to help manage moisture.
                        Sometimes a thin layer of micro porous material is added on top to improve gas flow and water control.
                        </p>
                    `;
                    break;

                case "gas_diffusion_layer":
                    description = `
                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        What it is
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        The gas distribution layer is a porous sheet that sits between the bipolar plate and the inner layers of the fuel cell.
                        It looks a bit like a stiff sponge or felt made from carbon.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        Functionality
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        Its job is to spread the fuel and air evenly across the entire reaction area.
                        Because it is porous, gases can move through it in many directions.
                        It also helps move heat and water out of the reaction zone.
                        Another small but important role is helping the electrical current travel smoothly from the inner layers to the plates.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it helps in the fuel cell stack
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        Without the gas distribution layer, gases would only travel through the main channels of the bipolar plate and would not reach all parts of the cell.
                        This would create uneven reactions and lower performance.
                        The layer makes sure every part of the cell gets the right amount of fuel and air.
                        It also supports water control by letting extra water escape, and it helps keep the temperature steady.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it is made
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 10px; color: #333;">
                        The layer is usually made from carbon paper or carbon cloth.
                        Carbon paper is made by pressing carbon fibers into a thin sheet.
                        Carbon cloth is woven from carbon yarns.
                        </p>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 0; color: #333;">
                        Both types are treated with a water resistant coating to help manage moisture.
                        Sometimes a thin layer of micro porous material is added on top to improve gas flow and water control.
                        </p>
                    `;
                    break;
                
                case "catalyst_coated_membrane":
                    description = `
                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        What it is
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        The catalyst coated membrane is the heart of the fuel cell.
                        It is a thin plastic like sheet that can move charged particles, and both sides of this sheet are covered with a special powder called the catalyst.
                        This catalyst helps the fuel cell reaction happen faster.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        Functionality
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        The membrane lets certain charged particles pass through it while blocking gases.
                        The catalyst on each side helps break the fuel and air into smaller parts so they can react.
                        On one side, the fuel splits into electrons and charged particles.
                        The charged particles move through the membrane, while the electrons take an outside path to create electricity.
                        On the other side, the charged particles meet the air and complete the reaction to form water.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it helps in the fuel cell stack
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        This layer is where almost all of the energy conversion happens.
                        Without it, the fuel cell cannot create electricity.
                        It holds the two main chemical reactions and keeps the fuel and air separated so they do not mix directly.
                        It also allows the charged particles to travel safely while forcing the electrons to flow through the circuit that produces useful power.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it is made
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 10px; color: #333;">
                        The membrane is usually made from a special plastic material that can carry charged particles.
                        This membrane is cleaned, prepared, and then coated with a very thin layer of catalyst powder, usually a precious metal mixed with carbon.
                        </p>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 20px; color: #333;">
                        The Proton Exchange Membrane is commonly made from Nafion because it has high proton conductivity and very low electronic conductivity. It allows hydrogen protons to move from the anode to the cathode while blocking electrons and gases.
                        </p>
                        <video width="100%" controls>
                            <source src="MpVideo3.mp4" type="video/mp4">
                        </video>
                    `;
                    break;
                case "end_plate":
                    description = `
                        <h2 style="font-size: 1.25rem;">What it is</h2>
                        <p>
                        The end plate sits at the very top and bottom of the fuel cell stack.
                        It provides structural support and keeps all internal layers compressed.
                        </p>

                        <h2 style="font-size: 1.25rem;">Functionality</h2>
                        <p>
                        End plates distribute clamping pressure evenly across the stack,
                        prevent leaks, and protect the internal layers from bending or misalignment.
                        </p>

                        <h2 style="font-size: 1.25rem;">How it helps</h2>
                        <p>
                        Without end plates, the stack would lose compression, electrical contact,
                        and sealing, leading to poor performance or failure.
                        </p>
                    `;
                    break;

                default:
                    description = `<p>No extra info available.</p>`;
            }

            // Reset all first
            componentMeshes.forEach(resetComponentColor);

            // Highlight selected
            highlightComponent(intersects[0].object.parent);

            openPopup(clickedObject.name, description, extra);
        }
    );
}


// --- Call this when all components are loaded ---
function onAllComponentsLoaded() {
    console.log(`All ${componentMeshes.length} components loaded successfully.`);
    setupRaycaster();
}

// Start loading all components
loadComponent(0);


// ============================================================================
// SECTION 8: ANIMATION LOGIC
// ============================================================================

const partsToAnimate = [];

/**
 * Animates explosion or assembly of fuel cell stack.
 * Creates animation targets for all components.
 * @param {boolean} explode - True for explosion, false for assembly
 */
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
            // Exploded view: spread out layers and show labels
            targetPos.y = (offset * EXPLOSION_SCALE) + manualYShift;
            if (mesh.userData.label) {
                mesh.userData.label.visible = true;
            }
        } else {
            // Assembled view: compress layers and hide labels
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

// Event listeners for explode/assemble buttons
document.getElementById('explode-button').addEventListener('click', () => {
    animateExplosion(true);
});

document.getElementById('assemble-button').addEventListener('click', () => {
    animateExplosion(false);
});


// ============================================================================
// SECTION 9: MAIN ANIMATION LOOP
// ============================================================================

/**
 * Main render loop using requestAnimationFrame.
 * Updates animation progress, camera controls, and renders the scene.
 */
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const duration = ANIMATION_DURATION;

    // Update animation progress for all moving parts
    partsToAnimate.forEach(anim => {
        anim.elapsed += delta;
        const progress = Math.min(1, anim.elapsed / duration);
        anim.part.position.lerpVectors(anim.start, anim.target, progress);
    });

    controls.update();
    
    // Keep labels facing camera in exploded view
    componentMeshes.forEach(mesh => {
        const label = mesh.userData.label;
        if (label && label.visible) {
            label.lookAt(camera.position);
        }
    });

    renderer.render(scene, camera);
}

// Start the animation loop
animate();