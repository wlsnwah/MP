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
const STACK_HOLDER_Y_SHIFT = 0.16;
const COLLECTOR_BOTTOM_Y_SHIFT = 0.12;
const BIPOLAR_BOTTOM_LAYER_Y_SHIFT = 0.055;
const GDL_BOTTOM_Y_SHIFT = 0.04;
const CCM_LAYER_Y_SHIFT = 0;
const GDL_TOP_Y_SHIFT = -0.065;
const BIPOLAR_TOP_LAYER_Y_SHIFT = -0.08
const COLLECTOR_TOP_Y_SHIFT = -0.095;
const UPMOST_SUP_REVISIONED_Y_SHIFT = -0.085;
// ----------------------------------------------


// --- Core Three.js Setup ---
const container = document.getElementById('viewer-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.01,
    100
);

// --- Global raycaster + popup ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(componentMeshes, true); // only check your components

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        if (clickedObject.isMesh) {
            console.log("Layer clicked:", clickedObject.name);
            openPopup(clickedObject.name); // <-- your existing popup function
        }
    }
});


// Layer order: 1 (Bottom) to 8 (Top). Offsets scaled to match SCALE_FACTOR.
const COMPONENT_FILES = [
    { name: 'end_plate', path: 'stack_holder_prt.glb', offset: -5.0, manualYShift: STACK_HOLDER_Y_SHIFT },

    { name: 'current_collector', path: 'collector_layer_prt.glb', offset: -4.0, manualYShift: COLLECTOR_BOTTOM_Y_SHIFT },

    { name: 'flow_field_channel_plate', path: 'bipolar_layer_prt.glb', offset: -3.0, manualYShift: BIPOLAR_BOTTOM_LAYER_Y_SHIFT },

    { name: 'gas_diffusion_layer', path: 'layer_bot_gdl_prt.glb', offset: -2.0, manualYShift: GDL_BOTTOM_Y_SHIFT },

    { name: 'catalyst_coated_membrane', path: 'ccm_layer_prt.glb', offset: -1.0, manualYShift: CCM_LAYER_Y_SHIFT },

    { name: 'gas_diffusion_layer', path: 'layer_testing_prt.glb', offset: 0.0, manualYShift: GDL_TOP_Y_SHIFT },

    { name: 'flow_field_channel_plate', path: 'bipolar_layer_prt.glb', offset: 1.0, manualYShift: BIPOLAR_TOP_LAYER_Y_SHIFT },

    { name: 'current_collector', path: 'collector_top.glb', offset: 2.0, manualYShift: COLLECTOR_TOP_Y_SHIFT },

    { name: 'end_plate', path: 'upmost_sup_revisioned_prt.glb', offset: 3.0, manualYShift: UPMOST_SUP_REVISIONED_Y_SHIFT },
];


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
                if (component.name === 'flow_field_channel_plate') {
                    componentMesh.rotation.set(0, 0, 0);

                    componentMesh.position.x = BIPOLAR_X_SHIFT;
                    componentMesh.position.z = BIPOLAR_Z_SHIFT;

                } else {
                    componentMesh.rotation.x = -Math.PI / 2;

                    // Flip ONLY the TOP gas diffusion layer
                    if (
                        component.name === 'gas_diffusion_layer' &&
                        component.offset === 0.0
                    ) {
                        componentMesh.rotation.y = Math.PI; // flip
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

                label.position.set(-0.5, 0.05, 0); 
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

function openPopup(name, descriptionHTML = "", extraHTML = "") {
    const popup = document.getElementById('component-popup');
    const title = document.getElementById('popup-title');
    const desc = document.getElementById('popup-description');
    const extra = document.getElementById('popup-extra');

    title.textContent = humanizeFileName(name);

    // Flexible description (HTML allowed)
    desc.innerHTML = descriptionHTML;

    // Extra content (videos, images, etc.)
    extra.innerHTML = extraHTML;

    popup.style.display = 'flex';
}

// Close button
document.getElementById('popup-close').addEventListener('click', () => {
    document.getElementById('component-popup').style.display = 'none';
    document.getElementById('popup-description').innerHTML = "";
    document.getElementById('popup-extra').innerHTML = "";
});



// --- Add raycaster listener after all components are loaded ---
function setupRaycaster() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('pointerdown', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(componentMeshes, true);

        if (intersects.length > 0) {
            const clickedObject = intersects.find(obj => obj.object.isMesh).object;

            if (!clickedObject) return;

            console.log("Layer clicked:", clickedObject.name);

            let description = "";
            let extra = "";

            switch(clickedObject.name) {
                case "stack_holder":
                    description = `
                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        What it is
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        The stack holder is the outer frame or casing that surrounds the entire fuel cell stack.
                        It keeps all the layers aligned, protected, and held tightly together.
                        Think of it as the body or shell that keeps the stack stable.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        Functionality
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        Its main job is to apply even pressure across all the layers so they stay in close contact.
                        This tight contact is important for gas sealing, electrical connection, and overall performance.
                        The stack holder also protects the stack from outside forces, vibration, and movement.
                        It helps support the plates, membranes, seals, and other parts inside.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it helps in the fuel cell stack
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px; color: #333;">
                        Without the stack holder, the layers could shift, leak, or lose contact.
                        This would reduce performance or cause the fuel and air to mix in the wrong places.
                        By holding everything firmly, the stack holder makes sure the internal reactions happen safely and evenly.
                        It also helps extend the life of the stack by preventing damage and keeping the inside structure compressed correctly.
                        </p>

                        <h2 style="font-size: 1.25rem; margin-bottom: 6px; color: #1f2933;">
                        How it is made
                        </h2>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 10px; color: #333;">
                        Stack holders are usually made from strong materials such as stainless steel, aluminum, or reinforced plastic.
                        The parts are shaped using machining, molding, or casting depending on the design.
                        </p>
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 0; color: #333;">
                        Some stack holders use bolts, plates, or clamps to apply pressure.
                        Others use a molded housing that fits the shape of the stack.
                        The final assembly must be strong, precise, and able to handle heat, moisture, and vibration during operation.
                        </p>
                    `;
                    // extra = `<video width="100%" controls><source src="bipolar_video.mp4" type="video/mp4"></video>`;
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
                        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 0; color: #333;">
                        The coating can be applied by spraying, printing, or hot pressing.
                        After coating, the sheet is dried, pressed, and trimmed so it fits perfectly inside the fuel cell.
                        </p>
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

            openPopup(clickedObject.name, description, extra);
        }
    });
}


// --- Call this when all components are loaded ---
function onAllComponentsLoaded() {
    console.log(`All ${componentMeshes.length} components loaded.`);
    setupRaycaster(); // <--- Setup raycaster AFTER loading
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